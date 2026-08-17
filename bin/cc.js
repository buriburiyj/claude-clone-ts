#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, statSync, readdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const built = join(root, 'dist', 'cli.js');
const srcDir = join(root, 'src');

/** Newest mtime under a directory, 0 if missing. */
function newest(dir) {
  if (!existsSync(dir)) return 0;
  let t = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    t = Math.max(t, e.isDirectory() ? newest(p) : statSync(p).mtimeMs);
  }
  return t;
}

const stale = existsSync(built) && newest(srcDir) > statSync(built).mtimeMs;

if (existsSync(built) && !stale) {
  await import(built);
} else {
  const { spawnSync } = await import('node:child_process');
  const tsx = join(root, 'node_modules', '.bin', 'tsx');
  if (!existsSync(tsx)) {
    console.error('dist is stale and tsx is missing. Run: npm run build');
    process.exit(1);
  }
  const r = spawnSync(tsx, [join(srcDir, 'cli.tsx'), ...process.argv.slice(2)], { stdio: 'inherit' });
  process.exit(r.status ?? 0);
}
