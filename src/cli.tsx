import { wrapAll } from './tools/wrap.js';
import { loadMcpTools, mcpStatus, closeMcp } from './mcp/client.js';
import { bus } from './ui/events.js';
import React, { useState, useCallback } from 'react';
import { render, Box, Text, Static, useApp, useInput } from 'ink';
import { execFile } from 'node:child_process';
import { buildSystemPrompt } from './prompt/system.js';
import { setMode, getMode, cycleMode, modeLabel, modeColor, type PermissionMode } from './permissions/mode.js';
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


const wrappedTools: any[] = wrapAll([...tools] as any);
const SLASH_COMMANDS = [
  { name: 'help', description: 'Show available commands' },
  { name: 'clear', description: 'Clear conversation history' },
  { name: 'theme', description: 'Switch color theme' },
  { name: 'sessions', description: 'List past sessions' },
  { name: 'resume', description: 'Resume a previous session' },
  { name: 'cost', description: 'Show token usage and cost' },
  { name: 'context', description: 'Show context window usage' },
  { name: 'compact', description: 'Summarize and compact the conversation' },
  { name: 'exit', description: 'Exit the REPL' },
];


function matchId(id: string, q: string): boolean {
  const a = id.toLowerCase();
  const b = q.trim().toLowerCase().replace(/^conv_/, '');
  if (!b) return false;
  return a.startsWith(b) || a.replace(/^conv_/, '').startsWith(b) || a.includes(b);
}

const PLAN_BLOCK = '\u23F8 plan mode \u2014 ';


const CTX_LIMITS: Record<string, number> = {
  'nemotron-3-ultra-550b-a55b': 128000,
  'nemotron-3-super-120b-a12b': 128000,
  'gpt-oss-20b': 131072,
};
function ctxLimit(model: string): number {
  const short = model.split('/')[1]?.replace(':free', '') ?? model;
  return CTX_LIMITS[short] ?? 128000;
}
function bar(used: number, total: number, width = 20): string {
  const filled = Math.min(width, Math.round((used / total) * width));
  return '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
}
function toolsTokens(ts: any[]): number {
  let n = 0;
  for (const t of ts) {
    const f = t?.function ?? t;
    n += approxTokens(String(f?.name ?? '')) + approxTokens(String(f?.description ?? ''));
    try { n += approxTokens(JSON.stringify(f?.inputSchema ?? {})); } catch { n += 20; }
  }
  return n;
}
function approxTokens(t: string): number {
  return Math.ceil(t.length / 3.5);
}

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
let sessionId = newSessionId();
let session = fileState(sessionId);
let state = session.accessor;

function switchSession(id: string) {
  sessionId = id;
  session = fileState(id);
  state = session.accessor;
}

