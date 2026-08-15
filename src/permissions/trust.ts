import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const DIR = join(homedir(), '.claude-clone');
const FILE = join(DIR, 'trusted.json');

async function read(): Promise<string[]> {
  try {
    const raw = await readFile(FILE, 'utf8');
    const j = JSON.parse(raw);
    return Array.isArray(j?.paths) ? j.paths.map(String) : [];
  } catch {
    return [];
  }
}

export async function isTrusted(dir: string): Promise<boolean> {
  const target = resolve(dir);
  return (await read()).some((p) => resolve(p) === target);
}

export async function trust(dir: string): Promise<void> {
  const target = resolve(dir);
  const cur = await read();
  if (cur.some((p) => resolve(p) === target)) return;
  cur.push(target);
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify({ paths: cur }, null, 2));
}

/** 홈이나 루트처럼 범위가 지나치게 넓은 위치인지 */
export function isRisky(dir: string): boolean {
  const t = resolve(dir);
  return t === resolve(homedir()) || t === '/' || t.split('/').filter(Boolean).length <= 1;
}
