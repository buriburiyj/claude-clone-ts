import { readFileSync, existsSync } from 'node:fs';
import { emitToolCall, emitToolResult, emitDiff } from '../ui/events.js';

let seq = 0;
const nextId = () => `t${++seq}`;

function readSafe(p?: string): string {
  try { return p && existsSync(p) ? readFileSync(p, 'utf8') : ''; } catch { return ''; }
}
function pathOf(input: any): string | undefined {
  return input?.path ?? input?.file_path ?? input?.filePath ?? undefined;
}
function toText(out: any): string {
  if (out == null) return '';
  if (typeof out === 'string') return out;
  if (typeof out === 'object') {
    const o: any = out;
    if (typeof o.output === 'string') return o.output;
    if (typeof o.stdout === 'string') return [o.stdout, o.stderr].filter(Boolean).join('\n').trim();
    if (typeof o.content === 'string') return o.content;
    if (typeof o.text === 'string') return o.text;
  }
  try { return JSON.stringify(out, null, 2); } catch { return String(out); }
}
function summarize(name: string, input: any, out: any): string {
  const text = toText(out);
  const n = text ? text.split('\n').length : 0;
  switch (name) {
    case 'read_file': return `Read ${n} lines`;
    case 'write_file': return `Wrote ${pathOf(input) ?? 'file'}`;
    case 'edit_file': return `Updated ${pathOf(input) ?? 'file'}`;
    case 'list_dir': case 'glob': return `${n} paths`;
    case 'grep': return `Found ${n} matches`;
    case 'read_skill': return out?.error ? out.error : `Loaded skill: ${out?.name ?? input?.name}`;
    default: return text;
  }
}

const wrapped = new WeakSet<object>();

export function withEvents<T>(entry: T): T {
  const f: any = (entry as any)?.function ?? entry;
  if (!f || typeof f.execute !== 'function' || wrapped.has(f)) return entry;
  const name: string = f.name ?? 'tool';
  const orig = f.execute.bind(f);
  f.execute = async (...args: any[]) => {
    const id = nextId();
    const input = args[0];
    const p = pathOf(input);
    const isEdit = name === 'edit_file' || name === 'write_file';
    const before = isEdit ? readSafe(p) : '';
    emitToolCall(id, name, input);
    try {
      const out = await orig(...args);
      if (isEdit && p) {
        const after = readSafe(p);
        if (after !== before) emitDiff(id, p, before, after);
      }
      const ok = !(out && typeof out === 'object' && typeof (out as any).exitCode === 'number' && (out as any).exitCode !== 0);
      emitToolResult(id, name, ok, summarize(name, input, out));
      return out;
    } catch (e: any) {
      emitToolResult(id, name, false, `Error: ${e?.message ?? String(e)}`);
      throw e;
    }
  };
  wrapped.add(f);
  return entry;
}

export function wrapAll<T extends readonly any[]>(tools: T): T {
  for (const t of tools as readonly any[]) withEvents(t);
  return tools;
}
