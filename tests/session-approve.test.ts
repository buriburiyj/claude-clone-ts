import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSessionApprovable, ARG_SENSITIVE_TOOLS } from '../src/permissions/safeCmd.js';

test('bash is never session-approvable', () => {
  assert.equal(isSessionApprovable('bash'), false);
});

test('applescript-style tools are never session-approvable', () => {
  assert.equal(isSessionApprovable('run_applescript'), false);
  assert.equal(isSessionApprovable('run_javascript'), false);
});

test('ordinary tools are session-approvable', () => {
  assert.equal(isSessionApprovable('edit_file'), true);
  assert.equal(isSessionApprovable('read_file'), true);
});

test('empty name is rejected', () => {
  assert.equal(isSessionApprovable(''), false);
});

test('set stays in sync with the guard', () => {
  for (const n of ARG_SENSITIVE_TOOLS) assert.equal(isSessionApprovable(n), false);
});
