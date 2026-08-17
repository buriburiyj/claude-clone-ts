import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { noteEditResult, shouldStopEditing, resetEditFailures } from '../src/tools/edit.js';

beforeEach(() => resetEditFailures());

test('counts consecutive failures per file', () => {
  assert.equal(noteEditResult('a.ts', true), 1);
  assert.equal(noteEditResult('a.ts', true), 2);
  assert.equal(noteEditResult('a.ts', true), 3);
});

test('success clears the streak', () => {
  noteEditResult('a.ts', true);
  noteEditResult('a.ts', true);
  assert.equal(noteEditResult('a.ts', false), 0);
  assert.equal(noteEditResult('a.ts', true), 1);
});

test('files are tracked independently', () => {
  noteEditResult('a.ts', true);
  noteEditResult('a.ts', true);
  assert.equal(noteEditResult('b.ts', true), 1);
});

test('stops only at the third failure', () => {
  assert.equal(shouldStopEditing(2), false);
  assert.equal(shouldStopEditing(3), true);
  assert.equal(shouldStopEditing(4), true);
});
