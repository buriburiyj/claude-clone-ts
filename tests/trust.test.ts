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

test('shortId is stable and prefixed', async () => {
  const { shortId } = await import('../src/session/store.js');
  assert.equal(shortId('conv_e84ad2d3-d389-465d'), 'conv_e84');
  assert.equal(shortId('e84ad2d3-d389'), 'conv_e84');
  assert.equal(shortId(''), 'conv_');
});
