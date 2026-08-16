#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const built = join(root, 'dist', 'cli.js');

if (existsSync(built)) {
  await import(built);
} else {
  const { spawnSync } = await import('node:child_process');
  const tsx = join(root, 'node_modules', '.bin', 'tsx');
  const r = spawnSync(tsx, [join(root, 'src', 'cli.tsx'), ...process.argv.slice(2)], { stdio: 'inherit' });
  process.exit(r.status ?? 0);
}
