import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/** Pure: KEY=VALUE 텍스트를 파싱한다. 주석/빈 줄/따옴표/export 접두어를 처리. */
export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.replace(/^export\s+/, '').match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || !m[1]) continue;
    let v = (m[2] ?? '').trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    } else {
      v = v.split(/\s+#/)[0]!.trim();
    }
    out[m[1]] = v;
  }
  return out;
}

/** 이미 셸에 있는 값이 항상 이긴다. 파일은 폴백일 뿐. */
export function applyEnv(vars: Record<string, string>, env = process.env): string[] {
  const added: string[] = [];
  for (const [k, v] of Object.entries(vars)) {
    if (env[k] === undefined || env[k] === '') { env[k] = v; added.push(k); }
  }
  return added;
}

export const ENV_FILES = [
  join(process.cwd(), '.env'),
  join(homedir(), '.claude-clone', '.env'),
];

/** 앞쪽 파일이 우선. 처음 존재하는 파일만 읽는다. */
export function loadEnv(): { file?: string; keys: string[] } {
  for (const f of ENV_FILES) {
    if (!existsSync(f)) continue;
    try {
      return { file: f, keys: applyEnv(parseEnv(readFileSync(f, 'utf8'))) };
    } catch { /* try next */ }
  }
  return { keys: [] };
}
