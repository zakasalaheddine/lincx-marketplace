import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, '..');

test('check-plugin exits zero on a valid plugin tree', () => {
  const res = spawnSync('node', ['scripts/check-plugin.mjs'], {
    cwd: pluginRoot,
    encoding: 'utf8',
  });
  assert.equal(res.status, 0, `stderr:\n${res.stderr}\nstdout:\n${res.stdout}`);
});
