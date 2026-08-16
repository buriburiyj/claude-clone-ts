import React from 'react';
import { shortId } from '../session/store.js';
import { Box, Text } from 'ink';
import { getColors, getThemeLabel } from './theme.js';

export function Banner({ model, cwd, sessionId }: { model: string; cwd: string; sessionId: string }) {
  const c = getColors();
  const short = cwd.replace(process.env.HOME ?? '', '~');
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={c.signature} paddingX={1}>
      <Box>
        <Text color={c.signature}>✻ </Text>
        <Text bold>Welcome to Claude Clone</Text>
      </Box>
      <Text dimColor>{`  ${model}`}</Text>
      <Text dimColor>{`  ${short}`}</Text>
      <Text dimColor>{`  session ${shortId(sessionId)}  ·  ${getThemeLabel()}`}</Text>
      <Box marginTop={1}>
        <Text dimColor>/help for commands · /theme to switch · /resume to continue</Text>
      </Box>
    </Box>
  );
}
