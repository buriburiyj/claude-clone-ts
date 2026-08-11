import { OpenRouter } from '@openrouter/sdk';

export const MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'openai/gpt-oss-20b:free',
] as const;

export function createClient(): OpenRouter {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');
  return new OpenRouter({ apiKey });
}

/** 502 / ResourceExhausted 처럼 재시도 가치가 있는 에러인지 */
export function isTransient(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  return /ResourceExhausted|Response failed|Provider returned error|502|503|404|429|rate limit|timeout/i.test(m);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
