import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  serializeConversationState,
  deserializeConversationState,
  generateConversationId,
} from '@openrouter/agent';

export const SESSION_DIR = path.join(os.homedir(), '.claude-clone', 'sessions');

export type SessionMeta = {
  id: string;
  cwd: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  turns: number;
};

function file(id: string) {
  return path.join(SESSION_DIR, `${id}.json`);
}

/** 파일에 저장되는 StateAccessor. 매 save 마다 디스크에 기록 */
export function fileState(id: string, meta: Partial<SessionMeta> = {}) {
  let cached: any = null;
  const m: SessionMeta = {
    id,
    cwd: process.cwd(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    title: '',
    turns: 0,
    ...meta,
  };

  return {
    meta: m,
    accessor: {
      load: async () => {
        if (cached) return cached;
        try {
          const raw = await fs.readFile(file(id), 'utf8');
          const parsed = JSON.parse(raw);
          cached = deserializeConversationState(parsed.state as any);
          Object.assign(m, parsed.meta ?? {});
          return cached;
        } catch {
          return null;
        }
      },
      save: async (s: any) => {
        cached = s;
        m.updatedAt = Date.now();
        m.turns = (s?.messages?.length ?? 0);
        await fs.mkdir(SESSION_DIR, { recursive: true });
        await fs.writeFile(
          file(id),
          JSON.stringify({ meta: m, state: serializeConversationState(s) }, null, 2),
          'utf8',
        );
      },
    },
  };
}

export function newSessionId(): string {
  return generateConversationId();
}

export async function listSessions(): Promise<SessionMeta[]> {
  try {
    const names = await fs.readdir(SESSION_DIR);
    const out: SessionMeta[] = [];
    for (const n of names.filter((x) => x.endsWith('.json'))) {
      try {
        const raw = JSON.parse(await fs.readFile(path.join(SESSION_DIR, n), 'utf8'));
        if (raw.meta) out.push(raw.meta);
      } catch {}
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function deleteSession(id: string): Promise<void> {
  await fs.rm(file(id), { force: true });
}

/** conv_e84ad2d3-... -> conv_e84 (표시용) */
export function shortId(id: string): string {
  return 'conv_' + (id ?? '').replace(/^conv_/, '').slice(0, 3);
}
