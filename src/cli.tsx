import { wrapAll } from './tools/wrap.js';
import { bus } from './ui/events.js';
import React, { useState, useCallback } from 'react';
import { render, Box, Text, Static, useApp, useInput } from 'ink';
import { MentionInput } from './ui/MentionInput.js';
import { callModel, stepCountIs } from '@openrouter/agent';
import { createClient, MODELS, isTransient, sleep } from './llm/client.js';
import { tools } from './tools/index.js';
import { fileState, newSessionId, listSessions } from './session/store.js';
import { Banner } from './ui/banner.js';
import { setThemeMode, getThemeMode, getThemeLabel } from './ui/theme.js';
import { getColors } from './ui/theme.js';
import { ClaudeSpinner } from './ui/spinner.js';
import { ToolCallLine, ToolResultLines, ErrorLine, summarize } from './ui/render.js';
import { DiffView } from './ui/diff.js';
import { ApprovalDialog, type PendingCall, type Decision } from './ui/approval.js';


const wrappedTools = wrapAll(tools as any) as typeof tools;
const SLASH_COMMANDS = [
  { name: 'help', description: 'Show available commands' },
  { name: 'clear', description: 'Clear conversation history' },
  { name: 'theme', description: 'Switch color theme' },
  { name: 'sessions', description: 'List past sessions' },
  { name: 'resume', description: 'Resume a previous session' },
  { name: 'cost', description: 'Show token usage and cost' },
  { name: 'exit', description: 'Exit the REPL' },
];

type Item =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; name: string; args: Record<string, unknown> }
  | { kind: 'result'; text: string }
  | { kind: 'diff'; oldText: string; newText: string }
  | { kind: 'error'; text: string }
  | { kind: 'note'; text: string }
  | { kind: 'banner' };

const client = createClient();
const sessionId = newSessionId();
const session = fileState(sessionId);
const state = session.accessor;

