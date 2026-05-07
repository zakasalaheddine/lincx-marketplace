#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, '..');

const errors = [];
const check = (cond, msg) => { if (!cond) errors.push(msg); };

// plugin.json
const manifestPath = join(pluginRoot, '.claude-plugin', 'plugin.json');
check(existsSync(manifestPath), `missing: ${manifestPath}`);
if (existsSync(manifestPath)) {
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
  check(typeof m.name === 'string' && m.name.length > 0, 'plugin.json: name required');
  check(typeof m.version === 'string' && m.version.length > 0, 'plugin.json: version required');
  check(typeof m.description === 'string' && m.description.length > 0, 'plugin.json: description required');
}

// expected skills (auto-discovered by Claude Code, but we sanity-check presence)
for (const skill of [
  'skills/lincx-reports/SKILL.md',
  'skills/lincx-campaign-performance/SKILL.md',
  'skills/lincx-revenue-summary/SKILL.md',
  'skills/lincx-creative-anomalies/SKILL.md',
]) check(existsSync(join(pluginRoot, skill)), `missing skill: ${skill}`);

// expected shared helpers
for (const ref of [
  'skills/_shared/date-range.md',
  'skills/_shared/output-template.md',
  'skills/_shared/dimension-discovery.md',
  'skills/_shared/mcp-call-patterns.md',
]) check(existsSync(join(pluginRoot, ref)), `missing shared: ${ref}`);

if (errors.length) {
  for (const e of errors) console.error('✖', e);
  process.exit(1);
}
console.log('✔ plugin structure ok');
