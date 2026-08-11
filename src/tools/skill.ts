import fs from 'node:fs';
import { tool } from '@openrouter/agent';
import { z } from 'zod';
import { findSkill, scanSkills } from '../skills/loader.js';

export const skillTool = tool({
  name: 'read_skill',
  description: 'Load the full instructions for a named skill before applying it.',
  inputSchema: z.object({ name: z.string().describe('Skill name') }),
  execute: async ({ name }) => {
    const s = findSkill(name);
    if (!s) return { error: `Unknown skill: ${name}`, available: scanSkills().map((x) => x.name) };
    return { name: s.name, content: fs.readFileSync(s.skillFile, 'utf8') };
  },
});
