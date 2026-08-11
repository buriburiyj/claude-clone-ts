import { execFile } from 'node:child_process';
import { tool } from '@openrouter/agent';
import { z } from 'zod';

const MAX_OUT = 30_000;

function clip(s: string): string {
  return s.length > MAX_OUT ? s.slice(0, MAX_OUT) + '\n… (truncated)' : s;
}

export const bashTool = tool({
  name: 'bash',
  description: 'Run a shell command in the working directory.',
  inputSchema: z.object({
    command: z.string(),
    timeout: z.number().default(120).describe('Timeout in seconds'),
  }),
  requireApproval: true,
  execute: async ({ command, timeout }) =>
    new Promise((resolve) => {
      execFile(
        '/bin/bash',
        ['-c', command],
        { cwd: process.cwd(), timeout: timeout * 1000, maxBuffer: 10 * 1024 * 1024 },
        (err, stdout, stderr) => {
          resolve({
            stdout: clip(stdout ?? ''),
            stderr: clip(stderr ?? ''),
            exitCode: err && typeof (err as any).code === 'number' ? (err as any).code : err ? 1 : 0,
          });
        },
      );
    }),
});
