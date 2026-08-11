import type { ConversationState, StateAccessor, Tool } from '@openrouter/agent';

/** 메모리 기반 StateAccessor. 나중에 파일 저장으로 교체 */
export function memoryState<TTools extends readonly Tool[]>(): StateAccessor<TTools> {
  let current: ConversationState<TTools> | null = null;
  return {
    load: async () => current,
    save: async (s) => {
      current = s;
    },
  };
}