function App() {
  const c = getColors();
  const { exit } = useApp();
  const [items, setItems] = useState<Item[]>([{ kind: 'banner' }]);
  const [sid, setSid] = useState<string>(sessionId);
  const [staticKey, setStaticKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const carryRef = React.useRef<string>('');
  const ctrlCRef = React.useRef<number>(0);
  const genRef = React.useRef<number>(0);
  const abortRef = React.useRef<AbortController | null>(null);

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
  const [queue, setQueue] = useState<PendingCall[]>([]);
  const decisionsRef = React.useRef<{ approve: string[]; reject: string[] }>({ approve: [], reject: [] });
  const [model, setModel] = useState<string>(MODELS[0]!);
  const modelRef = React.useRef<string>(MODELS[0]!);
  const [, setThemeTick] = useState(0);

  const push = useCallback((it: Item) => setItems((prev) => [...prev, it]), []);

  const [mode, setModeState] = useState<PermissionMode>(getMode());

  useInput((_i, key) => {
    if (key.ctrl && _i === 'c') {
      const now = Date.now();
      if (now - ctrlCRef.current < 2000) { exit(); process.exit(0); }
      ctrlCRef.current = now;
      if (busy) { genRef.current++; setBusy(false); push({ kind: 'note', text: 'Interrupted \u00b7 press Ctrl+C again to exit' }); }
      else push({ kind: 'note', text: 'Press Ctrl+C again to exit' });
      return;
    }
    if (key.escape && busy) { genRef.current++; setBusy(false); }
    if (key.tab && key.shift) setModeState(cycleMode());
    if (key.ctrl && _i === 'o') {
      setExpanded((e) => !e);
      process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
      setStaticKey((k) => k + 1);
    }
  });

  const WRITE_TOOLS = new Set(['edit_file', 'write_file']);
  const shouldAutoApprove = (name: string) => {
    const m = getMode();
    if (m === 'bypassPermissions') return true;
    if (m === 'acceptEdits' && WRITE_TOOLS.has(name)) return true;
    if (!name) return false;
    return autoApproveRef.current.has(name);
  };

  async function drive(userInput?: string, decision?: { approve?: string[]; reject?: string[] }) {
    const myGen = ++genRef.current;
    const alive = () => genRef.current === myGen;
    const ac = new AbortController();
    abortRef.current = ac;
    if (userInput && carryRef.current) {
      userInput = '<previous-conversation-summary>\n' + carryRef.current + '\n</previous-conversation-summary>\n\n' + userInput;
      carryRef.current = '';
    }
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
            instructions: buildSystemPrompt(),
            signal: ac.signal,
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
          if (!alive()) return;
          const text = await result.getText().catch(() => '');
          await result.getResponse().catch(() => {});
          const usage = await result.getUsage().catch(() => null);
          if (usage) setTokens((usage as any).totalTokens ?? 0);
          if (alive() && text.trim()) push({ kind: 'assistant', text: text.trim() });

          const s = (await state.load()) as any;
          const nextPending: PendingCall[] = s?.pendingToolCalls ?? [];
          if (nextPending.length > 0) {
            const approve: string[] = [];
            const reject: string[] = [];
            const ask: PendingCall[] = [];
            for (const call of nextPending) {
              if (getMode() === 'plan' && WRITE_TOOLS.has(call.name)) {
                push({ kind: 'note', text: PLAN_BLOCK + call.name + ' blocked' });
                reject.push(call.id);
              } else if (shouldAutoApprove(call.name)) {
                approve.push(call.id);
              } else {
                ask.push(call);
              }
            }
            if (ask.length === 0) {
              setBusy(false);
              await drive(undefined, { approve, reject });
              return;
            }
            decisionsRef.current = { approve, reject };
            setQueue(ask);
            setPending(ask[0]!);
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

  async function onSubmit(value: string) {
    const v = value.trim();
    setInput('');
    if (!v) return;
    if (v === '/exit' || v === '/quit') return exit();
    if (v === '/clear') {
      process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
      setItems([{ kind: 'banner' }]);
      setStaticKey((k) => k + 1);
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
    if (v.startsWith('/resume')) {
      const arg = v.split(/\s+/)[1];
      void listSessions().then(async (ss) => {
        if (!ss.length) return push({ kind: 'note', text: 'no saved sessions' });
        const target = arg ? ss.find((x) => matchId(x.id, arg)) : ss[0];
        if (!target) return push({ kind: 'note', text: `no session matching "${arg}"` });
        switchSession(target.id);
        const loaded: any = await state.load();
        const msgs: any[] = loaded?.messages ?? [];
        process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
        setItems([{ kind: 'banner' } as any]);
        setStaticKey((k) => k + 1);
        for (const msg of msgs) {
          const text = typeof msg.content === 'string'
            ? msg.content
            : (msg.content ?? []).map((c: any) => c?.text ?? '').filter(Boolean).join('\n');
          if (!text || msg.type === 'reasoning') continue;
          if (msg.role === 'user') push({ kind: 'user', text });
          else if (msg.role === 'assistant') push({ kind: 'assistant', text });
        }
        setSid(target.id);
        push({ kind: 'note', text: `resumed ${target.id.slice(0, 8)} · ${msgs.length} messages` });
      });
      return;
    }
    if (v.startsWith('!')) {
      const cmd = v.slice(1).trim();
      if (!cmd) return;
      push({ kind: 'tool', name: 'Bash', args: { command: cmd } });
      execFile(process.env.SHELL ?? '/bin/sh', ['-c', cmd], { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024, timeout: 120000 }, (err, stdout, stderr) => {
        const out = ((stdout ?? '') + (stderr ?? '')).trimEnd();
        if (out) push({ kind: 'result', text: out.length > 4000 ? out.slice(0, 4000) + '\n\u2026 truncated' : out });
        else if (err) push({ kind: 'error', text: err.message });
        else push({ kind: 'result', text: '(no output)' });
      });
      return;
    }
    if (v === '/compact') {
      const before: any = await state.load();
      const msgs: any[] = before?.messages ?? [];
      if (msgs.length === 0) { push({ kind: 'note', text: 'nothing to compact' }); return; }
      const transcript = msgs.map((mm: any) => {
        const role = mm.role ?? mm.type ?? '?';
        const body = typeof mm.content === 'string'
          ? mm.content
          : Array.isArray(mm.content) ? mm.content.map((x: any) => x?.text ?? '').join(' ') : '';
        return body ? role + ': ' + body : '';
      }).filter(Boolean).join('\n').slice(-24000);
      push({ kind: 'note', text: 'compacting\u2026' });
      setBusy(true);
      try {
        const r = callModel(client, {
          model: modelRef.current,
          input: 'Summarize this coding session transcript. Sections: Goal, Done, In progress, Key files and decisions, Next step. Be dense and factual. No preamble.\n\n' + transcript,
          stopWhen: stepCountIs(1),
        } as any);
        const summary = (await (r as any).getText().catch(() => '')).trim();
        if (!summary) throw new Error('empty summary');
        carryRef.current = summary;
        const nid = newSessionId();
        switchSession(nid);
        setSid(nid);
        process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
        setItems([{ kind: 'banner' }, { kind: 'note', text: 'compacted \u00b7 ' + msgs.length + ' messages \u2192 summary' }, { kind: 'assistant', text: summary }]);
        setStaticKey((k) => k + 1);
        setTokens(0);
      } catch (e: any) {
        push({ kind: 'error', text: 'compact failed: ' + (e?.message ?? String(e)) });
      }
      setBusy(false);
      return;
    }
    if (v === '/context') {
      const limit = ctxLimit(model);
      const sys = approxTokens(buildSystemPrompt());
      const tls = toolsTokens(wrappedTools as any[]);
      const baseline = sys + tls;
      const used = Math.max(tokens, baseline);
      const pct = Math.round((used / limit) * 100);
      push({ kind: 'note', text: `context  ${bar(used, limit)}  ${used.toLocaleString()} / ${limit.toLocaleString()} (${pct}%)` });
      push({ kind: 'note', text: `  system ~${sys.toLocaleString()} · tools ~${tls.toLocaleString()} (${wrappedTools.length}) · messages ~${Math.max(0, used - baseline).toLocaleString()} · free ${(limit - used).toLocaleString()}` });
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
    const dec = decisionsRef.current;
    if (d === 'reject') {
      push({ kind: 'note', text: 'Rejected ' + call.name });
      dec.reject.push(call.id);
    } else {
      if (d === 'session' && call.name) autoApproveRef.current.add(call.name);
      dec.approve.push(call.id);
    }
    let rest = queue.slice(1);
    while (rest.length > 0 && shouldAutoApprove(rest[0]!.name)) {
      dec.approve.push(rest[0]!.id);
      rest = rest.slice(1);
    }
    if (rest.length > 0) {
      setQueue(rest);
      setPending(rest[0]!);
      return;
    }
    setQueue([]);
    setPending(null);
    decisionsRef.current = { approve: [], reject: [] };
    void drive(undefined, { approve: dec.approve, reject: dec.reject });
  }

  return (
    <Box flexDirection="column">
      <Static key={staticKey} items={items}>
        {(it, i) => (
          <Box key={i} flexDirection="column" marginBottom={it.kind === 'assistant' ? 1 : 0}>
            {it.kind === 'banner' && <Banner model={model} cwd={process.cwd()} sessionId={sid} />}
            {it.kind === 'user' && <Text color={c.user}>{'> ' + it.text}</Text>}
            {it.kind === 'assistant' && (
              <Box>
                <Text color={c.signature}>{'⏺ '}</Text>
                <Text>{it.text}</Text>
              </Box>
            )}
            {it.kind === 'tool' && <ToolCallLine name={it.name} args={it.args} />}
            {it.kind === 'result' && <ToolResultLines text={it.text} expanded={expanded} />}
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

      {mode !== 'default' && (

        <Box marginTop={1}><Text color={modeColor(mode)}>{'\u23F5\u23F5 ' + modeLabel(mode) + ' on '}</Text><Text dimColor>(shift+tab to cycle)</Text></Box>

      )}

      {!busy && !pending && (
        <Box borderStyle="round" borderColor={c.border} paddingX={1} marginTop={1}>
          <MentionInput
            value={input}
            onChange={setInput}
            onSubmit={(v: string) => { const t = v.trim(); if (t) setHistory((h) => [...h, t]); void onSubmit(v); }}
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

if (process.argv.includes('--dangerously-skip-permissions')) setMode('bypassPermissions');

async function main() {
  const mcp = await loadMcpTools();
  if (mcp.length) wrappedTools.push(...wrapAll(mcp));
  for (const st of mcpStatus) {
    process.stdout.write(st.error
      ? `  MCP ${st.name}: failed (${st.error})\n`
      : `  MCP ${st.name}: ${st.count} tools\n`);
  }
  const app = render(<App />, { exitOnCtrlC: false });
  await app.waitUntilExit();
  await closeMcp();
}

void main();
