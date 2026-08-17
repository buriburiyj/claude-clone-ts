import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterDiagnostics } from '../src/tools/verify.js';

const sample = [
  "src/cli.tsx(12,5): error TS2304: Cannot find name 'foo'.",
  "src/other.ts(3,1): error TS2345: Argument of type 'x'.",
  "Found 2 errors in 2 files.",
].join('\n');

test('keeps only the edited file', () => {
  const r = filterDiagnostics(sample, ['src/cli.tsx']);
  assert.equal(r.length, 1);
  assert.match(r[0]!, /TS2304/);
});

test('returns empty when the file is clean', () => {
  assert.deepEqual(filterDiagnostics(sample, ['src/clean.ts']), []);
});

test('ignores summary lines', () => {
  const r = filterDiagnostics(sample, ['src/cli.tsx', 'src/other.ts']);
  assert.equal(r.length, 2);
  assert.ok(!r.some((l) => l.includes('Found 2 errors')));
});

test('caps at 20 diagnostics', () => {
  const many = Array.from({ length: 30 }, (_, i) => `a.ts(${i},1): error TS1005: ';' expected.`).join('\n');
  assert.equal(filterDiagnostics(many, ['a.ts']).length, 20);
});
