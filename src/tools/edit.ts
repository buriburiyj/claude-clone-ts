import fs from 'node:fs/promises';
import { z } from 'zod';
import { tool } from '@openrouter/agent';
import { resolveSafe, rel } from './paths.js';

export class EditError extends Error {}

/** Pure: exact-match replacement. Throws when not found or ambiguous. */
export function applyEdit(
  content: string,
  oldText: string,
  newText: string,
  replaceAll = false,
): { text: string; count: number } {
  if (oldText === '') throw new EditError('old_text must not be empty');
  if (oldText === newText) throw new EditError('old_text and new_text are identical');
  const parts = content.split(oldText);
  const count = parts.length - 1;
  if (count === 0) throw new EditError('old_text not found in file (whitespace must match exactly)');
  if (count > 1 && !replaceAll)
    throw new EditError(`old_text matched ${count} times; add more context or set replace_all`);
  return { text: replaceAll ? parts.join(newText) : content.replace(oldText, newText), count };
}

export const editFileTool = tool({
  name: 'edit_file',
  description:
    'Replace an exact string in a file. old_text must match the file byte-for-byte, including indentation, and must be unique unless replace_all is true. Use this instead of write_file for any change to an existing file.',
  inputSchema: z.object({
    path: z.string(),
    old_text: z.string(),
    new_text: z.string(),
    replace_all: z.boolean().optional(),
  }),
  requireApproval: true,
  timeoutMs: 30_000,
  execute: async ({ path: p, old_text, new_text, replace_all }) => {
    const abs = resolveSafe(p);
    const before = await fs.readFile(abs, 'utf8');
    const { text, count } = applyEdit(before, old_text, new_text, replace_all ?? false);
    await fs.writeFile(abs, text, 'utf8');
    return { path: rel(abs), replacements: count, lines: text.split('\n').length };
  },
});
