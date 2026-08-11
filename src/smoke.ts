import { callModel, stepCountIs } from '@openrouter/agent';
import { createClient, MODELS, isTransient, sleep } from './llm/client.js';
import { readFileTool, listDirTool } from './tools/index.js';

const client = createClient();
const readOnly = [readFileTool, listDirTool] as const;

async function run(prompt: string) {
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`\n[trying ${model} attempt ${attempt + 1}]`);
        const result = callModel(client, {
          model,
          input: prompt,
          tools: readOnly,
          stopWhen: stepCountIs(8),
        });
        const text = await result.getText();
        console.log('\n--- final ---\n' + text);
        console.log('--- usage ---');
        console.log(await result.getUsage());
        return;
      } catch (err) {
        if (!isTransient(err)) throw err;
        console.log(`  transient, backing off ${2 ** attempt}s`);
        await sleep(2 ** attempt * 1000);
      }
    }
  }
  throw new Error('all models exhausted');
}

await run('List the files in the current directory, read package.json, and tell me what this project is.');
