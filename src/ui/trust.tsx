import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { getColors } from './theme.js';

const OPTIONS = [
  { key: 'yes', label: 'Yes, trust this directory' },
  { key: 'no', label: 'No, exit' },
] as const;

export function TrustDialog({
  dir,
  risky,
  onDecide,
}: {
  dir: string;
  risky: boolean;
  onDecide: (trusted: boolean) => void;
}) {
  const c = getColors();
  const [cursor, setCursor] = useState(0);
  useInput((input, key) => {
    if (key.upArrow) setCursor((i) => Math.max(0, i - 1));
    else if (key.downArrow) setCursor((i) => Math.min(OPTIONS.length - 1, i + 1));
    else if (key.return) onDecide(OPTIONS[cursor]!.key === 'yes');
    else if (key.escape) onDecide(false);
    else if (input === '1') onDecide(true);
    else if (input === '2') onDecide(false);
  });
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={c.signature} paddingX={1}>
      <Text bold color={c.signature}>Do you trust this directory?</Text>
      <Text>{dir}</Text>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>The agent can read, edit, and run commands here.</Text>
        {risky && <Text color="red">This is a very broad location. Consider a project folder instead.</Text>}
      </Box>
      <Box marginTop={1} flexDirection="column">
        {OPTIONS.map((o, i) => (
          <Text key={o.key} color={i === cursor ? c.signature : undefined}>
            {(i === cursor ? '> ' : '  ') + (i + 1) + '. ' + o.label}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
