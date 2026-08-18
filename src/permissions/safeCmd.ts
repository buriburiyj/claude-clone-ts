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
  // MCP tools come from external servers; their argument surface is unknown here.
  if (name.startsWith('mcp__')) return false;
  return !ARG_SENSITIVE_TOOLS.has(name);
}

const PLAN_WRITE_TOOLS = new Set(['edit_file', 'write_file']);

/** plan 모드에서 막을 호출인지. 변경이 확실한 것과 판단 불가능한 것만 막고,
 *  읽기 계열은 기존 승인 경로로 흘려보낸다. */
export function isPlanBlocked(name: string, args?: any): boolean {
  if (!name) return false;
  if (PLAN_WRITE_TOOLS.has(name)) return true;
  if (name === 'bash') return !isReadOnlyCmd(args?.command ?? '');
  if (name.startsWith('mcp__')) return true;
  return false;
}
