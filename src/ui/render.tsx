import React from 'react';
import { Box, Text } from 'ink';
import { getColors } from './theme.js';

export const BULLET = process.platform === 'darwin' ? '⏺' : '●';

const TOOL_NAMES: Record<string, string> = {
  read_file: 'Read',
  write_file: 'Write',
  edit_file: 'Update',
  list_dir: 'List',
  bash: 'Bash',
};

export function displayName(name: string): string {
  return TOOL_NAMES[name] ?? name;
}

export function mainArg(args: Record<string, unknown>): string {
  const v = args.path ?? args.command ?? '';
  const s = String(v);
  return s.length > 60 ? s.slice(0, 57) + '…' : s;
}

export function ToolCallLine({ name, args }: { name: string; args: Record<string, unknown> }) {
  const c = getColors();
  return (
    <Box>
      <Text color={c.signature}>{BULLET} </Text>
      <Text bold>{displayName(name)}</Text>
      <Text>({mainArg(args)})</Text>
    </Box>
  );
}

export function summarize(name: string, result: any): string {
  if (result == null) return 'done';
  if (name === 'read_file') return `Read ${result.lines} lines`;
  if (name === 'write_file') return `Wrote ${result.lines} lines to ${result.path}`;
  if (name === 'list_dir') return `${result.count} entries`;
  if (name === 'edit_file') return `Updated ${result.path}`;
  if (name === 'bash') {
    const out = (result.stdout || result.stderr || '').trimEnd();
    return out || `exit ${result.exitCode}`;
  }
  return typeof result === 'string' ? result : JSON.stringify(result);
}

const MAX_RESULT_LINES = 5;

export function ToolResultLines({ text }: { text: string }) {
  const all = text.split('\n');
  const shown = all.slice(0, MAX_RESULT_LINES);
  const hidden = all.length - shown.length;
  return (
    <Box flexDirection="column">
      {shown.map((line, i) => (
        <Text key={i} dimColor>
          {i === 0 ? '  ⎿  ' : '     '}
          {line}
        </Text>
      ))}
      {hidden > 0 && (
        <Text dimColor>{`     … +${hidden} lines (ctrl+o to expand)`}</Text>
      )}
    </Box>
  );
}

export function ErrorLine({ text }: { text: string }) {
  const c = getColors();
  return <Text color={c.error}>{`  ⎿  ${text}`}</Text>;
}
