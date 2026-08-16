const READONLY = [
  'ls', 'pwd', 'cat', 'head', 'tail', 'wc', 'file', 'stat', 'which',
  'echo', 'date', 'whoami', 'env', 'tree', 'du', 'df',
  'git status', 'git diff', 'git log', 'git show', 'git branch',
  'npm ls', 'node --version', 'npm --version',
];

const FORBIDDEN = /[;&|><`$(){}[\]!*?~\n\r\\]/;

/** 읽기 전용으로 확실한 명령만 true. 애매하면 무조건 false. */
export function isReadOnlyCmd(cmd: string): boolean {
  const c = (cmd ?? '').trim();
  if (!c) return false;
  if (FORBIDDEN.test(c)) return false;
  return READONLY.some(p => c === p || c.startsWith(p + ' '));
}
