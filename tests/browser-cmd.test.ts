import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isReadOnlyCmd } from '../src/permissions/safeCmd.js';

test('agent-browser read-only subcommands pass', () => {
  for (const c of [
    'agent-browser snapshot -i',
    'agent-browser get text @e1',
    'agent-browser console',
    'agent-browser skills list',
  ]) assert.equal(isReadOnlyCmd(c), true, c);
});

test('mutating and navigating subcommands still need approval', () => {
  for (const c of [
    'agent-browser open https://example.com',
    'agent-browser read https://example.com',
    'agent-browser click @e2',
    'agent-browser fill @e3 hi',
    'agent-browser eval return 1',
    'agent-browser close',
  ]) assert.equal(isReadOnlyCmd(c), false, c);
});

test('shell metacharacters are not smuggled through the browser prefix', () => {
  for (const c of [
    'agent-browser snapshot; rm -rf /tmp/x',
    'agent-browser get text @e1 | sh',
    'agent-browser snapshot $(whoami)',
  ]) assert.equal(isReadOnlyCmd(c), false, c);
});

test('prefix is not a bare substring match', () => {
  assert.equal(isReadOnlyCmd('agent-browser-evil snapshot'), false);
  assert.equal(isReadOnlyCmd('agent-browser'), false);
});
