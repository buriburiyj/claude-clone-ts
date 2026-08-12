import fs from 'node:fs/promises';
import path from 'node:path';
import { tool } from '@openrouter/agent';
import { z } from 'zod';
import { resolveSafe, rel } from './paths.js';

const MAX_LINES = 1000;

export const readFileTool = tool({
  name: 'read_file',
  description:
    'Read a file. Use offset/limit to read only part of a large file; ' +
    'locate the region with grep first instead of reading the whole file.',
  inputSchema: z.object({
    path: z.string().describe('File path relative to the working directory'),
    offset: z.number().int().min(1).optional().describe('1-based first line to return'),
    limit: z.number().int().min(1).optional().describe('max number of lines to return'),
  }),
  execute: async ({ path: p, offset, limit }) => {
    const abs = resolveSafe(p);
    const raw = await fs.readFile(abs, 'utf8');
    const all = raw.split('\n');
    const start = Math.max(0, (offset ?? 1) - 1);
    const DEFAULT_LIMIT = 200;
    const max = Math.min(limit ?? DEFAULT_LIMIT, MAX_LINES);
    const lines = all.slice(start, start + max);
    const end = start + lines.length;
    return {
      path: rel(abs),
      content: lines.join('\n'),
      lines: lines.length,
      range: `${start + 1}-${end}`,
      totalLines: all.length,
      truncated: end < all.length,
      ...(end < all.length
        ? { hint: `${all.length - end} more lines. Re-read with offset/limit for the region you need.` }
        : {}),
    };
  },
});

export const writeFileTool = tool({
  name: 'write_file',
  description:
    'Create a new file or overwrite an existing one. For modifying part of an existing file, prefer edit_file.',
  inputSchema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  requireApproval: true,
  execute: async ({ path: p, content }) => {
    const abs = resolveSafe(p);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
    return {
      path: rel(abs),
      bytes: Buffer.byteLength(content, 'utf8'),
      lines: content.split('\n').length,
    };
  },
});

export const listDirTool = tool({
  name: 'list_dir',
  description: 'List files and directories at a path.',
  inputSchema: z.object({
    path: z.string().default('.'),
  }),
  execute: async ({ path: p }) => {
    const abs = resolveSafe(p);
    const items = await fs.readdir(abs, { withFileTypes: true });
    const entries = items
      .filter((e) => !e.name.startsWith('.'))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
    return { path: rel(abs), entries, count: entries.length };
  },
});
