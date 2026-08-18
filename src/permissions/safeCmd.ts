const READONLY = [
  'ls', 'pwd', 'cat', 'head', 'tail', 'wc', 'file', 'stat', 'which',
  'echo', 'date', 'whoami', 'env', 'tree', 'du', 'df',
  'git status', 'git diff', 'git log', 'git show', 'git branch',
  'npm ls', 'node --version', 'npm --version',
  'agent-browser snapshot', 'agent-browser get', 'agent-browser is',
  'agent-browser console', 'agent-browser errors',
  'agent-browser skills', 'agent-browser session', 'agent-browser --version',
];

const FORBIDDEN = /[;&|><`$(){}[\]!*?~\n\r\\]/;

/** 읽기 전용으로 확실한 명령만 true. 애매하면 무조건 false. */
export function isReadOnlyCmd(cmd: string): boolean {
  const c = (cmd ?? '').trim();
  if (!c) return false;
  if (FORBIDDEN.test(c)) return false;
  return READONLY.some(p => c === p || c.startsWith(p + ' '));
}

/**
 * 인자에 따라 위험도가 달라지는 도구들. 이름 단위 세션 승인을 주면
 * 이후 임의 인자가 무검증 통과하므로 매 호출 확인이 필요하다.
 */
export const ARG_SENSITIVE_TOOLS = new Set([
  'bash',
  'run_applescript',
  'run_javascript',
  'execute_script',
  'run_shell_command',
]);

/** 이 도구가 "이 세션에선 묻지 않기" 대상이 될 수 있는지 */
export function isSessionApprovable(name: string): boolean {
  if (!name) return false;
  return !ARG_SENSITIVE_TOOLS.has(name);
}
