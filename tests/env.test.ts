import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv, applyEnv } from '../src/config/env.js';

test('parses plain pairs', () => {
  assert.deepEqual(parseEnv('A=1\nB=two'), { A: '1', B: 'two' });
});

test('ignores comments and blank lines', () => {
  assert.deepEqual(parseEnv('# c\n\nA=1\n'), { A: '1' });
});

test('strips quotes and export prefix', () => {
  assert.deepEqual(parseEnv('export A="x y"\nB=\'z\''), { A: 'x y', B: 'z' });
});

test('strips trailing comment on unquoted value', () => {
  assert.deepEqual(parseEnv('A=1 # note'), { A: '1' });
});

test('keeps hash inside quoted value', () => {
  assert.deepEqual(parseEnv('A="a#b"'), { A: 'a#b' });
});

test('shell env wins over file', () => {
  const env: any = { A: 'shell' };
  const added = applyEnv({ A: 'file', B: 'file' }, env);
  assert.equal(env.A, 'shell');
  assert.equal(env.B, 'file');
  assert.deepEqual(added, ['B']);
});

test('empty shell value is overwritten', () => {
  const env: any = { A: '' };
  applyEnv({ A: 'file' }, env);
  assert.equal(env.A, 'file');
});
