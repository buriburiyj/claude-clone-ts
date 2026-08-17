import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEdit, EditError } from '../src/tools/edit.js';

test('replaces a unique match', () => {
  const r = applyEdit('a\nfoo\nb', 'foo', 'bar');
  assert.equal(r.text, 'a\nbar\nb');
  assert.equal(r.count, 1);
});

test('throws when not found', () => {
  assert.throws(() => applyEdit('abc', 'xyz', 'q'), EditError);
});

test('throws on ambiguous match', () => {
  assert.throws(() => applyEdit('x\nx', 'x', 'y'), EditError);
});

test('replace_all handles multiple matches', () => {
  const r = applyEdit('x\nx\nx', 'x', 'y', true);
  assert.equal(r.text, 'y\ny\ny');
  assert.equal(r.count, 3);
});

test('indentation must match exactly', () => {
  assert.throws(() => applyEdit('  const a = 1;', 'const a = 1;\n', 'const a = 2;'), EditError);
  assert.equal(applyEdit('  const a = 1;', '  const a = 1;', '  const a = 2;').text, '  const a = 2;');
});

test('rejects empty and identical old_text', () => {
  assert.throws(() => applyEdit('abc', '', 'x'), EditError);
  assert.throws(() => applyEdit('abc', 'a', 'a'), EditError);
});
