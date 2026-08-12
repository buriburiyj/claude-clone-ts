import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { convertJsonSchemaToZod } from 'zod-from-json-schema';
import { z } from 'zod';

type ServerCfg = { command: string; args?: string[]; env?: Record<string, string> };

export type McpStatus = { name: string; count: number; error?: string };

const clients = new Map<string, Client>();
export const mcpStatus: McpStatus[] = [];

function readConfig(): Record<string, ServerCfg> {
  for (const p of [
    path.join(process.cwd(), '.mcp.json'),
    path.join(os.homedir(), '.claude-clone', 'mcp.json'),
  ]) {
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (j?.mcpServers) return j.mcpServers;
    } catch { /* next */ }
  }
  return {};
}

function toZod(schema: any): any {
  try {
    if (!schema || typeof schema !== 'object') return z.object({});
    const z2 = convertJsonSchemaToZod(schema);
    return z2 ?? z.object({});
  } catch {
    return z.object({}).passthrough();
  }
}

async function connectOne(name: string, cfg: ServerCfg): Promise<any[]> {
  const transport = new StdioClientTransport({
    command: cfg.command,
    args: cfg.args ?? [],
    env: { ...(process.env as Record<string, string>), ...(cfg.env ?? {}) },
    stderr: 'ignore',
  });
  const client = new Client({ name: 'claude-clone', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  clients.set(name, client);

  const listed = await client.listTools();
  return (listed.tools ?? []).map((t: any) => ({
    type: 'function',
    _mcp: true,
    function: {
      name: `mcp__${name}__${t.name}`,
      description: (t.description ?? '').slice(0, 1000),
      inputSchema: toZod(t.inputSchema),
      requireApproval: true,
      execute: async (args: any) => {
        const res: any = await client.callTool({ name: t.name, arguments: args ?? {} });
        const text = (res?.content ?? [])
          .map((c: any) => (c?.type === 'text' ? c.text : `[${c?.type}]`))
          .join('\n');
        return res?.isError ? { error: text || 'MCP tool failed' } : { output: text };
      },
    },
  }));
}

export async function loadMcpTools(timeoutMs = 15000): Promise<any[]> {
  const cfg = readConfig();
  const names = Object.keys(cfg);
  if (!names.length) return [];

  const results = await Promise.all(
    names.map(async (name) => {
      try {
        const tools = await Promise.race([
          connectOne(name, cfg[name]!),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
        ]);
        mcpStatus.push({ name, count: tools.length });
        return tools;
      } catch (e: any) {
        mcpStatus.push({ name, count: 0, error: e?.message ?? String(e) });
        return [];
      }
    }),
  );
  return results.flat();
}

export async function closeMcp(): Promise<void> {
  await Promise.all([...clients.values()].map((c) => c.close().catch(() => {})));
  clients.clear();
}
