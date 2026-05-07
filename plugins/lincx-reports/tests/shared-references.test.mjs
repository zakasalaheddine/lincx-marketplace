import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const skillsRoot = resolve(here, '..', 'skills');
const sharedRoot = join(skillsRoot, '_shared');

const SHARED_REF_RE = /_shared\/([a-z][a-z0-9-]+)\.md/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (name.endsWith('.md')) yield full;
  }
}

test('every _shared/*.md reference resolves on disk', () => {
  const offenders = [];
  for (const file of walk(skillsRoot)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(SHARED_REF_RE)) {
      const target = join(sharedRoot, `${m[1]}.md`);
      if (!existsSync(target)) {
        offenders.push(`${file} → _shared/${m[1]}.md (missing)`);
      }
    }
  }
  assert.equal(offenders.length, 0, offenders.join('\n'));
});
