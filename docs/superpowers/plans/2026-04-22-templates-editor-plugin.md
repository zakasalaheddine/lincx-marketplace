# Templates Editor Plugin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first plugin in `lincx-marketplace` — a templates editor that helps users author and adjust Lincx ad templates (HTML+CSS) with a live preview loop and a save-seam abstraction that works paste-ship today and MCP-write tomorrow.

**Architecture:** One orchestrator skill consults a local pattern library to author HTML/CSS; commands bootstrap sessions; a PostToolUse shell hook detects edits and dispatches a local Node renderer that wires CAG-shaped mock ads into the template and (re)writes `preview.html`; a save-seam module produces a pasteable artifact today and will call an MCP write tool when it ships. All inter-component state flows through a single `.lincx-session.json` file in the user's cwd.

**Tech Stack:** Claude Code plugin (manifest, skill, commands, hooks). Node `.mjs` with stdlib only (no npm install). Bash for hook entry script. `node:test` for unit tests, plain bash for hook fixture tests. Cross-platform launchers for browser open (`open` / `xdg-open` / `start`).

**Design spec:** `docs/superpowers/specs/2026-04-22-templates-editor-plugin-design.md`

---

## File structure (locked in up front)

```
lincx-marketplace/
  .claude-plugin/
    marketplace.json                    # marketplace manifest, lists the plugin
  plugins/templates-editor-plugin/
    .claude-plugin/plugin.json          # plugin manifest
    skills/editing-lincx-templates/SKILL.md
    commands/
      lincx-template-new.md
      lincx-template-edit.md
      lincx-template-save.md
      lincx-template-load-ads.md
      lincx-template-preview-toggle.md
      lincx-template-refresh-schema.md
    hooks/
      hooks.json
      post-edit-preview.sh
    scripts/
      session-state.mjs                 # read/write .lincx-session.json
      preview-render.mjs                # renderer invoked by hook
      save-seam.mjs                     # local + MCP-mode save
      check-plugin.mjs                  # structural lint
      platform-open.mjs                 # cross-platform browser launcher
    references/
      README.md
      rendering-convention.md           # stub
      rendering.json.example            # default tokenization config (commented)
      patterns/README.md
      anti-patterns.md
      checklists/new-template.md
      checklists/adjust-template.md
    tests/
      session-state.test.mjs
      preview-render.test.mjs
      save-seam.test.mjs
      hook.test.sh
      fixtures/
        simple-template/
          template.html
          template.css
          cag-schema.json
          mock-ads.json
          expected-preview.html
      smoke.md
    package.json                        # just a test script, no deps
    README.md
  docs/superpowers/
    specs/2026-04-22-templates-editor-plugin-design.md
    plans/2026-04-22-templates-editor-plugin.md
```

Each `scripts/*.mjs` has one responsibility. Tests are colocated under `tests/` with fixtures. No shared utility file — if two scripts need the same helper, inline it both places until a third use appears.

---

## Task 1: Initialize repository and commit the spec

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Verify you are in the project root**

Run: `pwd`
Expected: `/Users/salaheddinezaka/Documents/dev/lincx-marketplace`

- [ ] **Step 2: Initialize git and set main branch**

Run: `git init && git branch -M main`
Expected: `Initialized empty Git repository ...`

- [ ] **Step 3: Create `.gitignore`**

Write `.gitignore`:

```gitignore
# session state produced in user projects — never appears in this repo, but defensive
.lincx-session.json
.lincx-session.preview.pending
.lincx-session.log

# node / editor
node_modules/
.DS_Store
*.log
```

- [ ] **Step 4: Initial commit**

Run:
```bash
git add .gitignore docs/superpowers/specs/2026-04-22-templates-editor-plugin-design.md docs/superpowers/plans/2026-04-22-templates-editor-plugin.md
git commit -m "chore: init repo with approved design spec and plan"
```

Expected: one commit on `main` containing the `.gitignore`, spec, and plan.

---

## Task 2: Marketplace and plugin manifests

**Files:**
- Create: `.claude-plugin/marketplace.json`
- Create: `plugins/templates-editor-plugin/.claude-plugin/plugin.json`

- [ ] **Step 1: Write marketplace manifest**

Write `.claude-plugin/marketplace.json`:

```json
{
  "name": "lincx-marketplace",
  "description": "Claude Code plugins for Lincx use-cases",
  "owner": {
    "name": "Lincx",
    "url": "https://lincx.com"
  },
  "plugins": [
    {
      "name": "templates-editor-plugin",
      "source": "./plugins/templates-editor-plugin",
      "description": "Build and adjust Lincx ad templates (HTML+CSS) with a live preview loop"
    }
  ]
}
```

- [ ] **Step 2: Write plugin manifest**

Write `plugins/templates-editor-plugin/.claude-plugin/plugin.json`:

```json
{
  "name": "templates-editor-plugin",
  "description": "Build and adjust Lincx ad templates (HTML+CSS) with a live preview loop and a save-seam that paste-ships today and MCP-writes when a write tool lands.",
  "version": "0.1.0",
  "author": {
    "name": "Lincx"
  }
}
```

- [ ] **Step 3: Validate JSON parses**

