#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, '..');

const errors = [];
function check(cond, msg) { if (!cond) errors.push(msg); }

// plugin.json
const manifestPath = join(pluginRoot, '.claude-plugin', 'plugin.json');
check(existsSync(manifestPath), `missing: ${manifestPath}`);
if (existsSync(manifestPath)) {
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
  check(typeof m.name === 'string' && m.name.length > 0, 'plugin.json: name required');
  check(typeof m.version === 'string' && m.version.length > 0, 'plugin.json: version required');
  check(typeof m.description === 'string' && m.description.length > 0, 'plugin.json: description required');
}

// references
for (const p of [
  'references/README.md',
  'references/rendering-convention.md',
  'references/patterns/README.md',
  'references/anti-patterns.md',
  'references/checklists/new-template.md',
  'references/checklists/adjust-template.md',
]) check(existsSync(join(pluginRoot, p)), `missing reference: ${p}`);

// commands
for (const p of [
  'commands/lincx-template-new.md',
  'commands/lincx-template-edit.md',
  'commands/lincx-template-save.md',
  'commands/lincx-template-load-ads.md',
  'commands/lincx-template-preview-toggle.md',
  'commands/lincx-template-refresh-schema.md',
]) check(existsSync(join(pluginRoot, p)), `missing command: ${p}`);

// skill
check(existsSync(join(pluginRoot, 'skills/editing-lincx-templates/SKILL.md')), 'missing skill: editing-lincx-templates');

// hook
const hookJson = join(pluginRoot, 'hooks/hooks.json');
const hookSh = join(pluginRoot, 'hooks/post-edit-preview.sh');
check(existsSync(hookJson), 'missing hooks/hooks.json');
check(existsSync(hookSh), 'missing hooks/post-edit-preview.sh');
if (existsSync(hookSh)) {
  const mode = statSync(hookSh).mode;
  check((mode & 0o111) !== 0, 'hooks/post-edit-preview.sh is not executable (chmod +x)');
}

if (errors.length) {
  for (const e of errors) console.error('✖', e);
  process.exit(1);
}
console.log('✔ plugin structure ok');
