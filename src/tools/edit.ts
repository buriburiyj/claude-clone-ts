import fs from 'node:fs/promises';
import { tool } from '@openrouter/agent';
import { z } from 'zod';
import { resolveSafe, rel } from './paths.js';

export const editFileTool = tool({
  name: 'edit_file',
  description:
    'Replace an exact string in an existing file. old_string must appear exactly once.',
  inputSchema: z.object({
    path: z.string(),
    old_string: z.string().describe('Exact text to replace; must be unique in the file'),
    new_string: z.string().describe('Replacement text'),
  }),
  requireApproval: true,
  timeoutMs: 30_000,
  execute: async ({ path: p, old_string, new_string }) => {
    const abs = resolveSafe(p);
    const oldText = await fs.readFile(abs, 'utf8');

    const count = oldText.split(old_string).length - 1;
    if (count === 0) {
      throw new Error(`old_string not found in ${rel(abs)}`);
    }
    if (count > 1) {
      throw new Error(
        `old_string appears ${count} times in ${rel(abs)}; include more surrounding context to make it unique`,
      );
    }

    const newText = oldText.replace(old_string, new_string);
    await fs.writeFile(abs, newText, 'utf8');
    return { path: rel(abs), oldText, newText };
  },
});
