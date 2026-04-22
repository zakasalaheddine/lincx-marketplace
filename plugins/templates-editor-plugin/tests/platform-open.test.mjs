import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOpenCommand } from '../scripts/platform-open.mjs';

test('resolveOpenCommand returns `open` on darwin', () => {
  assert.deepEqual(resolveOpenCommand('darwin', 'preview.html'), { cmd: 'open', args: ['preview.html'] });
});

test('resolveOpenCommand returns `xdg-open` on linux', () => {
  assert.deepEqual(resolveOpenCommand('linux', 'preview.html'), { cmd: 'xdg-open', args: ['preview.html'] });
});

test('resolveOpenCommand returns cmd.exe start on win32', () => {
  const result = resolveOpenCommand('win32', 'preview.html');
  assert.equal(result.cmd, 'cmd.exe');
  assert.deepEqual(result.args, ['/c', 'start', '""', 'preview.html']);
});

test('resolveOpenCommand returns null on unknown platform', () => {
  assert.equal(resolveOpenCommand('aix', 'preview.html'), null);
});
