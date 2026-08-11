import fs from 'node:fs/promises';
import path from 'node:path';
import { tool } from '@openrouter/agent';
import { z } from 'zod';
import { resolveSafe, rel } from './paths.js';

const MAX_LINES = 1000;

export const readFileTool = tool({
  name: 'read_file',
  description: 'Read the contents of a file. Returns up to 1000 lines.',
  inputSchema: z.object({
    path: z.string().describe('File path relative to the working directory'),
  }),
  execute: async ({ path: p }) => {
    const abs = resolveSafe(p);
    const raw = await fs.readFile(abs, 'utf8');
    const all = raw.split('\n');
    const truncated = all.length > MAX_LINES;
    const lines = truncated ? all.slice(0, MAX_LINES) : all;
    return {
      path: rel(abs),
      content: lines.join('\n'),
      lines: lines.length,
      truncated,
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
