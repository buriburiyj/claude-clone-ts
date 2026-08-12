import { tool } from '@openrouter/agent';
import { z } from 'zod';
import fg from 'fast-glob';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { relative, join } from 'node:path';

const MAX_HITS = 60;
const IGNORE = ['node_modules/**', '.git/**', '**/*.lock', '**/package-lock.json'];

let cachedIgnore: string[] | null = null;
function ignoreList(): string[] {
  if (cachedIgnore) return cachedIgnore;
  const out = [...IGNORE];
  try {
    const gi = readFileSync(join(process.cwd(), '.gitignore'), 'utf8');
    for (const raw of gi.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.startsWith('!')) continue;
      const p = line.replace(/^\//, '').replace(/\/$/, '');
      if (!p) continue;
      out.push(p, p + '/**', '**/' + p, '**/' + p + '/**');
    }
  } catch {}
  cachedIgnore = out;
  return out;
}

export const grepTool = tool({
  name: 'grep',
  description: 'Search file contents by regex. Returns file:line:text. Use before reading whole files.',
  inputSchema: z.object({
    pattern: z.string().describe('JavaScript regex'),
    glob: z.string().optional().describe('file filter, e.g. **/*.ts'),
    ignoreCase: z.boolean().optional(),
  }),
  execute: async ({ pattern, glob, ignoreCase }: { pattern: string; glob?: string; ignoreCase?: boolean }) => {
    let re: RegExp;
    try { re = new RegExp(pattern, ignoreCase ? 'i' : ''); }
    catch (e: any) { return { error: 'bad regex: ' + (e?.message ?? String(e)) }; }
    const files = await fg(glob ?? '**/*', {
      cwd: process.cwd(), dot: false, onlyFiles: true, ignore: ignoreList(),
    });
    const matches: string[] = [];
    for (const f of files) {
      if (matches.length >= MAX_HITS) break;
      let text: string;
      try { text = await readFile(f, 'utf8'); } catch { continue; }
      if (text.includes('\u0000')) continue;
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i] ?? '';
        if (re.test(ln)) {
          matches.push(`${relative(process.cwd(), f)}:${i + 1}:${ln.trim().slice(0, 160)}`);
          if (matches.length >= MAX_HITS) break;
        }
      }
    }
    return { matches, count: matches.length, truncated: matches.length >= MAX_HITS };
  },
});

export const globTool = tool({
  name: 'glob',
  description: 'Find files by glob pattern. Returns paths only.',
  inputSchema: z.object({ pattern: z.string().describe('e.g. src/**/*.tsx') }),
  execute: async ({ pattern }: { pattern: string }) => {
    const files = await fg(pattern, {
      cwd: process.cwd(), onlyFiles: true, ignore: ignoreList(),
    });
    return { files: files.slice(0, 200), total: files.length };
  },
});
