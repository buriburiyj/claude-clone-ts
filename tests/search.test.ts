import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { grepTool, globTool } from '../src/tools/search.js';

const DIR = 'tests/tmpfix';
const g = (a: any) => (grepTool as any).function.execute(a);
const gl = (a: any) => (globTool as any).function.execute(a);

before(async () => {
  await mkdir(DIR, { recursive: true });
  await writeFile(`${DIR}/a.ts`, '// header\nconst zzMarker = 1;\nexport default 1;\n');
  await writeFile(`${DIR}/b.ts`, 'export const other = 2;\n');
  await writeFile(`${DIR}/c.md`, 'zzMarker in markdown\n');
});

after(async () => { await rm(DIR, { recursive: true, force: true }); });

test('grep: finds matches across file types', async () => {
  const r = await g({ pattern: 'zzMarker', glob: `${DIR}/**/*` });
  assert.equal(r.count, 2);
  assert.equal(r.truncated, false);
});

test('grep: match format is file:line:text', async () => {
  const r = await g({ pattern: 'zzMarker', glob: `${DIR}/**/*.ts` });
  assert.deepEqual(r.matches, [`${DIR}/a.ts:2:const zzMarker = 1;`]);
});

test('grep: glob narrows the file set', async () => {
  const r = await g({ pattern: 'zzMarker', glob: `${DIR}/**/*.md` });
  assert.equal(r.count, 1);
  assert.ok(r.matches[0].endsWith('c.md:1:zzMarker in markdown'));
});

test('grep: no match returns empty result', async () => {
  const r = await g({ pattern: 'nothingHereAtAll', glob: `${DIR}/**/*` });
  assert.equal(r.count, 0);
  assert.deepEqual(r.matches, []);
});

test('grep: bad regex returns error instead of throwing', async () => {
  const r = await g({ pattern: '[unclosed', glob: `${DIR}/**/*` });
  assert.match(r.error, /^bad regex: /);
  assert.equal(r.matches, undefined);
});

test('grep: ignoreCase option works', async () => {
  const off = await g({ pattern: 'ZZMARKER', glob: `${DIR}/**/*` });
  assert.equal(off.count, 0);
  const on = await g({ pattern: 'ZZMARKER', glob: `${DIR}/**/*`, ignoreCase: true });
  assert.equal(on.count, 2);
});

test('grep: pattern is a regex, not a literal', async () => {
  const r = await g({ pattern: 'zz(Marker|Nope)', glob: `${DIR}/**/*.ts` });
  assert.equal(r.count, 1);
});

test('glob: returns matching files with total', async () => {
  const r = await gl({ pattern: `${DIR}/**/*.ts` });
  assert.equal(r.total, 2);
  assert.deepEqual(r.files.sort(), [`${DIR}/a.ts`, `${DIR}/b.ts`]);
});

test('glob: no match returns empty list', async () => {
  const r = await gl({ pattern: `${DIR}/**/*.rs` });
  assert.equal(r.total, 0);
  assert.deepEqual(r.files, []);
});
