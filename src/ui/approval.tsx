import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { getColors } from './theme.js';
import { displayName } from './render.js';
import { DiffView } from './diff.js';
import { isSessionApprovable } from '../permissions/safeCmd.js';

export type PendingCall = { id: string; name: string; arguments: Record<string, unknown> };
export type Decision = 'once' | 'session' | 'reject';

const OPTIONS: { key: Decision; label: string }[] = [
  { key: 'once', label: 'Yes' },
  { key: 'session', label: "Yes, and don't ask again this session" },
  { key: 'reject', label: 'No, tell Claude what to do differently' },
];

export function ApprovalDialog({
  call,
  preview,
  onDecide,
}: {
  call: PendingCall;
  preview?: { oldText: string; newText: string; path: string };
  onDecide: (d: Decision) => void;
}) {
  const c = getColors();
  const [cursor, setCursor] = useState(0);
  const sessionOk = isSessionApprovable(call.name);
  const options = sessionOk ? OPTIONS : OPTIONS.filter((o) => o.key !== 'session');

  useInput((input, key) => {
    if (key.upArrow) setCursor((i) => (i - 1 + options.length) % options.length);
    else if (key.downArrow) setCursor((i) => (i + 1) % options.length);
    else if (key.return) onDecide(options[cursor]!.key);
    else if (key.escape) onDecide('reject');
    else if (input >= '1' && Number(input) <= options.length) onDecide(options[Number(input) - 1]!.key);
  });

  const args = call.arguments;
  const detail =
    call.name === 'bash'
      ? String(args.command ?? '')
      : String(args.path ?? '');

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={c.signature} paddingX={1}>
      <Text bold color={c.signature}>
        {displayName(call.name)}
      </Text>
      <Text>{detail}</Text>
      {preview && (
        <Box marginTop={1}>
          <DiffView oldText={preview.oldText} newText={preview.newText} />
        </Box>
      )}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Do you want to proceed?</Text>
        {options.map((o, i) => (
          <Text key={o.key} color={i === cursor ? c.signature : undefined}>
            {i === cursor ? '❯ ' : '  '}
            {i + 1}. {o.label}
          </Text>
        ))}
        {!sessionOk && (
          <Text dimColor>
            This tool takes arguments, so a session-wide yes would cover calls you
            have not seen. Approve each one.
          </Text>
        )}
      </Box>
    </Box>
  );
}
