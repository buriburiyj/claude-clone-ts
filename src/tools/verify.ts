import { execFile } from 'node:child_process';

/** Pure: keep only tsc diagnostics for the given files. */
export function filterDiagnostics(out: string, files: string[]): string[] {
  const want = files.map((f) => f.replace(/^\.\//, ''));
  return out
    .split('\n')
    .filter((l) => /error TS\d+/.test(l))
    .filter((l) => want.some((f) => l.startsWith(f + '(') || l.includes('/' + f + '(')))
    .slice(0, 20);
}

/** Runs tsc --noEmit and returns diagnostics for the edited files only. */
export async function typecheck(files: string[], timeoutMs = 60_000): Promise<string[]> {
  if (files.every((f) => !/\.tsx?$/.test(f))) return [];
  const out = await new Promise<string>((resolve) => {
    execFile(
      'npx',
      ['tsc', '--noEmit', '--pretty', 'false'],
      { cwd: process.cwd(), timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 },
      (_err, stdout, stderr) => resolve((stdout ?? '') + (stderr ?? '')),
    );
  });
  return filterDiagnostics(out, files);
}
