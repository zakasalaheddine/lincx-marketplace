#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, '..');

const errors = [];
function check(cond, msg) { if (!cond) errors.push(msg); }

const manifestPath = join(pluginRoot, '.claude-plugin', 'plugin.json');
check(existsSync(manifestPath), `missing: ${manifestPath}`);
if (existsSync(manifestPath)) {
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
  check(typeof m.name === 'string' && m.name.length > 0, 'plugin.json: name required');
  check(typeof m.version === 'string' && m.version.length > 0, 'plugin.json: version required');
  check(typeof m.description === 'string' && m.description.length > 0, 'plugin.json: description required');
}

for (const p of [
  'scripts/session-state.mjs',
  'commands/zone-targeted.md',
  'skills/zone-targeted/SKILL.md',
]) check(existsSync(join(pluginRoot, p)), `missing: ${p}`);

if (errors.length) {
  for (const e of errors) console.error('✖', e);
  process.exit(1);
}
console.log('✔ plugin structure ok');
