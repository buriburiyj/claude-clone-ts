import path from 'node:path';

/** cwd 밖으로 나가는 경로를 차단하고 절대경로로 변환 */
export function resolveSafe(p: string): string {
  const root = process.cwd();
  const abs = path.resolve(root, p);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error(`Path outside working directory: ${p}`);
  }
  return abs;
}

/** 표시용 상대경로 */
export function rel(abs: string): string {
  return path.relative(process.cwd(), abs) || '.';
}
