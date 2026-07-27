import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const skillsRoot = resolve(here, '..', 'skills');

function findSkillFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_')) continue; // skip _shared
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      const skillFile = join(full, 'SKILL.md');
      try { if (statSync(skillFile).isFile()) out.push(skillFile); } catch {}
    }
  }
  return out;
}

function parseFrontmatter(src) {
  if (!src.startsWith('---\n')) return null;
  const end = src.indexOf('\n---', 4);
  if (end === -1) return null;
  const block = src.slice(4, end);
  const fm = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].trim();
  }
  return fm;
}

const skillFiles = findSkillFiles(skillsRoot);

test('every SKILL.md has valid frontmatter', () => {
  assert.ok(skillFiles.length >= 1, `expected ≥ 1 skill file, got ${skillFiles.length}`);
  for (const file of skillFiles) {
    const src = readFileSync(file, 'utf8');
    const fm = parseFrontmatter(src);
    assert.ok(fm, `${file}: missing or malformed frontmatter`);
    assert.ok(fm.name && fm.name.length > 0, `${file}: missing 'name'`);
    assert.ok(fm.description && fm.description.length > 0, `${file}: missing 'description'`);
    assert.ok(fm.description.length <= 200, `${file}: description > 200 chars (${fm.description.length})`);
  }
});
