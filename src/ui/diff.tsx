import React from 'react';
import { Box, Text } from 'ink';
import { diffLines, collapse } from './diffLines.js';

export function DiffView({ oldText, newText, filePath }: { oldText: string; newText: string; filePath?: string }) {
  const result = collapse(diffLines(oldText, newText));
  return (
    <Box flexDirection="column" marginLeft={2}>
      {filePath && <Box><Text dimColor>{`⎿  ${filePath}`}</Text></Box>}
      {result.map((line, idx) => {
        if (line.type === 'skip') return (<Box key={idx}><Text dimColor>{`  … +${line.count} lines`}</Text></Box>);
        if (line.type === 'add') return (<Box key={idx}><Text color="green">+ {line.text}</Text></Box>);
        if (line.type === 'del') return (<Box key={idx}><Text color="red">- {line.text}</Text></Box>);
        return (<Box key={idx}><Text dimColor>{'  ' + line.text}</Text></Box>);
      })}
    </Box>
  );
}
