import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPlanBlocked } from '../src/permissions/safeCmd.js';

test('plan mode blocks writes', () => {
  assert.equal(isPlanBlocked('edit_file', { path: 'a' }), true);
  assert.equal(isPlanBlocked('write_file', { path: 'a' }), true);
});

test('plan mode blocks mutating bash but allows read-only bash', () => {
  assert.equal(isPlanBlocked('bash', { command: 'agent-browser click @e2' }), true);
  assert.equal(isPlanBlocked('bash', { command: 'rm -rf /tmp/x' }), true);
  assert.equal(isPlanBlocked('bash', { command: 'git status' }), false);
  assert.equal(isPlanBlocked('bash', { command: 'agent-browser snapshot' }), false);
});

test('plan mode blocks all MCP tools, name tells nothing', () => {
  assert.equal(isPlanBlocked('mcp__filesystem__write_file'), true);
  assert.equal(isPlanBlocked('mcp__filesystem__read_file'), true);
});

test('read tools fall through to the normal approval path', () => {
  assert.equal(isPlanBlocked('read_file', { path: 'a' }), false);
  assert.equal(isPlanBlocked(''), false);
});
