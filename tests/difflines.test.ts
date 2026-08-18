import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffLines, collapse } from '../src/ui/diffLines.js';

const counts = (d: ReturnType<typeof diffLines>) => ({
  add: d.filter((x) => x.type === 'add').length,
  del: d.filter((x) => x.type === 'del').length,
  same: d.filter((x) => x.type === 'same').length,
});

test('inserting one line marks only that line', () => {
  const a = 'a\nb\nc\nd\ne';
  const b = 'a\nb\nX\nc\nd\ne';
  assert.deepEqual(counts(diffLines(a, b)), { add: 1, del: 0, same: 5 });
});

test('deleting one line marks only that line', () => {
  const a = 'a\nb\nc\nd\ne';
  const b = 'a\nb\nd\ne';
  assert.deepEqual(counts(diffLines(a, b)), { add: 0, del: 1, same: 4 });
});

test('changing one line in the middle keeps the rest same', () => {
  const a = 'a\nb\nc\nd\ne';
  const b = 'a\nb\nZ\nd\ne';
  assert.deepEqual(counts(diffLines(a, b)), { add: 1, del: 1, same: 4 });
});

test('identical text has no changes', () => {
  const d = diffLines('a\nb\nc', 'a\nb\nc');
  assert.deepEqual(counts(d), { add: 0, del: 0, same: 3 });
});

test('applying the diff reconstructs both sides', () => {
  const a = 'one\ntwo\nthree\nfour';
  const b = 'one\ntwo point five\nthree\nfour\nfive';
  const d = diffLines(a, b);
  assert.equal(d.filter((x) => x.type !== 'add').map((x) => x.text).join('\n'), a);
  assert.equal(d.filter((x) => x.type !== 'del').map((x) => x.text).join('\n'), b);
});

test('huge middle falls back without hanging', () => {
  const a = Array.from({ length: 900 }, (_, i) => `a${i}`).join('\n');
  const b = Array.from({ length: 900 }, (_, i) => `b${i}`).join('\n');
  const d = diffLines(a, b);
  assert.equal(counts(d).same, 0);
});

test('collapse keeps context around changes and folds the rest', () => {
  const a = Array.from({ length: 40 }, (_, i) => `l${i}`).join('\n');
  const b = a.replace('l20', 'CHANGED');
  const c = collapse(diffLines(a, b));
  const skips = c.filter((x) => x.type === 'skip');
  assert.equal(skips.length, 2);
  assert.equal(c.filter((x) => x.type !== 'skip').length, 8);
});

test('collapse leaves short diffs alone', () => {
  const c = collapse(diffLines('a\nb', 'a\nZ'));
  assert.equal(c.filter((x) => x.type === 'skip').length, 0);
});
