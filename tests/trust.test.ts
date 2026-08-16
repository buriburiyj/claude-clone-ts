import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { isRisky } from '../src/permissions/trust.js';

test('home and root are risky', () => {
  for (const d of [homedir(), '/', '/Users', '/tmp', '/etc'])
    assert.equal(isRisky(d), true, d);
});

test('project directories are fine', () => {
  for (const d of [join(homedir(), 'claude-clone-ts'), '/private/tmp/x', '/Users/yjun/dev/a'])
    assert.equal(isRisky(d), false, d);
});

test('trailing slash and dots normalize', () => {
  assert.equal(isRisky(homedir() + '/'), true);
  assert.equal(isRisky(join(homedir(), 'proj', '..')), true);
});