Run:
```bash
node --input-type=module -e "import fs from 'node:fs'; JSON.parse(fs.readFileSync('.claude-plugin/marketplace.json')); JSON.parse(fs.readFileSync('plugins/templates-editor-plugin/.claude-plugin/plugin.json')); console.log('ok');"
```
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/marketplace.json plugins/templates-editor-plugin/.claude-plugin/plugin.json
git commit -m "feat: add marketplace and templates-editor-plugin manifests"
```

---

## Task 3: Package.json and test runner wiring

**Files:**
- Create: `plugins/templates-editor-plugin/package.json`
- Create: `plugins/templates-editor-plugin/tests/run-all.sh`

- [ ] **Step 1: Write `package.json`**

Write `plugins/templates-editor-plugin/package.json`:

```json
{
  "name": "templates-editor-plugin",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "bash tests/run-all.sh",
    "test:unit": "node --test tests/*.test.mjs",
    "test:hook": "bash tests/hook.test.sh",
    "test:lint": "node scripts/check-plugin.mjs"
  }
}
```

- [ ] **Step 2: Write `tests/run-all.sh`**

Write `plugins/templates-editor-plugin/tests/run-all.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== unit tests =="
node --test tests/*.test.mjs

echo "== hook fixture =="
bash tests/hook.test.sh

echo "== structural lint =="
node scripts/check-plugin.mjs

echo "all tests passed"
```

- [ ] **Step 3: Make runner executable**

Run: `chmod +x plugins/templates-editor-plugin/tests/run-all.sh`

- [ ] **Step 4: Commit**

```bash
git add plugins/templates-editor-plugin/package.json plugins/templates-editor-plugin/tests/run-all.sh
git commit -m "chore: add plugin package.json and test runner entry"
```

---

## Task 4: session-state module — TDD

**Files:**
- Create: `plugins/templates-editor-plugin/tests/session-state.test.mjs`
- Create: `plugins/templates-editor-plugin/scripts/session-state.mjs`

- [ ] **Step 1: Write the failing tests**

Write `plugins/templates-editor-plugin/tests/session-state.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readSessionState,
  writeSessionState,
  upsertEntry,
  removeEntry,
  findEntryByPath,
} from '../scripts/session-state.mjs';

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-session-'));
  return { dir, file: join(dir, '.lincx-session.json'), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('readSessionState returns null when file is missing', () => {
  const { file, cleanup } = tmp();
  try { assert.equal(readSessionState(file), null); } finally { cleanup(); }
});

test('readSessionState throws a tagged error on corrupt JSON', () => {
  const { file, cleanup } = tmp();
  try {
    writeFileSync(file, '{ not json');
    assert.throws(() => readSessionState(file), /CORRUPT_SESSION_STATE/);
  } finally { cleanup(); }
});

test('writeSessionState then readSessionState round-trips', () => {
  const { file, cleanup } = tmp();
  try {
    const state = { previewDisabled: false, activeTemplates: [] };
    writeSessionState(file, state);
    assert.deepEqual(readSessionState(file), state);
  } finally { cleanup(); }
});

test('upsertEntry inserts a new entry when id is not found', () => {
  const state = { previewDisabled: false, activeTemplates: [] };
  const entry = { id: 'e1', templateId: 't1', htmlPath: 'a.html', cssPath: 'a.css', previewPath: 'p.html' };
  const next = upsertEntry(state, entry);
  assert.equal(next.activeTemplates.length, 1);
  assert.equal(next.activeTemplates[0].id, 'e1');
});

test('upsertEntry updates an existing entry by id', () => {
  const state = { previewDisabled: false, activeTemplates: [{ id: 'e1', dirty: false, htmlPath: 'a.html' }] };
  const next = upsertEntry(state, { id: 'e1', dirty: true, htmlPath: 'a.html' });
  assert.equal(next.activeTemplates.length, 1);
  assert.equal(next.activeTemplates[0].dirty, true);
});

test('removeEntry removes by id and is a no-op if id missing', () => {
  const state = { previewDisabled: false, activeTemplates: [{ id: 'e1' }, { id: 'e2' }] };
  const afterRemove = removeEntry(state, 'e1');
  assert.deepEqual(afterRemove.activeTemplates.map(e => e.id), ['e2']);
  const afterNoop = removeEntry(afterRemove, 'zzz');
  assert.deepEqual(afterNoop.activeTemplates.map(e => e.id), ['e2']);
});

test('findEntryByPath matches htmlPath or cssPath', () => {
  const state = {
    previewDisabled: false,
    activeTemplates: [
      { id: 'e1', htmlPath: 'ads/a.html', cssPath: 'ads/a.css' },
      { id: 'e2', htmlPath: 'ads/b.html', cssPath: 'ads/b.css' },
    ],
  };
  assert.equal(findEntryByPath(state, 'ads/a.html')?.id, 'e1');
  assert.equal(findEntryByPath(state, 'ads/b.css')?.id, 'e2');
  assert.equal(findEntryByPath(state, 'ads/nope.html'), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `plugins/templates-editor-plugin`: `node --test tests/session-state.test.mjs`
Expected: all fail with `Cannot find module ... scripts/session-state.mjs`.

- [ ] **Step 3: Write minimal implementation**

Write `plugins/templates-editor-plugin/scripts/session-state.mjs`:

```javascript
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export function readSessionState(filePath) {
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    const err = new Error(`CORRUPT_SESSION_STATE: ${filePath}: ${e.message}`);
    err.code = 'CORRUPT_SESSION_STATE';
    throw err;
  }
}

export function writeSessionState(filePath, state) {
  writeFileSync(filePath, JSON.stringify(state, null, 2) + '\n');
}

export function upsertEntry(state, entry) {
  const activeTemplates = [...(state.activeTemplates ?? [])];
  const idx = activeTemplates.findIndex(e => e.id === entry.id);
  if (idx === -1) activeTemplates.push(entry);
  else activeTemplates[idx] = { ...activeTemplates[idx], ...entry };
  return { ...state, activeTemplates };
}

export function removeEntry(state, entryId) {
  return {
    ...state,
    activeTemplates: (state.activeTemplates ?? []).filter(e => e.id !== entryId),
  };
}

export function findEntryByPath(state, path) {
  for (const entry of state.activeTemplates ?? []) {
    if (entry.htmlPath === path || entry.cssPath === path) return entry;
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/session-state.test.mjs`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add plugins/templates-editor-plugin/scripts/session-state.mjs plugins/templates-editor-plugin/tests/session-state.test.mjs
git commit -m "feat(scripts): add session-state read/write/upsert/find module"
```

---

## Task 5: platform-open module — TDD

**Files:**
- Create: `plugins/templates-editor-plugin/tests/platform-open.test.mjs`
- Create: `plugins/templates-editor-plugin/scripts/platform-open.mjs`

- [ ] **Step 1: Write the failing tests**

Write `plugins/templates-editor-plugin/tests/platform-open.test.mjs`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/platform-open.test.mjs`
Expected: failures — module not found.

- [ ] **Step 3: Write minimal implementation**

Write `plugins/templates-editor-plugin/scripts/platform-open.mjs`:

```javascript
import { spawn } from 'node:child_process';

export function resolveOpenCommand(platform, filePath) {
  if (platform === 'darwin') return { cmd: 'open', args: [filePath] };
  if (platform === 'linux') return { cmd: 'xdg-open', args: [filePath] };
  if (platform === 'win32') return { cmd: 'cmd.exe', args: ['/c', 'start', '""', filePath] };
  return null;
}

export function openInBrowser(filePath) {
  const resolved = resolveOpenCommand(process.platform, filePath);
  if (!resolved) return { ok: false, reason: `unsupported platform: ${process.platform}` };
  try {
    const child = spawn(resolved.cmd, resolved.args, { detached: true, stdio: 'ignore' });
    child.unref();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/platform-open.test.mjs`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add plugins/templates-editor-plugin/scripts/platform-open.mjs plugins/templates-editor-plugin/tests/platform-open.test.mjs
git commit -m "feat(scripts): add cross-platform browser launcher"
```

---

## Task 6: renderer module — TDD (fixtures first)

**Files:**
- Create: `plugins/templates-editor-plugin/tests/fixtures/simple-template/template.html`
- Create: `plugins/templates-editor-plugin/tests/fixtures/simple-template/template.css`
- Create: `plugins/templates-editor-plugin/tests/fixtures/simple-template/cag-schema.json`
- Create: `plugins/templates-editor-plugin/tests/fixtures/simple-template/mock-ads.json`
- Create: `plugins/templates-editor-plugin/tests/fixtures/simple-template/expected-preview.html`
- Create: `plugins/templates-editor-plugin/tests/preview-render.test.mjs`
- Create: `plugins/templates-editor-plugin/scripts/preview-render.mjs`

- [ ] **Step 1: Write fixture — `template.html`**

```html
<div class="ad"><h1>{{headline}}</h1><p>{{body}}</p><a href="{{&clickUrl}}">Learn more</a></div>
```

- [ ] **Step 2: Write fixture — `template.css`**

```css
.ad { font-family: system-ui; padding: 12px; }
.ad h1 { margin: 0 0 8px 0; }
```

- [ ] **Step 3: Write fixture — `cag-schema.json`**

```json
{
  "id": "cag_test",
  "fields": [
    { "name": "headline", "type": "string" },
    { "name": "body", "type": "string" },
    { "name": "clickUrl", "type": "url" }
  ]
}
```

- [ ] **Step 4: Write fixture — `mock-ads.json`**

```json
[
  { "headline": "First headline", "body": "First body.", "clickUrl": "https://example.com/a" },
  { "headline": "Second headline", "body": "Second body.", "clickUrl": "https://example.com/b" }
]
```

- [ ] **Step 5: Write fixture — `expected-preview.html`**

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Lincx template preview</title>
<style>
.ad { font-family: system-ui; padding: 12px; }
.ad h1 { margin: 0 0 8px 0; }
body { margin: 0; padding: 16px; background: #f4f4f4; }
.lincx-preview-ad { background: white; padding: 12px; margin: 0 0 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
.lincx-preview-ad > .lincx-preview-label { font: 11px system-ui; color: #888; margin-bottom: 8px; }
</style>
</head>
<body>
<div class="lincx-preview-ad"><div class="lincx-preview-label">ad #1</div><div class="ad"><h1>First headline</h1><p>First body.</p><a href="https://example.com/a">Learn more</a></div></div>
<div class="lincx-preview-ad"><div class="lincx-preview-label">ad #2</div><div class="ad"><h1>Second headline</h1><p>Second body.</p><a href="https://example.com/b">Learn more</a></div></div>
</body>
</html>
```

- [ ] **Step 6: Write the failing tests**

Write `plugins/templates-editor-plugin/tests/preview-render.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPreview, synthesizeMockAds, substituteTokens } from '../scripts/preview-render.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures', 'simple-template');

test('substituteTokens replaces {{field}} tokens from a flat record', () => {
  const out = substituteTokens('<h1>{{headline}}</h1>', { headline: 'Hi' });
  assert.equal(out, '<h1>Hi</h1>');
});

test('substituteTokens leaves unknown tokens as empty string', () => {
  const out = substituteTokens('<p>{{missing}}</p>', {});
  assert.equal(out, '<p></p>');
});

test('substituteTokens HTML-escapes substituted values by default', () => {
  const out = substituteTokens('<p>{{body}}</p>', { body: '<script>x</script>' });
  assert.equal(out, '<p>&lt;script&gt;x&lt;/script&gt;</p>');
});

test('substituteTokens does not escape url-typed tokens marked via {{& field}}', () => {
  const out = substituteTokens('<a href="{{&clickUrl}}">x</a>', { clickUrl: 'https://example.com?a=1&b=2' });
  assert.equal(out, '<a href="https://example.com?a=1&b=2">x</a>');
});

test('synthesizeMockAds generates 2 placeholders from a CAG schema', () => {
  const schema = JSON.parse(readFileSync(join(fixtures, 'cag-schema.json'), 'utf8'));
  const ads = synthesizeMockAds(schema, 2);
  assert.equal(ads.length, 2);
  for (const ad of ads) {
    assert.ok(typeof ad.headline === 'string' && ad.headline.length > 0);
    assert.ok(typeof ad.body === 'string' && ad.body.length > 0);
    assert.ok(/^https?:\/\//.test(ad.clickUrl));
  }
});

test('renderPreview writes preview.html matching the fixture exactly', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-render-'));
  try {
    const html = readFileSync(join(fixtures, 'template.html'), 'utf8');
    const css = readFileSync(join(fixtures, 'template.css'), 'utf8');
    const schema = JSON.parse(readFileSync(join(fixtures, 'cag-schema.json'), 'utf8'));
    const mockAds = JSON.parse(readFileSync(join(fixtures, 'mock-ads.json'), 'utf8'));
    const previewPath = join(dir, 'preview.html');

    const result = renderPreview({ html, css, cagSchema: schema, mockAds, previewPath });
    assert.equal(result.ok, true);
    assert.equal(result.usedFallback, false);

    const actual = readFileSync(previewPath, 'utf8').trim();
    const expected = readFileSync(join(fixtures, 'expected-preview.html'), 'utf8').trim();
    assert.equal(actual, expected);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('renderPreview falls back to synthesized ads when mockAds shape is invalid', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-render-'));
  try {
    const html = readFileSync(join(fixtures, 'template.html'), 'utf8');
    const css = readFileSync(join(fixtures, 'template.css'), 'utf8');
    const schema = JSON.parse(readFileSync(join(fixtures, 'cag-schema.json'), 'utf8'));
    const previewPath = join(dir, 'preview.html');

    const result = renderPreview({ html, css, cagSchema: schema, mockAds: [{ notAField: 1 }], previewPath });
    assert.equal(result.ok, true);
    assert.equal(result.usedFallback, true);
    assert.ok(existsSync(previewPath));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('renderPreview returns ok:false when html source is missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-render-'));
  try {
    const schema = JSON.parse(readFileSync(join(fixtures, 'cag-schema.json'), 'utf8'));
    const result = renderPreview({ html: null, css: '', cagSchema: schema, mockAds: [], previewPath: join(dir, 'preview.html') });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'MISSING_HTML');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `node --test tests/preview-render.test.mjs`
Expected: all fail — module not found.

- [ ] **Step 8: Write the implementation**

Write `plugins/templates-editor-plugin/scripts/preview-render.mjs`:

```javascript
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { readSessionState, writeSessionState } from './session-state.mjs';

const TOKEN_RE = /\{\{\s*(&\s*)?([\w.]+)\s*\}\}/g;

export function htmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function substituteTokens(template, record) {
  return template.replace(TOKEN_RE, (_, bang, path) => {
    const value = path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), record);
    if (value === undefined || value === null) return '';
    return bang ? String(value) : htmlEscape(value);
  });
}

const SAMPLE_BY_TYPE = {
  string: (name, i) => `Sample ${name} ${i + 1}`,
  url: (_, i) => `https://example.com/sample-${i + 1}`,
  number: (_, i) => String(100 + i),
  boolean: (_, i) => (i % 2 === 0 ? 'true' : 'false'),
  image: (_, i) => `https://placehold.co/300x200?text=ad+${i + 1}`,
};

export function synthesizeMockAds(cagSchema, count = 2) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const ad = {};
    for (const field of cagSchema.fields ?? []) {
      const sampler = SAMPLE_BY_TYPE[field.type] ?? SAMPLE_BY_TYPE.string;
      ad[field.name] = sampler(field.name, i);
    }
    out.push(ad);
  }
  return out;
}

export function validateAdsShape(schema, ads) {
  if (!Array.isArray(ads) || ads.length === 0) return false;
  const requiredFields = (schema.fields ?? []).map(f => f.name);
  return ads.every(ad =>
    ad && typeof ad === 'object' &&
    requiredFields.every(n => Object.prototype.hasOwnProperty.call(ad, n))
  );
}

export function renderPreview({ html, css, cagSchema, mockAds, previewPath }) {
  if (!html) return { ok: false, reason: 'MISSING_HTML' };
  if (!cagSchema) return { ok: false, reason: 'MISSING_SCHEMA' };

  let ads = mockAds;
  let usedFallback = false;
  if (!validateAdsShape(cagSchema, ads)) {
    ads = synthesizeMockAds(cagSchema, 2);
    usedFallback = true;
  }

  const iterations = ads.map((ad, i) => {
    const body = substituteTokens(html, ad);
    return `<div class="lincx-preview-ad"><div class="lincx-preview-label">ad #${i + 1}</div>${body}</div>`;
  }).join('\n');

  const out = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Lincx template preview</title>
<style>
${css}
body { margin: 0; padding: 16px; background: #f4f4f4; }
.lincx-preview-ad { background: white; padding: 12px; margin: 0 0 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
.lincx-preview-ad > .lincx-preview-label { font: 11px system-ui; color: #888; margin-bottom: 8px; }
</style>
</head>
<body>
${iterations}
</body>
</html>`;

  writeFileSync(previewPath, out);
  return { ok: true, usedFallback };
}

// CLI entry point — invoked by the hook: `node scripts/preview-render.mjs <entryId>`
export async function cli(argv, cwd = process.cwd()) {
  const entryId = argv[0];
  const logPath = `${cwd}/.lincx-session.log`;
  const statePath = `${cwd}/.lincx-session.json`;
  const markerPath = `${cwd}/.lincx-session.preview.pending`;

  function log(msg) {
    const line = `[${new Date().toISOString()}] preview-render: ${msg}\n`;
    try { writeFileSync(logPath, line, { flag: 'a' }); } catch {}
  }

  try {
    const state = readSessionState(statePath);
    if (!state) { log('no session state; exiting'); return 0; }
    if (state.previewDisabled) { log('preview disabled; exiting'); return 0; }

    const entry = (state.activeTemplates ?? []).find(e => e.id === entryId);
    if (!entry) { log(`entry ${entryId} not found; exiting`); return 0; }

    if (!existsSync(entry.htmlPath)) { log(`html missing at ${entry.htmlPath}; exiting`); return 0; }
    const html = readFileSync(entry.htmlPath, 'utf8');
    const css = existsSync(entry.cssPath) ? readFileSync(entry.cssPath, 'utf8') : '';

    if (!entry.cagSchema) {
      log('cagSchema missing from cache; run /lincx-template-refresh-schema');
      return 0;
    }

    const result = renderPreview({
      html, css,
      cagSchema: entry.cagSchema,
      mockAds: entry.mockAds,
      previewPath: entry.previewPath,
    });

    if (!result.ok) { log(`render failed: ${result.reason}`); return 0; }
    if (result.usedFallback) log('warning: mockAds invalid; fell back to synthesized');

    // First-preview: open in browser. Persist previewOpened so we don't reopen.
    if (!entry.previewOpened) {
      try {
        const { openInBrowser } = await import('./platform-open.mjs');
        const r = openInBrowser(entry.previewPath);
        if (r.ok) {
          const next = {
            ...state,
            activeTemplates: state.activeTemplates.map(e => e.id === entryId ? { ...e, previewOpened: true } : e),
          };
          writeSessionState(statePath, next);
          log(`opened ${entry.previewPath} in browser`);
        } else {
          log(`could not open browser: ${r.reason}`);
        }
      } catch (e) { log(`open failed: ${e.message}`); }
    } else {
      log(`rewrote ${entry.previewPath}`);
    }

    return 0;
  } finally {
    try { if (existsSync(markerPath)) writeFileSync(markerPath, ''); } catch {}
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const code = await cli(process.argv.slice(2));
  process.exit(code);
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `node --test tests/preview-render.test.mjs`
Expected: 8 passed.

- [ ] **Step 10: Commit**

```bash
git add plugins/templates-editor-plugin/scripts/preview-render.mjs plugins/templates-editor-plugin/tests/preview-render.test.mjs plugins/templates-editor-plugin/tests/fixtures/simple-template/
git commit -m "feat(scripts): renderer with token substitution, synth mock ads, fallback, CLI"
```

---

## Task 7: save-seam module — TDD

**Files:**
- Create: `plugins/templates-editor-plugin/tests/save-seam.test.mjs`
- Create: `plugins/templates-editor-plugin/scripts/save-seam.mjs`

The save seam exposes two entry points: synchronous `save` (used when the MCP path is unavailable or when the caller pre-resolved the write) and `saveAsync` (used when the caller passes a promise-returning `mcpWrite`). Keeping them separate avoids any sync-over-async workarounds.

- [ ] **Step 1: Write the failing tests**

Write `plugins/templates-editor-plugin/tests/save-seam.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { save, saveAsync, nextVersionNumber, buildArtifact, computeDiffSummary } from '../scripts/save-seam.mjs';

function fixtureEntry(dir) {
  const htmlPath = join(dir, 'ad.html');
  const cssPath = join(dir, 'ad.css');
  writeFileSync(htmlPath, '<div class="ad"><h1>{{headline}}</h1></div>');
  writeFileSync(cssPath, '.ad { color: red; }');
  return {
    id: 'e1',
    templateId: 't1',
    htmlPath, cssPath,
    previewPath: join(dir, 'preview.html'),
    dirty: true,
  };
}

test('nextVersionNumber is 1 when versions dir is empty or missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-save-'));
  try {
    assert.equal(nextVersionNumber(join(dir, 'versions')), 1);
    mkdirSync(join(dir, 'versions'));
    assert.equal(nextVersionNumber(join(dir, 'versions')), 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('nextVersionNumber returns max + 1 across existing v*.html files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-save-'));
  try {
    mkdirSync(join(dir, 'versions'));
    writeFileSync(join(dir, 'versions', 'v1.html'), '');
    writeFileSync(join(dir, 'versions', 'v3.html'), '');
    writeFileSync(join(dir, 'versions', 'v7.html'), '');
    assert.equal(nextVersionNumber(join(dir, 'versions')), 8);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('buildArtifact inlines CSS into <style> and keeps HTML body intact', () => {
  const out = buildArtifact({ html: '<div>hi</div>', css: 'div { color: red; }' });
  assert.match(out, /<style>\s*div \{ color: red; \}\s*<\/style>/);
  assert.match(out, /<div>hi<\/div>/);
});

test('computeDiffSummary reports added/removed counts', () => {
  const before = 'a\nb\nc\n';
  const after = 'a\nB\nc\nd\n';
  const summary = computeDiffSummary(before, after);
  assert.match(summary, /\+2/);
  assert.match(summary, /-1/);
});

test('save local mode writes v1 on first save, v2 on second', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-save-'));
  try {
    const entry = fixtureEntry(dir);
    const r1 = save(entry, { mcpWriteAvailable: false });
    assert.equal(r1.mode, 'local');
    assert.ok(r1.artifactPath.endsWith('versions/v1.html'));
    writeFileSync(entry.htmlPath, '<div class="ad"><h1>{{headline}}</h1><p>new</p></div>');
    const r2 = save(entry, { mcpWriteAvailable: false });
    assert.ok(r2.artifactPath.endsWith('versions/v2.html'));
    const versions = readdirSync(join(dir, 'versions')).sort();
    assert.deepEqual(versions, ['v1.html', 'v2.html']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('saveAsync mcp mode calls mcpWrite with {templateId, html, css}', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-save-'));
  try {
    const entry = fixtureEntry(dir);
    const calls = [];
    const mcpWrite = async (payload) => { calls.push(payload); return { version: 42 }; };
    const result = await saveAsync(entry, { mcpWriteAvailable: true, mcpWrite });
    assert.equal(result.mode, 'mcp');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].templateId, 't1');
    assert.match(calls[0].html, /<h1>\{\{headline\}\}<\/h1>/);
    assert.match(calls[0].css, /color: red/);
    assert.equal(result.version, 42);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('saveAsync mcp failure falls back to local and reports both', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-save-'));
  try {
    const entry = fixtureEntry(dir);
    const mcpWrite = async () => { throw new Error('boom'); };
    const result = await saveAsync(entry, { mcpWriteAvailable: true, mcpWrite });
    assert.equal(result.mode, 'local');
    assert.match(result.summary, /fell back from mcp.*boom/i);
    assert.ok(result.artifactPath.endsWith('versions/v1.html'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('save with templateId=null still produces a local artifact', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-save-'));
  try {
    const entry = { ...fixtureEntry(dir), templateId: null };
    const result = save(entry, { mcpWriteAvailable: false });
    assert.equal(result.mode, 'local');
    assert.match(result.summary, /ready to paste as a new template/i);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/save-seam.test.mjs`
Expected: module not found.

- [ ] **Step 3: Write the implementation**

Write `plugins/templates-editor-plugin/scripts/save-seam.mjs`:

```javascript
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function nextVersionNumber(versionsDir) {
  if (!existsSync(versionsDir)) return 1;
  const existing = readdirSync(versionsDir)
    .map(name => /^v(\d+)\.html$/.exec(name))
    .filter(Boolean)
    .map(m => Number(m[1]));
  if (existing.length === 0) return 1;
  return Math.max(...existing) + 1;
}

export function buildArtifact({ html, css }) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
${css}
</style>
</head>
<body>
${html}
</body>
</html>`;
}

export function computeDiffSummary(before, after) {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);
  let added = 0, removed = 0;
  for (const line of afterLines) if (!beforeSet.has(line)) added++;
  for (const line of beforeLines) if (!afterSet.has(line)) removed++;
  return `+${added} -${removed} lines`;
}

function doLocalSave(entry) {
  const html = readFileSync(entry.htmlPath, 'utf8');
  const css = existsSync(entry.cssPath) ? readFileSync(entry.cssPath, 'utf8') : '';
  const versionsDir = join(dirname(entry.htmlPath), 'versions');
  if (!existsSync(versionsDir)) mkdirSync(versionsDir, { recursive: true });
  const n = nextVersionNumber(versionsDir);
  const artifactPath = join(versionsDir, `v${n}.html`);

  const artifact = buildArtifact({ html, css });

  let diff = `first version (v${n})`;
  if (n > 1) {
    const prev = readFileSync(join(versionsDir, `v${n - 1}.html`), 'utf8');
    diff = computeDiffSummary(prev, artifact);
  }

  writeFileSync(artifactPath, artifact);

  const idHint = entry.templateId
    ? `paste into template \`${entry.templateId}\` in Lincx`
    : 'ready to paste as a new template';

  return {
    mode: 'local',
    artifactPath,
    version: n,
    summary: `${idHint}; ${diff}`,
  };
}

// Synchronous save — local mode only, or MCP mode where the caller passed
// a *synchronous* mcpWrite (e.g. a stub). If mcpWrite returns a promise,
// use saveAsync instead.
export function save(entry, opts = {}) {
  const { mcpWriteAvailable, mcpWrite } = opts;
  if (mcpWriteAvailable && entry.templateId && typeof mcpWrite === 'function') {
    const html = readFileSync(entry.htmlPath, 'utf8');
    const css = existsSync(entry.cssPath) ? readFileSync(entry.cssPath, 'utf8') : '';
    try {
      const result = mcpWrite({ templateId: entry.templateId, html, css });
      if (result && typeof result.then === 'function') {
        throw new Error('mcpWrite returned a promise — use saveAsync');
      }
      return {
        mode: 'mcp',
        version: result?.version,
        summary: `pushed via MCP (version ${result?.version ?? '?'})`,
      };
    } catch (e) {
      const local = doLocalSave(entry);
      return { ...local, summary: `fell back from mcp: ${e.message}; ${local.summary}` };
    }
  }
  return doLocalSave(entry);
}

// Async save — use when mcpWrite returns a promise.
export async function saveAsync(entry, opts = {}) {
  const { mcpWriteAvailable, mcpWrite } = opts;
  if (mcpWriteAvailable && entry.templateId && typeof mcpWrite === 'function') {
    const html = readFileSync(entry.htmlPath, 'utf8');
    const css = existsSync(entry.cssPath) ? readFileSync(entry.cssPath, 'utf8') : '';
    try {
      const result = await mcpWrite({ templateId: entry.templateId, html, css });
      return {
        mode: 'mcp',
        version: result?.version,
        summary: `pushed via MCP (version ${result?.version ?? '?'})`,
      };
    } catch (e) {
      const local = doLocalSave(entry);
      return { ...local, summary: `fell back from mcp: ${e.message}; ${local.summary}` };
    }
  }
  return doLocalSave(entry);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/save-seam.test.mjs`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add plugins/templates-editor-plugin/scripts/save-seam.mjs plugins/templates-editor-plugin/tests/save-seam.test.mjs
git commit -m "feat(scripts): save-seam with local + mcp mode, versioning, diff summary"
```

---

## Task 8: structural lint

**Files:**
- Create: `plugins/templates-editor-plugin/scripts/check-plugin.mjs`

- [ ] **Step 1: Write the implementation**

Write `plugins/templates-editor-plugin/scripts/check-plugin.mjs`:

```javascript
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
```

- [ ] **Step 2: Run it — expect a pile of errors (later tasks fix them)**

Run from `plugins/templates-editor-plugin`: `node scripts/check-plugin.mjs`
Expected: exits 1 with several `✖ missing ...` lines. This is the driver for the next tasks. Task 14 reruns it and expects it to pass.

- [ ] **Step 3: Commit**

```bash
git add plugins/templates-editor-plugin/scripts/check-plugin.mjs
git commit -m "feat(scripts): structural lint for plugin layout"
```

---

## Task 9: references scaffold (stubs — user populates later)

**Files:**
- Create: `plugins/templates-editor-plugin/references/README.md`
- Create: `plugins/templates-editor-plugin/references/rendering-convention.md`
- Create: `plugins/templates-editor-plugin/references/rendering.json.example`
- Create: `plugins/templates-editor-plugin/references/patterns/README.md`
- Create: `plugins/templates-editor-plugin/references/anti-patterns.md`
- Create: `plugins/templates-editor-plugin/references/checklists/new-template.md`
- Create: `plugins/templates-editor-plugin/references/checklists/adjust-template.md`

- [ ] **Step 1: Write `references/README.md`**

```markdown
# References — Lincx template patterns

This directory is the **single source of truth** the skill consults before authoring HTML/CSS.

## Layout
- `rendering-convention.md` — how mock ads are wired into HTML. **You populate this.**
- `patterns/<pattern-name>/` — canonical example templates. **You populate these.**
- `anti-patterns.md` — things that look right but break. **You populate this.**
- `checklists/new-template.md` — pre-flight for from-scratch work.
- `checklists/adjust-template.md` — pre-flight for edits.

## How the skill uses this dir
Before proposing any template HTML or CSS, the skill reads this README, then reads the most relevant files under `patterns/`. If the request is covered by a pattern, it follows that pattern. Only when the request isn't covered — or is trivially simple — does it deviate, and it states in one sentence which pattern it's closest to and why it's deviating.
```

- [ ] **Step 2: Write `references/rendering-convention.md` (stub)**

```markdown
# Rendering convention

> **Stub.** Fill this in from your real templates.

The default renderer uses Mustache-style tokens: `{{field.path}}` (HTML-escaped) and `{{&field.path}}` (unescaped — use for URLs). If your templates use a different tokenization, document it here and drop a `rendering.json` next to this file to override (see `rendering.json.example`).

Populate below with:
- The exact token syntax(es) used in production templates.
- Any loops, conditionals, or helpers the templates rely on.
- Fields that are always expected, and defaults if they're missing.
- Common ad-data fields that map to specific HTML semantics (e.g. `imageUrl` → `<img src>`).
```

- [ ] **Step 3: Write `references/rendering.json.example`**

```json
{
  "_comment": "Copy this file to rendering.json to override the default convention. The renderer does not currently read this file — wiring is planned when a non-default convention is needed.",
  "open": "{{",
  "close": "}}",
  "escapeByDefault": true,
  "unescapePrefix": "&"
}
```

- [ ] **Step 4: Write `references/patterns/README.md`**

```markdown
# Patterns

Each subdirectory here is one pattern. Required files inside:
- `example.html`
- `example.css`
- `notes.md` — when to use, do/don't, known edge cases

When the skill detects that a request matches one of these patterns, it follows the `.html` / `.css` conventions and respects anything in `notes.md`.

## Index
| Pattern | Description | Status |
|---------|-------------|--------|
| _none yet_ | Drop your first pattern here. | — |
```

- [ ] **Step 5: Write `references/anti-patterns.md` (stub)**

```markdown
# Anti-patterns

> **Stub.** Record here things that look correct but have broken in the past. One entry per anti-pattern: what it looks like, why it breaks, what to do instead.
```

- [ ] **Step 6: Write `references/checklists/new-template.md`**

```markdown
# Checklist — new template from scratch

- [ ] CAG (`creativeAssetGroupId`) chosen — confirm all ad fields the template needs are in the schema.
- [ ] Closest existing pattern identified (name it, even if it's a partial match).
- [ ] Tokenization matches `rendering-convention.md`.
- [ ] No inline `<script>` (or: deliberately allowed and documented).
- [ ] CSS selectors scoped (no bare `body`/`html` rules).
- [ ] Preview renders with 2 synthesized ads without visual breakage.
- [ ] Anti-patterns list re-read.
```

- [ ] **Step 7: Write `references/checklists/adjust-template.md`**

```markdown
# Checklist — adjusting an existing template

- [ ] Pulled latest via `/lincx-template-edit <id>` — working from current server state.
- [ ] Understand which pattern (if any) this template follows.
- [ ] Adjustments don't remove tokens the CAG expects.
- [ ] Preview still renders cleanly for synthesized and (if available) zone-sourced ads.
- [ ] Diff against `v<N-1>` is limited to what the user asked for.
```

- [ ] **Step 8: Commit**

```bash
git add plugins/templates-editor-plugin/references/
git commit -m "feat(references): scaffold reference library with stubs"
```

---

## Task 10: hook — shell script + manifest + fixture test

**Files:**
- Create: `plugins/templates-editor-plugin/hooks/hooks.json`
- Create: `plugins/templates-editor-plugin/hooks/post-edit-preview.sh`
- Create: `plugins/templates-editor-plugin/tests/hook.test.sh`

- [ ] **Step 1: Write `hooks/hooks.json`**

Write `plugins/templates-editor-plugin/hooks/hooks.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/post-edit-preview.sh"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Write `hooks/post-edit-preview.sh`**

Write `plugins/templates-editor-plugin/hooks/post-edit-preview.sh`:

```bash
#!/usr/bin/env bash
# PostToolUse hook — dispatch the preview renderer if the edited path matches
# a tracked template in .lincx-session.json.
#
# Reads hook JSON payload on stdin. Does nothing unless a session exists and
# the edited path matches. Debounces with a marker file. Never fails loudly.
set -u

trap 'exit 0' ERR

CWD="${CLAUDE_PROJECT_DIR:-$PWD}"
STATE="$CWD/.lincx-session.json"
LOG="$CWD/.lincx-session.log"
MARKER="$CWD/.lincx-session.preview.pending"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"

log() { printf '[%s] hook: %s\n' "$(date -u +%FT%TZ)" "$*" >> "$LOG" 2>/dev/null || true; }

# 1. No session state → silent no-op.
[ -f "$STATE" ] || exit 0
# 2. Node missing → silent no-op; log once.
command -v node >/dev/null 2>&1 || { log "node not found; skipping"; exit 0; }

# 3. Preview disabled → exit.
DISABLED=$(node --input-type=module -e "
  import fs from 'node:fs';
  try { const s = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.stdout.write(s.previewDisabled ? '1' : '0'); }
  catch { process.stdout.write('0'); }
" "$STATE" 2>/dev/null || echo 0)
[ "$DISABLED" = "1" ] && exit 0

# 4. Read hook payload from stdin; extract file_path.
PAYLOAD="$(cat || true)"
[ -z "$PAYLOAD" ] && exit 0

EDITED_PATH=$(printf '%s' "$PAYLOAD" | node --input-type=module -e "
  let d = '';
  process.stdin.on('data', c => d += c).on('end', () => {
    try {
      const j = JSON.parse(d);
      const p = j.tool_input && (j.tool_input.file_path || j.tool_input.filePath);
      if (p) process.stdout.write(p);
    } catch {}
  });
" 2>/dev/null || true)
[ -z "$EDITED_PATH" ] && exit 0

# 5. Resolve entry id via session-state.mjs.
ENTRY_ID=$(node --input-type=module -e "
  import { readSessionState, findEntryByPath } from '${PLUGIN_ROOT}/scripts/session-state.mjs';
  const s = readSessionState(process.argv[1]);
  if (!s) process.exit(0);
  const e = findEntryByPath(s, process.argv[2]);
  if (e) process.stdout.write(e.id);
" "$STATE" "$EDITED_PATH" 2>/dev/null || true)
[ -z "$ENTRY_ID" ] && exit 0

# 6. Debounce: marker < 2 s old → skip.
if [ -f "$MARKER" ]; then
  NOW=$(date +%s)
  MARK_AT=$(stat -f %m "$MARKER" 2>/dev/null || stat -c %Y "$MARKER" 2>/dev/null || echo 0)
  AGE=$(( NOW - MARK_AT ))
  if [ "$AGE" -lt 2 ]; then
    log "debounced entry=$ENTRY_ID (age=${AGE}s)"
    exit 0
  fi
fi

# 7. Write marker; dispatch renderer.
echo "$ENTRY_ID" > "$MARKER"
log "dispatch entry=$ENTRY_ID path=$EDITED_PATH"
node "${PLUGIN_ROOT}/scripts/preview-render.mjs" "$ENTRY_ID" >> "$LOG" 2>&1 &
disown 2>/dev/null || true

exit 0
```

- [ ] **Step 3: Make it executable**

Run: `chmod +x plugins/templates-editor-plugin/hooks/post-edit-preview.sh`

- [ ] **Step 4: Write the hook fixture test**

Write `plugins/templates-editor-plugin/tests/hook.test.sh`:

```bash
#!/usr/bin/env bash
set -u
FAIL=0
fail() { echo "✖ $*"; FAIL=1; }
pass() { echo "✔ $*"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK="$PLUGIN_ROOT/hooks/post-edit-preview.sh"

mktemp_dir() { mktemp -d "${TMPDIR:-/tmp}/lincx-hook-XXXXXX"; }

# --- Case 1: no session state → exit 0, nothing created ---
DIR=$(mktemp_dir)
OUT=$(CLAUDE_PROJECT_DIR="$DIR" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" bash "$HOOK" <<<'{"tool_input":{"file_path":"'"$DIR"'/ad.html"}}' 2>&1)
CODE=$?
if [ $CODE -eq 0 ] && [ ! -f "$DIR/.lincx-session.preview.pending" ]; then
  pass "case 1: no session state → no-op"
else
  fail "case 1: unexpected exit=$CODE marker=$([ -f "$DIR/.lincx-session.preview.pending" ] && echo yes || echo no) out=$OUT"
fi
rm -rf "$DIR"

# --- Case 2: session exists, untouched path → no marker ---
DIR=$(mktemp_dir)
cat > "$DIR/.lincx-session.json" <<'EOF'
{ "previewDisabled": false, "activeTemplates": [ { "id":"e1", "htmlPath":"ads/a.html", "cssPath":"ads/a.css", "previewPath":"ads/preview.html", "cagSchema":{"fields":[{"name":"headline","type":"string"}]} } ] }
EOF
CLAUDE_PROJECT_DIR="$DIR" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" bash "$HOOK" <<<'{"tool_input":{"file_path":"'"$DIR"'/unrelated.txt"}}' >/dev/null 2>&1
if [ ! -f "$DIR/.lincx-session.preview.pending" ]; then
  pass "case 2: untouched path → no dispatch"
else
  fail "case 2: marker appeared unexpectedly"
fi
rm -rf "$DIR"

# --- Case 3: matching path → marker appears and preview.html is produced ---
DIR=$(mktemp_dir)
mkdir -p "$DIR/ads"
cp "$PLUGIN_ROOT/tests/fixtures/simple-template/template.html" "$DIR/ads/a.html"
cp "$PLUGIN_ROOT/tests/fixtures/simple-template/template.css" "$DIR/ads/a.css"
SCHEMA=$(cat "$PLUGIN_ROOT/tests/fixtures/simple-template/cag-schema.json")
cat > "$DIR/.lincx-session.json" <<EOF
{ "previewDisabled": false, "previewOpened": true, "activeTemplates": [
  { "id":"e1", "htmlPath":"$DIR/ads/a.html", "cssPath":"$DIR/ads/a.css", "previewPath":"$DIR/ads/preview.html", "previewOpened": true, "cagSchema": $SCHEMA }
] }
EOF
CLAUDE_PROJECT_DIR="$DIR" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" bash "$HOOK" <<<'{"tool_input":{"file_path":"'"$DIR"'/ads/a.html"}}' >/dev/null 2>&1
for i in 1 2 3 4 5 6; do [ -f "$DIR/ads/preview.html" ] && break; sleep 0.5; done
if [ -f "$DIR/ads/preview.html" ]; then
  pass "case 3: matching path → preview.html produced"
else
  fail "case 3: preview.html not produced (log: $(cat "$DIR/.lincx-session.log" 2>/dev/null))"
fi
rm -rf "$DIR"

# --- Case 4: two rapid fires → marker mtime stays pinned to first ---
DIR=$(mktemp_dir)
mkdir -p "$DIR/ads"
cp "$PLUGIN_ROOT/tests/fixtures/simple-template/template.html" "$DIR/ads/a.html"
cp "$PLUGIN_ROOT/tests/fixtures/simple-template/template.css" "$DIR/ads/a.css"
cat > "$DIR/.lincx-session.json" <<EOF
{ "previewDisabled": false, "activeTemplates": [
  { "id":"e1", "htmlPath":"$DIR/ads/a.html", "cssPath":"$DIR/ads/a.css", "previewPath":"$DIR/ads/preview.html", "previewOpened": true, "cagSchema": $SCHEMA }
] }
EOF
CLAUDE_PROJECT_DIR="$DIR" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" bash "$HOOK" <<<'{"tool_input":{"file_path":"'"$DIR"'/ads/a.html"}}' >/dev/null 2>&1
FIRST_MARK=$(stat -f %m "$DIR/.lincx-session.preview.pending" 2>/dev/null || stat -c %Y "$DIR/.lincx-session.preview.pending" 2>/dev/null)
CLAUDE_PROJECT_DIR="$DIR" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" bash "$HOOK" <<<'{"tool_input":{"file_path":"'"$DIR"'/ads/a.html"}}' >/dev/null 2>&1
SECOND_MARK=$(stat -f %m "$DIR/.lincx-session.preview.pending" 2>/dev/null || stat -c %Y "$DIR/.lincx-session.preview.pending" 2>/dev/null)
if [ "$FIRST_MARK" = "$SECOND_MARK" ]; then
  pass "case 4: rapid second fire debounced"
else
  fail "case 4: marker mtime changed (first=$FIRST_MARK second=$SECOND_MARK)"
fi
rm -rf "$DIR"

if [ $FAIL -ne 0 ]; then echo "hook tests failed"; exit 1; fi
echo "hook tests passed"
```

- [ ] **Step 5: Make test executable**

Run: `chmod +x plugins/templates-editor-plugin/tests/hook.test.sh`

- [ ] **Step 6: Run the hook test**

Run from `plugins/templates-editor-plugin`: `bash tests/hook.test.sh`
Expected: four `✔` lines and `hook tests passed`.

- [ ] **Step 7: Commit**

```bash
git add plugins/templates-editor-plugin/hooks/ plugins/templates-editor-plugin/tests/hook.test.sh
git commit -m "feat(hook): PostToolUse preview-dispatch hook + fixture tests"
```

---

## Task 11: commands — six thin bootstraps

**Files:**
- Create: `plugins/templates-editor-plugin/commands/lincx-template-edit.md`
- Create: `plugins/templates-editor-plugin/commands/lincx-template-new.md`
- Create: `plugins/templates-editor-plugin/commands/lincx-template-save.md`
- Create: `plugins/templates-editor-plugin/commands/lincx-template-load-ads.md`
- Create: `plugins/templates-editor-plugin/commands/lincx-template-preview-toggle.md`
- Create: `plugins/templates-editor-plugin/commands/lincx-template-refresh-schema.md`

Each command is a Claude-invoked markdown file. Each tells Claude to run the orchestrator skill with specific intent.

- [ ] **Step 1: Write `lincx-template-edit.md`**

```markdown
---
description: Start an edit session for an existing Lincx template
argument-hint: <templateId>
---

Invoke the `editing-lincx-templates` skill in **adjust** mode with `templateId={{arg}}`. The skill will:
1. Verify Lincx auth (call `mcp__claude_ai_Lincx__auth_status`, prompt login if needed).
2. Ask the user for `htmlPath` and `cssPath` in their current project.
3. Call `mcp__claude_ai_Lincx__get_template(id={{arg}})`; write `html` and `css` to the chosen paths.
4. Call `mcp__claude_ai_Lincx__get_creative_asset_group(id=<creativeAssetGroupId from template>)`; cache the schema into session state.
5. Upsert a session-state entry in `./.lincx-session.json` via `scripts/session-state.mjs` with `{templateId, creativeAssetGroupId, htmlPath, cssPath, previewPath, version, dirty:false, cagSchema, mockAdsSource:{kind:"synthesized"}, mockAds:[]}`.
6. Trigger a first render (run `node ${CLAUDE_PLUGIN_ROOT}/scripts/preview-render.mjs <entryId>` directly) so the preview opens in the browser.

Do not modify files the skill flow doesn't explicitly instruct. Follow the consult-references rule in the skill body before proposing any HTML/CSS edits.
```

- [ ] **Step 2: Write `lincx-template-new.md`**

```markdown
---
description: Start a new Lincx template from scratch
argument-hint: <templateName>
---

Invoke the `editing-lincx-templates` skill in **from-scratch** mode with `templateName={{arg}}`. The skill will:
1. Verify Lincx auth.
2. Call `mcp__claude_ai_Lincx__list_creative_asset_groups` and ask the user to pick the `creativeAssetGroupId` to target.
3. Ask for `htmlPath` and `cssPath` in the user's current project; create empty files at those paths.
4. Call `mcp__claude_ai_Lincx__get_creative_asset_group(id=...)` and cache the schema in session state.
5. Upsert a session-state entry with `templateId: null`, the chosen paths, cached schema, and `mockAdsSource:{kind:"synthesized"}`.
6. Consult `references/` — follow the consult-references rule in the skill — and author initial HTML/CSS.

Every Edit/Write to the template files triggers the preview hook automatically.
```

- [ ] **Step 3: Write `lincx-template-save.md`**

```markdown
---
description: Save the current Lincx template session(s) — local artifact today, MCP write when available
---

Invoke the `editing-lincx-templates` skill's **save** flow:
1. Read `./.lincx-session.json`.
2. For each entry where `dirty:true`:
   - Detect whether `mcp__claude_ai_Lincx__save_template_version` is available this session.
   - If yes and `templateId` is set: call `saveAsync(entry, { mcpWriteAvailable: true, mcpWrite })` from `scripts/save-seam.mjs`, passing a small wrapper around the MCP call.
   - Else: call `save(entry, { mcpWriteAvailable: false })`.
3. Clear `dirty` on success.
4. Report: mode (`local` | `mcp`), artifact path or new version number, and the diff summary.

If nothing is dirty, say "nothing to save" and stop.
```

- [ ] **Step 4: Write `lincx-template-load-ads.md`**

```markdown
---
description: Load real ads from a Lincx zone as preview mock ads
argument-hint: <zoneId>
---

Invoke the `editing-lincx-templates` skill's **load-ads** flow with `zoneId={{arg}}`:
1. Ask the user which active-template entry to apply the mock ads to (if more than one).
2. Call `mcp__claude_ai_Lincx__get_zone_ads(id={{arg}})`; validate returned ads against the cached CAG schema via `validateAdsShape` from `scripts/preview-render.mjs` (if any ad fails, warn — the renderer will fall back to synthesized on preview).
3. Update the entry in session state: `mockAds: <returned ads>`, `mockAdsSource: { kind: "zone", zoneId: "{{arg}}" }`.
4. Directly invoke `node ${CLAUDE_PLUGIN_ROOT}/scripts/preview-render.mjs <entryId>` so the preview regenerates with the new ads.
```

- [ ] **Step 5: Write `lincx-template-preview-toggle.md`**

```markdown
---
description: Toggle automatic preview rendering on/off for this session
---

Invoke the `editing-lincx-templates` skill's **preview-toggle** flow:
1. Read `./.lincx-session.json`.
2. Flip `previewDisabled` (true ↔ false).
3. Write it back.
4. Report the new state.

If session state doesn't exist, say so and suggest starting with `/lincx-template-edit` or `/lincx-template-new`.
```

- [ ] **Step 6: Write `lincx-template-refresh-schema.md`**

```markdown
---
description: Re-fetch and cache the CAG schema for each active template entry
---

Invoke the `editing-lincx-templates` skill's **refresh-schema** flow:
1. Read `./.lincx-session.json`.
2. For each entry, call `mcp__claude_ai_Lincx__get_creative_asset_group(id=entry.creativeAssetGroupId)` and replace `cagSchema` in session state.
3. Directly invoke `node ${CLAUDE_PLUGIN_ROOT}/scripts/preview-render.mjs <entryId>` for each so the preview regenerates with the fresh schema.
4. Report which entries refreshed successfully and any MCP errors.
```

- [ ] **Step 7: Commit**

```bash
git add plugins/templates-editor-plugin/commands/
git commit -m "feat(commands): six slash commands bootstrapping the editor workflow"
```

---

## Task 12: the skill — `editing-lincx-templates`

**Files:**
- Create: `plugins/templates-editor-plugin/skills/editing-lincx-templates/SKILL.md`

- [ ] **Step 1: Write the skill**

Write `plugins/templates-editor-plugin/skills/editing-lincx-templates/SKILL.md`:

````markdown
---
name: editing-lincx-templates
description: Build and adjust Lincx ad templates (HTML+CSS). Use when the user asks to create, modify, preview, or save a Lincx template, or when a slash command in the `/lincx-template-*` family is invoked.
---

# Editing Lincx Templates

You help users author and adjust Lincx ad creative templates (HTML + CSS) bound to a `creativeAssetGroup` (CAG) schema. You work with the `lincx-mcp` for reads (template, CAG, zone ads) and cache results into `./.lincx-session.json` so a local preview loop runs automatically on every edit.

## Consult-references rule (MANDATORY before authoring)

Before proposing any template HTML or CSS:

1. Read `${CLAUDE_PLUGIN_ROOT}/references/README.md`.
2. Read the most relevant files under `${CLAUDE_PLUGIN_ROOT}/references/patterns/`.
3. If the user's request is covered by a pattern, follow that pattern exactly.
4. Only deviate when the request isn't covered by any pattern, or is trivially simple (e.g. "change this color to red").
5. When deviating, state in one sentence which pattern the work is closest to and why you're not following it exactly.

If `references/patterns/` is empty (user hasn't populated it yet):
- **For trivially simple requests** (color, copy, padding, single-line tweaks): proceed, noting the absence.
- **For any non-trivial authoring** (from-scratch templates, layout changes, new elements): stop and ask the user to either supply at least one example pattern or explicitly authorize a one-off deviation. Do not improvise.

## Session state

Single source of truth: `./.lincx-session.json` in the user's current working directory. Shape:

```json
{
  "previewDisabled": false,
  "activeTemplates": [
    {
      "id": "<stable id, e.g. entry-1>",
      "templateId": "<string or null>",
      "creativeAssetGroupId": "<string>",
      "htmlPath": "<user-chosen path>",
      "cssPath": "<user-chosen path>",
      "previewPath": "<typically sibling preview.html>",
      "version": "<number or null>",
      "dirty": false,
      "cagSchema": { "fields": [ ... ] },
      "mockAdsSource": { "kind": "synthesized" | "zone", "zoneId": "..." },
      "mockAds": []
    }
  ]
}
```

Use `${CLAUDE_PLUGIN_ROOT}/scripts/session-state.mjs` (`readSessionState`, `writeSessionState`, `upsertEntry`, `removeEntry`, `findEntryByPath`) via a small inline `node --input-type=module -e ...` invocation. Do not hand-parse the file.

## Flows

### Flow A — Adjust an existing template (from `/lincx-template-edit <id>`)

1. `auth_status` — if unauthenticated, tell the user to run `auth_login` and stop.
2. Ask the user where to place the files (prompt for `htmlPath` and `cssPath` under their current project). Do not default silently.
3. `get_template(id)` → write `html` and `css` to the chosen paths.
4. `get_creative_asset_group(id=<creativeAssetGroupId from template>)` → cache as `cagSchema`.
5. Upsert entry into `.lincx-session.json` (set `dirty:false`, `version` from template, `previewOpened:false`).
6. Dispatch a first render: `node ${CLAUDE_PLUGIN_ROOT}/scripts/preview-render.mjs <entryId>`. The browser opens.
7. Converse with the user. When authoring edits, apply the consult-references rule first. Every Edit/Write triggers the hook, which re-renders preview silently. Mark `dirty:true` after any write.
8. On `/lincx-template-save` → Flow C.

### Flow B — Build from scratch (from `/lincx-template-new <name>`)

1. `auth_status`.
2. `list_creative_asset_groups` → ask the user to pick a CAG. Record `creativeAssetGroupId`.
3. Ask for `htmlPath` and `cssPath`. Create empty files at those paths.
4. `get_creative_asset_group(id=<chosen>)` → cache `cagSchema`.
5. Upsert entry with `templateId:null`.
6. Consult references per the mandatory rule, ask a few shaping questions (layout family, purpose, constraints), then author initial HTML/CSS. Mark `dirty:true`.
7. Same live-preview loop as Flow A; same save path.

### Flow C — Save (from `/lincx-template-save`)

1. Read `.lincx-session.json`.
2. For each entry with `dirty:true`:
   - Determine if `mcp__claude_ai_Lincx__save_template_version` is available in this session's tools.
   - If yes and `templateId != null`: import `saveAsync` from `${CLAUDE_PLUGIN_ROOT}/scripts/save-seam.mjs`; wrap the MCP call in a `mcpWrite` function you pass in:
     ```
     async function mcpWrite({ templateId, html, css }) {
       // Call the MCP tool with these params; return { version }.
     }
     ```
     Call `saveAsync(entry, { mcpWriteAvailable: true, mcpWrite })`.
   - Else: import `save` and call `save(entry, { mcpWriteAvailable: false })`.
3. Clear `dirty`; if mode was `mcp`, update `version` from the result.
4. Print artifact path (local) or new version number (mcp), plus the diff summary.

### Flow D — Load ads (from `/lincx-template-load-ads <zoneId>`)

1. Identify the target entry (ask if > 1 active).
2. `get_zone_ads(id=<zoneId>)`.
3. Update entry: `mockAds: <returned>`, `mockAdsSource: { kind:"zone", zoneId }`.
4. Dispatch renderer so preview refreshes.

### Flow E — Preview toggle (from `/lincx-template-preview-toggle`)

1. Flip `previewDisabled` in session state.
2. Report new state.

### Flow F — Refresh schema (from `/lincx-template-refresh-schema`)

1. For each entry, `get_creative_asset_group(id=entry.creativeAssetGroupId)` → replace `cagSchema`.
2. Dispatch renderer for each.

## Never do

- Never render or open browsers yourself. The renderer does that.
- Never write to `versions/` yourself. The save seam does that.
- Never invent pattern conventions. The references are the source of truth.
- Never silently default path choices. Ask the user.
- Never push to Lincx via any route other than `save_template_version` (when the tool exists). No HTTP calls, no CLI shell-outs.

## On failure

- Auth missing → stop, ask for login, do not create session state.
- MCP call errors → surface inline; do not mutate session state.
- Corrupt session state → offer to archive as `.lincx-session.json.bak` and start fresh.
- Renderer or hook errors → check `./.lincx-session.log`.
````

- [ ] **Step 2: Commit**

```bash
git add plugins/templates-editor-plugin/skills/
git commit -m "feat(skill): editing-lincx-templates orchestrator with consult-references rule"
```

---

## Task 13: plugin README + smoke checklist

**Files:**
- Create: `plugins/templates-editor-plugin/README.md`
- Create: `plugins/templates-editor-plugin/tests/smoke.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# templates-editor-plugin

Build and adjust Lincx ad templates (HTML + CSS) from Claude Code with a live preview loop.

## What's inside

- Skill `editing-lincx-templates` — orchestrator that consults references, pulls via the Lincx MCP, applies edits, and runs the save flow.
- Slash commands: `/lincx-template-new`, `/lincx-template-edit`, `/lincx-template-save`, `/lincx-template-load-ads`, `/lincx-template-preview-toggle`, `/lincx-template-refresh-schema`.
- PostToolUse hook that auto-renders `preview.html` after any edit to a tracked template file.
- Local renderer (`scripts/preview-render.mjs`) that wires CAG-shaped mock ads into the HTML.
- Save seam (`scripts/save-seam.mjs`) that paste-ships today (versioned local artifact) and MCP-writes when a write tool lands.
- References library at `references/` — **populate `patterns/` and `rendering-convention.md` from your own template corpus.**

## Requirements

- Node (stdlib only — no `npm install`).
- `lincx-mcp` connected to your Claude session for the MCP-backed reads.

## Start a session

```
/lincx-template-edit <templateId>   # adjust an existing template
/lincx-template-new <name>          # build from scratch
```

The session lives in `./.lincx-session.json` in whatever directory you run Claude in.

## Save

```
/lincx-template-save
```

Today: writes a versioned single-file artifact at `<htmlDir>/versions/vN.html` (CSS inlined) for you to paste into Lincx. Tomorrow: calls the MCP write tool automatically once it ships — no config change needed.

## Tests

```
cd plugins/templates-editor-plugin
npm test
```

Runs node unit tests, the shell hook fixture, and the structural lint.

## Populating references

The plugin ships with stub references. Before authoring non-trivial templates, drop your real examples under `references/patterns/<name>/{example.html,example.css,notes.md}` and describe your tokenization convention in `references/rendering-convention.md`.
```

- [ ] **Step 2: Write `tests/smoke.md`**

```markdown
# Smoke checklist

Run once per non-trivial plugin change. Takes ~5 minutes.

## Setup
1. `cd` to a scratch project directory.
2. `claude` — Claude Code session.
3. Confirm lincx MCP is connected: `/mcp`.

## Flow
1. `/lincx-template-edit <knownTemplateId>`
   - Pick sensible paths (`ads/banner.html`, `ads/banner.css`).
   - Confirm the files appear, session state exists, preview opens in browser.
2. Make a small edit (change a color in CSS).
   - Confirm `preview.html` updates within ~2 s; refresh the browser tab.
3. `/lincx-template-load-ads <knownZoneId>`
   - Confirm preview now renders real ad content.
4. `/lincx-template-save`
   - Confirm `ads/versions/v1.html` exists and is self-contained (CSS inlined).
5. Make another edit; `/lincx-template-save` again.
   - Confirm `v2.html` appears and the diff summary references `v1 → v2`.
6. `/lincx-template-preview-toggle` → edit → confirm preview does **not** regenerate.
7. Toggle back on → edit → preview regenerates.
8. Open `./.lincx-session.log` — sanity-check hook/renderer messages.

## From-scratch flow
1. `/lincx-template-new test-banner`.
2. Pick a CAG.
3. Ask Claude to author a simple banner.
4. Confirm consult-references rule kicks in (Claude reads the references dir visibly).
5. Preview renders with synthesized ads.

## Failure paths to eyeball
- Corrupt `.lincx-session.json` — confirm Claude offers to archive and start fresh.
- MCP disconnected mid-session — confirm errors surface inline; cached schema preserved.
- Delete `ads/banner.html` between edit and render — confirm the log says `html missing` and nothing crashes.
```

- [ ] **Step 3: Commit**

```bash
git add plugins/templates-editor-plugin/README.md plugins/templates-editor-plugin/tests/smoke.md
git commit -m "docs: plugin README and smoke checklist"
```

---

## Task 14: run the full test suite and structural lint

- [ ] **Step 1: Ensure scripts are executable**

Run:
```bash
chmod +x plugins/templates-editor-plugin/hooks/post-edit-preview.sh
chmod +x plugins/templates-editor-plugin/tests/run-all.sh
chmod +x plugins/templates-editor-plugin/tests/hook.test.sh
```

- [ ] **Step 2: Run `npm test` from the plugin directory**

Run:
```bash
cd plugins/templates-editor-plugin && npm test
```

Expected output tail:
```
== unit tests ==
... 27 passed
== hook fixture ==
✔ case 1: ...
✔ case 2: ...
✔ case 3: ...
✔ case 4: ...
hook tests passed
== structural lint ==
✔ plugin structure ok
all tests passed
```

If anything fails, fix it before proceeding.

- [ ] **Step 3: Commit any fixups**

If fixups were needed:
```bash
git add -A && git commit -m "fix: address issues surfaced by full test run"
```

---

## Task 15: final manual verification — smoke flow with a real Lincx session

Run `plugins/templates-editor-plugin/tests/smoke.md` end-to-end. Manual — requires live Lincx MCP.

- [ ] **Step 1: Follow `tests/smoke.md` top to bottom.**
- [ ] **Step 2: Note any friction or unexpected behavior in a followup file.**
- [ ] **Step 3: When all steps pass, tag the plugin as v0.1.0**

Run:
```bash
git tag -a templates-editor-plugin-v0.1.0 -m "templates-editor-plugin v0.1.0"
```

---

## Self-review

**1. Spec coverage** (spec §-by-§ → task):
- Purpose / Context (§1–2) — covered by the whole plan.
- Components §3.1 skill → Task 12. §3.2 commands → Task 11. §3.3 hook → Task 10. §3.4 renderer → Task 6. §3.5 references → Task 9.
- Data flow §4.1 session state → Task 4. §4.2 adjust / §4.3 from-scratch / §4.4 save / §4.5 preview path → Tasks 11 + 12 wiring + Task 6 renderer.
- Save seam §5 → Task 7 (both local and MCP paths, fallback covered).
- Hook specifics §6 → Task 10.
- File layout §7 → Tasks 1–13 collectively.
- Error handling §8 — session state (Task 4), renderer (Task 6), save (Task 7), hook (Task 10), skill (Task 12 "On failure"). Node-missing → hook skips silently (Task 10 step 2 step 2 check).
- Testing §9 — Tasks 4–10 add unit tests + hook fixture; Task 8 structural lint; Task 13 smoke checklist; Task 3 test runner.
- Boundaries §10 — enforced by file layout + skill "Never do" section (Task 12).
- Out of scope §11 — no task does any of them; no bleed.

No gaps.

**2. Placeholder scan:** No "TBD"/"TODO"/"implement later". Every step has complete code or a complete command. Task 7 defines both sync `save` and async `saveAsync` with identical surface — no bridge code, no shims.

**3. Type / name consistency:**
- `readSessionState / writeSessionState / upsertEntry / removeEntry / findEntryByPath` — defined Task 4, used by name in Tasks 6, 10, 12. ✅
- `renderPreview / synthesizeMockAds / substituteTokens / validateAdsShape` — defined Task 6, used by name in Tasks 10 (fixture), 11 (load-ads command), 12 (skill). ✅
- `save / saveAsync / nextVersionNumber / buildArtifact / computeDiffSummary` — defined Task 7, used by name in Tasks 11 (save command), 12 (skill). ✅
- Session state shape — same field names across Tasks 4, 6, 11, 12 (`templateId`, `creativeAssetGroupId`, `htmlPath`, `cssPath`, `previewPath`, `cagSchema`, `mockAds`, `mockAdsSource`, `previewDisabled`, `dirty`, `version`, `previewOpened`). ✅
- Hook matcher `Write|Edit|MultiEdit` — Task 10 manifest, same wording in spec §6. ✅

No drift.