function App() {
  const c = getColors();
  const { exit } = useApp();
  const [items, setItems] = useState<Item[]>([{ kind: 'banner' }]);

  React.useEffect(() => {
    const onTool = (ev: any) => {
      if (ev.kind === 'tool_result') {
        setItems((x: any) => [...x, { kind: 'result', text: ev.summary, ok: ev.ok }]);
      } else if (ev.kind === 'diff') {
        setItems((x: any) => [...x, { kind: 'diff', filePath: ev.filePath, oldText: ev.oldText, newText: ev.newText }]);
      }
    };
    bus.on('tool', onTool);
    return () => { bus.off('tool', onTool); };
  }, []);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [tokens, setTokens] = useState(0);
  const [activeTool, setActiveTool] = useState<string | undefined>();
  const [pending, setPending] = useState<PendingCall | null>(null);
  const autoApproveRef = React.useRef<Set<string>>(new Set());
  const [model, setModel] = useState<string>(MODELS[0]!);
  const modelRef = React.useRef<string>(MODELS[0]!);
  const [, setThemeTick] = useState(0);

  const push = useCallback((it: Item) => setItems((prev) => [...prev, it]), []);

  useInput((_i, key) => {
    if (key.escape && busy) setBusy(false);
  });

  async function drive(userInput?: string, decision?: { approve?: string[]; reject?: string[] }) {
    setBusy(true);
    setStartedAt(Date.now());
    setActiveTool(undefined);

    const start = Math.max(0, (MODELS as readonly string[]).indexOf(modelRef.current));
    for (let mi = start; mi < MODELS.length; mi++) {
      const m = MODELS[mi]!;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = callModel(client, {
            model: m,
            ...(userInput ? { input: userInput } : {}),
            tools: wrappedTools,
            state,
            ...(decision?.approve ? { approveToolCalls: decision.approve } : {}),
            ...(decision?.reject ? { rejectToolCalls: decision.reject } : {}),
            stopWhen: stepCountIs(20),
          } as any);

          modelRef.current = m;
          if (m !== model) setModel(m);

          const argBuf = new Map<string, string>();
          const nameBuf = new Map<string, string>();

          const pump = (async () => {
            try {
              for await (const _te of (result as any).getToolStream()) { void _te; }
            } catch {}
          })();

          for await (const ev of result.getFullResponsesStream() as any) {
            const t = ev?.type;
            if (t === 'response.output_item.added' && ev.item?.type === 'function_call') {
              nameBuf.set(ev.item.id, ev.item.name);
              setActiveTool(ev.item.name);
            } else if (t === 'response.function_call_arguments.done') {
              argBuf.set(ev.itemId, ev.arguments);
              let parsed: Record<string, unknown> = {};
              try {
                parsed = JSON.parse(ev.arguments || '{}');
              } catch {}
              push({ kind: 'tool', name: ev.name ?? nameBuf.get(ev.itemId) ?? '?', args: parsed });
            }
          }

          await pump;
          const text = await result.getText().catch(() => '');
          await result.getResponse().catch(() => {});
          const usage = await result.getUsage().catch(() => null);
          if (usage) setTokens((usage as any).totalTokens ?? 0);
          if (text.trim()) push({ kind: 'assistant', text: text.trim() });

          const s = (await state.load()) as any;
          const nextPending: PendingCall[] = s?.pendingToolCalls ?? [];
          if (nextPending.length > 0) {
            const call = nextPending[0]!;
            if (autoApproveRef.current.has(call.name)) {
              setBusy(false);
              await drive(undefined, { approve: [call.id] });
              return;
            }
            setPending(call);
            setBusy(false);
            return;
          }

          setBusy(false);
          return;
        } catch (err) {
          if (!isTransient(err)) {
            push({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
            setBusy(false);
            return;
          }
          const wait = 2 ** attempt;
          push({ kind: 'note', text: `${m} unavailable, retrying in ${wait}s` });
          await sleep(wait * 1000);
        }
      }
      if (mi < MODELS.length - 1) {
        push({ kind: 'note', text: `falling back to ${MODELS[mi + 1]}` });
      }
    }
    push({ kind: 'error', text: 'all models exhausted' });
    setBusy(false);
  }

  function onSubmit(value: string) {
    const v = value.trim();
    setInput('');
    if (!v) return;
    if (v === '/exit' || v === '/quit') return exit();
    if (v === '/clear') {
      setItems([{ kind: 'banner' }]);
      setTokens(0);
      return;
    }
    if (v === '/help') {
      push({ kind: 'note', text: '/clear  /theme  /sessions  /cost  /help  /exit    esc: interrupt' });
      return;
    }
    if (v.startsWith('/theme')) {
      const arg = v.split(/\s+/)[1];
      const next = arg === 'light' || arg === 'dark' || arg === 'auto'
        ? arg
        : getThemeMode() === 'dark' ? 'light' : getThemeMode() === 'light' ? 'auto' : 'dark';
      setThemeMode(next as any);
      setThemeTick((t) => t + 1);
      push({ kind: 'note', text: `theme → ${getThemeLabel()}` });
      return;
    }
    if (v === '/sessions') {
      void listSessions().then((ss) => {
        if (ss.length === 0) return push({ kind: 'note', text: 'no saved sessions' });
        for (const s2 of ss.slice(0, 10)) {
          const when = new Date(s2.updatedAt).toLocaleString();
          push({ kind: 'note', text: `${s2.id.slice(0, 8)}  ${when}  ${s2.turns} turns  ${s2.cwd.replace(process.env.HOME ?? '', '~')}` });
        }
      });
      return;
    }
    if (v === '/cost') {
      push({ kind: 'note', text: `${tokens} tokens this session · $0.00 (free tier)` });
      return;
    }
    push({ kind: 'user', text: v });
    void drive(v);
  }

  function onDecide(d: Decision) {
    const call = pending!;
    setPending(null);
    if (d === 'reject') {
      push({ kind: 'note', text: 'Rejected' });
      void drive(undefined, { reject: [call.id] });
    } else {
      if (d === 'session') autoApproveRef.current.add(call.name);
      void drive(undefined, { approve: [call.id] });
    }
  }

  return (
    <Box flexDirection="column">
      <Static items={items}>
        {(it, i) => (
          <Box key={i} flexDirection="column" marginBottom={it.kind === 'assistant' ? 1 : 0}>
            {it.kind === 'banner' && <Banner model={model} cwd={process.cwd()} sessionId={sessionId} />}
            {it.kind === 'user' && <Text color={c.user}>{'> ' + it.text}</Text>}
            {it.kind === 'assistant' && (
              <Box>
                <Text color={c.signature}>{'⏺ '}</Text>
                <Text>{it.text}</Text>
              </Box>
            )}
            {it.kind === 'tool' && <ToolCallLine name={it.name} args={it.args} />}
            {it.kind === 'result' && <ToolResultLines text={it.text} />}
            {it.kind === 'diff' && <DiffView oldText={it.oldText} newText={it.newText} />}
            {it.kind === 'error' && <ErrorLine text={it.text} />}
            {it.kind === 'note' && <Text dimColor>{'  ' + it.text}</Text>}
          </Box>
        )}
      </Static>

      {busy && (
        <Box marginTop={1}>
          <ClaudeSpinner startTime={startedAt} tokens={tokens} activeTool={activeTool} />
        </Box>
      )}

      {pending && <ApprovalDialog call={pending} onDecide={onDecide} />}

      {!busy && !pending && (
        <Box borderStyle="round" borderColor={c.border} paddingX={1} marginTop={1}>
          <MentionInput
            value={input}
            onChange={setInput}
            onSubmit={(v: string) => { const t = v.trim(); if (t) setHistory((h) => [...h, t]); onSubmit(v); }}
            placeholder="Try /help"
            commands={SLASH_COMMANDS}
            history={history}
          />
        </Box>
      )}

      {!busy && !pending && (
        <Text dimColor>{`  ${model.split('/')[1]}  ·  ${process.cwd().replace(process.env.HOME ?? '', '~')}`}</Text>
      )}
    </Box>
  );
}

render(<App />);
