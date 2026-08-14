import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampOutput } from '../src/tools/truncate.js';
import { mainArg } from '../src/ui/render.js';

test('clampOutput: short text passes through', () => {
  const r = clampOutput('hello\nworld');
  assert.equal(r.text, 'hello\nworld');
  assert.equal(r.truncated, false);
});

test('clampOutput: folds head + tail', () => {
  const src = Array.from({ length: 300 }, (_, i) => 'line ' + (i + 1)).join('\n');
  const r = clampOutput(src);
  const lines = r.text.split('\n');
  assert.equal(r.truncated, true);
  assert.equal(lines.length, 71);
  assert.equal(lines[0], 'line 1');
  assert.equal(lines[49], 'line 50');
  assert.match(lines[50]!, /230 lines omitted/);
  assert.equal(lines[70], 'line 300');
});

test('clampOutput: 71 lines exactly is not folded', () => {
  const src = Array.from({ length: 71 }, (_, i) => 'l' + i).join('\n');
  assert.equal(clampOutput(src).truncated, false);
});

test('clampOutput: char cap applies', () => {
  const r = clampOutput('x'.repeat(20000), 8000);
  assert.equal(r.truncated, true);
  assert.ok(r.text.length < 9000);
});

test('mainArg: grep shows pattern and glob', () => {
  assert.equal(mainArg({ pattern: 'wrappedTools', glob: '**/*.tsx' }), 'wrappedTools, **/*.tsx');
});

test('mainArg: glob shows pattern alone', () => {
  assert.equal(mainArg({ pattern: 'src/**/*.ts' }), 'src/**/*.ts');
});

test('mainArg: read with range', () => {
  assert.equal(mainArg({ path: 'src/cli.tsx', offset: 180, limit: 60 }), 'src/cli.tsx:180-239');
});

test('mainArg: read without range', () => {
  assert.equal(mainArg({ path: 'src/cli.tsx' }), 'src/cli.tsx');
});

test('mainArg: bash shows command', () => {
  assert.equal(mainArg({ command: 'git status' }), 'git status');
});

test('mainArg: empty input is safe', () => {
  assert.equal(mainArg({}), '');
});
