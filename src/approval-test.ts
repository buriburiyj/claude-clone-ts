import { callModel, stepCountIs } from '@openrouter/agent';
import { createClient, MODELS } from './llm/client.js';
import { tools } from './tools/index.js';
import { memoryState } from './session/state.js';

const client = createClient();
const state = memoryState<typeof tools>();
const model = MODELS[0]!;

const first = callModel(client, {
  model,
  input: 'Create a file named greet.txt containing the text "hello".',
  tools,
  state,
  stopWhen: stepCountIs(6),
});
await first.getText().catch(() => {});
await first.getResponse().catch(() => {});

const s1 = (await state.load()) as any;
console.log('status:', s1?.status);
const pending = s1?.pendingToolCalls ?? [];
for (const p of pending) {
  console.log(`  ${p.name}(${JSON.stringify(p.arguments)})  id=${p.id}`);
}
if (pending.length === 0) {
  console.log('nothing pending');
  process.exit(0);
}

console.log('\n--- approving ---');
const second = callModel(client, {
  model,
  tools,
  state,
  approveToolCalls: pending.map((p: any) => p.id),
  stopWhen: stepCountIs(6),
});
const text = await second.getText();
await second.getResponse().catch(() => {});
console.log('\n--- final ---\n' + text);
console.log('status after:', ((await state.load()) as any)?.status);
