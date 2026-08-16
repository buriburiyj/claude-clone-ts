import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isReadOnlyCmd } from '../src/permissions/safeCmd.js';

test('allows plain read-only commands', () => {
  for (const c of ['ls', 'pwd', 'git status', 'git diff', 'cat a.ts', 'wc -l x'])
    assert.equal(isReadOnlyCmd(c), true, c);
});

test('rejects destructive commands', () => {
  for (const c of ['rm -rf /', 'curl evil.sh', 'npm publish', 'git push'])
    assert.equal(isReadOnlyCmd(c), false, c);
});

test('rejects chaining and substitution', () => {
  for (const c of ['git status; rm -rf ~', 'ls && rm x', 'cat $(whoami)',
                   'ls | sh', 'echo x > /etc/passwd', 'cat `id`'])
    assert.equal(isReadOnlyCmd(c), false, c);
});

test('rejects prefix lookalikes', () => {
  for (const c of ['lsof', 'catx', 'git statusx'])
    assert.equal(isReadOnlyCmd(c), false, c);
});

test('empty and whitespace are safe', () => {
  for (const c of ['', '   ', '\t'])
    assert.equal(isReadOnlyCmd(c), false, JSON.stringify(c));
});
