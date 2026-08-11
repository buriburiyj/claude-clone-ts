import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export type Skill = { name: string; description: string; dir: string; skillFile: string };

let cache: Skill[] | null = null;

function parseFrontmatter(text: string): { name?: string; description?: string } {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m || !m[1]) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+)\s*:\s*(.+)$/);
    if (kv && kv[1] && kv[2]) out[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { name: out['name'], description: out['description'] };
}

function scanDir(skillsDir: string, found: Skill[]): void {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(skillsDir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = path.join(skillsDir, e.name);
    const skillFile = path.join(dir, 'SKILL.md');
    let content: string;
    try { content = fs.readFileSync(skillFile, 'utf8'); } catch { continue; }
    const fm = parseFrontmatter(content);
    const first = content.replace(/^---[\s\S]*?---\s*/, '').split('\n').find((l) => l.trim());
    const name = fm.name || e.name;
    if (found.some((s) => s.name === name)) continue;
    found.push({ name, description: fm.description || (first ? first.slice(0, 120) : ''), dir, skillFile });
  }
}

export function scanSkills(): Skill[] {
  if (cache) return cache;
  const found: Skill[] = [];
  scanDir(path.join(process.cwd(), '.claude', 'skills'), found);
  scanDir(path.join(os.homedir(), '.claude-clone', 'skills'), found);
  cache = found;
  return cache;
}

export function findSkill(name: string): Skill | undefined {
  return scanSkills().find((x) => x.name === name);
}

export function clearSkillCache(): void { cache = null; }

export function skillsSection(): string {
  const list = scanSkills();
  if (!list.length) return '';
  const lines = list.map((s) => `- ${s.name}: ${s.description}`).join('\n');
  return `\n# Available skills\nThese skills contain required procedures. When a request matches a skill
description, you MUST call read_skill with that name FIRST, before any
other tool, and then follow its instructions exactly. Do not improvise
your own approach when a matching skill exists.\n${lines}\n`;
}
