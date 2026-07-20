# Zone Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `lincx-inventory` plugin whose `/zone-targeted` command lists every ad group directly targeted to a Lincx zone with an accurate enabled-state rollup (campaign → ad group → ad → creative), filterable to live/off, remembering the last zone.

**Architecture:** Skill orchestrates MCP read calls (scan all ad groups, fetch campaigns/ads/creatives for the matched set) and dumps raw entities to JSON; a pure, tested node helper (`zone-inventory-rollup.mjs`) does all boolean logic and formatting — MCP tools are unavailable to node, so this is the same skill-fetches / script-computes seam as `templates-editor-plugin/scripts/resolve-zone-and-ads.mjs`. A tiny `session-state.mjs` remembers the last zone.

**Tech Stack:** Node.js ESM (`.mjs`), `node:test` + `node:assert/strict` (no test framework), Claude Code plugin (skill + slash command + scripts), Lincx MCP tools.

## Global Constraints

- **Node ESM only** — `.mjs`, `import`/`export`, no CommonJS. All logic in scripts is **pure** (no MCP, no network) so it is unit-testable.
- **Tests use `node --test`** — `import test from 'node:test'`, `import assert from 'node:assert/strict'`. No new dependencies.
- **MCP tools referenced by bare name in the skill** (`get_zone`, `list_ad_groups`, `list_campaigns`, `list_ads`, `get_creative`) — matches `lincx-reports` SKILL convention. Never pass `networkId` (session-scoped upstream).
- **Enabled gate at every level:** `enabled === true && archived !== true`. `archived` is **omitted from list rows when false** — treat a missing `archived` key as `false`.
- **Viability is a per-ad conjunction:** `has_live_viable_ad = ∃ ad: ad.enabled && !ad.archived && creativeResolves(ad.creativeId)`. Never combine a separate "some enabled ad" flag with a separate "some creative resolves" flag.
- **`exceptParams.zoneId` = exclusion.** Zone only in `exceptParams` → not targeted. Zone in both `params.zoneId` and `exceptParams.zoneId` → excluded but reported as `conflicting`.
- **Exhaustive scan is mandatory** — no `zoneId` filter exists on `list_ad_groups`; the whole network's ad groups must be paged. Scan at `limit:50` (field-expanded rows are size-capped at `limit:100`).
- **plugin.json** requires non-empty `name`, `version`, `description` (enforced by `check-plugin.mjs`).
- **Commit after every task.** Conventional Commit messages, end body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

- `plugins/lincx-inventory/scripts/zone-inventory-rollup.mjs` — pure logic: `selectTargeted`, `rollup`, `formatReport`, `cli`. The only real logic; fully tested.
- `plugins/lincx-inventory/scripts/session-state.mjs` — remember last zone: `readState`, `writeState`, `getLastZone`, `setLastZone`.
- `plugins/lincx-inventory/scripts/check-plugin.mjs` — structural lint for this plugin.
- `plugins/lincx-inventory/tests/zone-inventory-rollup.test.mjs` — unit tests for the rollup helper (incl. rendered∩targeted ⊆ live self-check).
- `plugins/lincx-inventory/tests/session-state.test.mjs` — unit tests for session state.
- `plugins/lincx-inventory/tests/run-all.sh` — runs unit tests + structural lint.
- `plugins/lincx-inventory/commands/zone-targeted.md` — `/zone-targeted [zoneId] [all|live|off]`.
- `plugins/lincx-inventory/skills/zone-targeted/SKILL.md` — orchestration prose.
- `plugins/lincx-inventory/.claude-plugin/plugin.json` — manifest.
- `.claude-plugin/marketplace.json` — add the `lincx-inventory` entry.

---

## Task 1: Pure rollup helper

**Files:**
- Create: `plugins/lincx-inventory/scripts/zone-inventory-rollup.mjs`
- Test: `plugins/lincx-inventory/tests/zone-inventory-rollup.test.mjs`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `selectTargeted(adGroups, zoneId) → { targeted: AdGroup[], conflicting: AdGroup[] }`
  - `rollup({ zoneId, zoneCagId, targeted, conflicting, campaigns, adsByGroup, creatives, mode }) → { rows: Row[], summary }`
  - `formatReport({ zoneId, mode, rows, summary }) → string`
  - `cli(argv) → number`
  - Shapes:
    - `AdGroup = { id, name, enabled, archived?, params: { zoneId?: string[] }, exceptParams?: { zoneId?: string[] }, campaignId, creativeAssetGroupId }`
    - `campaigns = { [campaignId]: { enabled, archived? } }`
    - `adsByGroup = { [adGroupId]: Array<{ id, enabled, archived?, creativeId }> }`
    - `creatives = { [creativeId]: { creativeAssetGroupId } | null }` (`null` = did not resolve)
    - `Row = { id, name, archived, campaign_on, adgroup_on, has_enabled_ad, creative_resolves, has_live_viable_ad, fully_live, off_reason: string[] }`
    - `summary = { targeted, live, off, archived, conflicting }`

- [ ] **Step 1: Write the failing test**

Create `plugins/lincx-inventory/tests/zone-inventory-rollup.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTargeted, rollup, formatReport } from '../scripts/zone-inventory-rollup.mjs';

const ZONE = '8z7wzb';
const CAG = '0bckt2';

function ag(over = {}) {
  return {
    id: 'ag1', name: 'AG1', enabled: true,
    params: { zoneId: [ZONE] }, campaignId: 'c1', creativeAssetGroupId: CAG,
    ...over,
  };
}

// ---- selectTargeted ----

test('selectTargeted keeps groups whose params.zoneId includes the zone', () => {
  const groups = [ag({ id: 'a' }), ag({ id: 'b', params: { zoneId: ['other'] } })];
  const { targeted, conflicting } = selectTargeted(groups, ZONE);
  assert.deepEqual(targeted.map(g => g.id), ['a']);
  assert.deepEqual(conflicting, []);
});

test('selectTargeted ignores a group with the zone only in exceptParams', () => {
  const groups = [ag({ id: 'x', params: { zoneId: ['other'] }, exceptParams: { zoneId: [ZONE] } })];
  const { targeted } = selectTargeted(groups, ZONE);
  assert.deepEqual(targeted, []);
});

test('selectTargeted flags a group with the zone in BOTH params and exceptParams as conflicting, not targeted', () => {
  const groups = [ag({ id: 'y', params: { zoneId: [ZONE] }, exceptParams: { zoneId: [ZONE] } })];
  const { targeted, conflicting } = selectTargeted(groups, ZONE);
  assert.deepEqual(targeted, []);
  assert.deepEqual(conflicting.map(g => g.id), ['y']);
});

// ---- rollup: level flags ----

function base(over = {}) {
  return {
    zoneId: ZONE, zoneCagId: CAG,
    targeted: [ag()], conflicting: [],
    campaigns: { c1: { enabled: true } },
    adsByGroup: { ag1: [{ id: 'ad1', enabled: true, creativeId: 'cr1' }] },
    creatives: { cr1: { creativeAssetGroupId: CAG } },
    mode: 'all',
    ...over,
  };
}

test('fully_live when campaign, ad group, and a live+viable ad are all on', () => {
  const { rows, summary } = rollup(base());
  assert.equal(rows[0].fully_live, true);
  assert.deepEqual(rows[0].off_reason, []);
  assert.equal(summary.live, 1);
  assert.equal(summary.off, 0);
});

test('campaign off → not live, off_reason names campaign', () => {
  const { rows } = rollup(base({ campaigns: { c1: { enabled: false } } }));
  assert.equal(rows[0].campaign_on, false);
  assert.equal(rows[0].fully_live, false);
  assert.deepEqual(rows[0].off_reason, ['campaign']);
});

test('ad group enabled but archived → forced off, off_reason names archived', () => {
  const { rows, summary } = rollup(base({ targeted: [ag({ enabled: true, archived: true })] }));
  assert.equal(rows[0].archived, true);
  assert.equal(rows[0].adgroup_on, false);
  assert.equal(rows[0].fully_live, false);
  assert.deepEqual(rows[0].off_reason, ['archived']);
  assert.equal(summary.archived, 1);
});

test('per-ad conjunction: enabled ad with dangling creative + disabled ad with valid creative → NOT live-viable', () => {
  const { rows } = rollup(base({
    adsByGroup: { ag1: [
      { id: 'ad1', enabled: true, creativeId: 'missing' },   // enabled but creative does not resolve
      { id: 'ad2', enabled: false, creativeId: 'cr1' },       // valid creative but disabled
    ] },
    creatives: { cr1: { creativeAssetGroupId: CAG }, missing: null },
  }));
  assert.equal(rows[0].has_enabled_ad, true);       // diagnostic: yes, ad1 is enabled
  assert.equal(rows[0].creative_resolves, true);    // diagnostic: yes, cr1 resolves
  assert.equal(rows[0].has_live_viable_ad, false);  // but no SINGLE ad is both
  assert.equal(rows[0].fully_live, false);
  assert.deepEqual(rows[0].off_reason, ['no_live_viable_ad']);
});

test('archived ad is not a live ad', () => {
  const { rows } = rollup(base({
    adsByGroup: { ag1: [{ id: 'ad1', enabled: true, archived: true, creativeId: 'cr1' }] },
  }));
  assert.equal(rows[0].has_live_viable_ad, false);
});

// ---- mode filter ----

test('mode "off" returns only not-fully-live rows', () => {
  const { rows } = rollup(base({
    targeted: [ag({ id: 'ag1' }), ag({ id: 'ag2', campaignId: 'c2' })],
    campaigns: { c1: { enabled: true }, c2: { enabled: false } },
    adsByGroup: {
      ag1: [{ id: 'ad1', enabled: true, creativeId: 'cr1' }],
      ag2: [{ id: 'ad2', enabled: true, creativeId: 'cr1' }],
    },
    mode: 'off',
  }));
  assert.deepEqual(rows.map(r => r.id), ['ag2']);
});

// ---- rendered ∩ targeted ⊆ live self-check ----

test('every known-rendered targeted ad group rolls up fully_live (rendered∩targeted ⊆ live)', () => {
  const rendered = ['cb1v4z', 'pa8vkn', 'szg7re', 'hu4gni', 'fvg5m6', 'zfcgde', '6ianjo', 'mke6ol', 'vd1stu'];
  const targeted = rendered.map(id => ag({ id, campaignId: `camp_${id}` }));
  const campaigns = Object.fromEntries(rendered.map(id => [`camp_${id}`, { enabled: true }]));
  const adsByGroup = Object.fromEntries(rendered.map(id => [id, [{ id: `ad_${id}`, enabled: true, creativeId: `cr_${id}` }]]));
  const creatives = Object.fromEntries(rendered.map(id => [`cr_${id}`, { creativeAssetGroupId: CAG }]));
  const { rows } = rollup({ zoneId: ZONE, zoneCagId: CAG, targeted, conflicting: [], campaigns, adsByGroup, creatives, mode: 'all' });
  for (const r of rows) assert.equal(r.fully_live, true, `${r.id} should be fully_live`);
});

// ---- formatReport ----

test('formatReport renders a markdown table with a summary line', () => {
  const { rows, summary } = rollup(base());
  const out = formatReport({ zoneId: ZONE, mode: 'all', rows, summary });
  assert.match(out, /AG1/);
  assert.match(out, /1 targeted/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/lincx-inventory/tests/zone-inventory-rollup.test.mjs`
Expected: FAIL — `Cannot find module '../scripts/zone-inventory-rollup.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `plugins/lincx-inventory/scripts/zone-inventory-rollup.mjs`:

```js
import { readFileSync } from 'node:fs';

// A level (campaign / ad group / ad) is "on" only if enabled and not archived.
// archived is omitted when false, so `!== true` treats a missing key as false.
const on = (x) => !!x && x.enabled === true && x.archived !== true;

const has = (arr, v) => Array.isArray(arr) && arr.includes(v);

/** Split scanned ad groups into those directly targeting the zone and those
 * that both target and except it (conflicting). exceptParams-only groups are
 * neither (not targeted). */
export function selectTargeted(adGroups, zoneId) {
  const targeted = [];
  const conflicting = [];
  for (const ag of adGroups) {
    const inParams = has(ag.params?.zoneId, zoneId);
    const inExcept = has(ag.exceptParams?.zoneId, zoneId);
    if (inParams && inExcept) conflicting.push(ag);
    else if (inParams) targeted.push(ag);
  }
  return { targeted, conflicting };
}

/** Roll up enabled-state across campaign → ad group → ad → creative for each
 * targeted ad group. Returns rows filtered by mode plus a summary. */
export function rollup({ zoneId, zoneCagId, targeted, conflicting = [], campaigns, adsByGroup, creatives, mode = 'all' }) {
  const resolves = (creativeId) => creatives[creativeId] != null;

  const allRows = targeted.map((ag) => {
    const campaign = campaigns[ag.campaignId];
    const ads = adsByGroup[ag.id] ?? [];

    const campaign_on = on(campaign);
    const adgroup_on = on(ag);
    const has_enabled_ad = ads.some(on);                                  // diagnostic
    const creative_resolves = ads.some((a) => resolves(a.creativeId));    // diagnostic
    const has_live_viable_ad = ads.some((a) => on(a) && resolves(a.creativeId));
    const archived = ag.archived === true;

    const off_reason = [];
    if (!campaign_on) off_reason.push('campaign');
    if (!adgroup_on) off_reason.push(archived ? 'archived' : 'adgroup');
    if (!has_live_viable_ad) off_reason.push('no_live_viable_ad');

    const fully_live = campaign_on && adgroup_on && has_live_viable_ad;
    return { id: ag.id, name: ag.name, archived, campaign_on, adgroup_on, has_enabled_ad, creative_resolves, has_live_viable_ad, fully_live, off_reason };
  });

  const summary = {
    targeted: allRows.length,
    live: allRows.filter((r) => r.fully_live).length,
    off: allRows.filter((r) => !r.fully_live).length,
    archived: allRows.filter((r) => r.archived).length,
    conflicting: conflicting.length,
  };

  const rows = mode === 'live' ? allRows.filter((r) => r.fully_live)
    : mode === 'off' ? allRows.filter((r) => !r.fully_live)
    : allRows;

  return { rows, summary };
}

/** Render rows + summary as a markdown table. */
export function formatReport({ zoneId, mode, rows, summary }) {
  const flag = (b) => (b ? '✅' : '❌');
  const lines = [];
  lines.push(`## Zone ${zoneId} — targeted ad groups (${mode})`);
  lines.push('');
  lines.push(`${summary.targeted} targeted · ${summary.live} live · ${summary.off} off · ${summary.archived} archived · ${summary.conflicting} conflicting`);
  lines.push('');
  lines.push('| Ad group | Campaign | Ad group | Live+viable ad | Fully live | Off at |');
  lines.push('|---|---|---|---|---|---|');
  for (const r of rows) {
    const name = r.archived ? `${r.name} (archived)` : r.name;
    lines.push(`| ${name} (${r.id}) | ${flag(r.campaign_on)} | ${flag(r.adgroup_on)} | ${flag(r.has_live_viable_ad)} | ${flag(r.fully_live)} | ${r.off_reason.join(', ') || '—'} |`);
  }
  return lines.join('\n');
}

// CLI: node zone-inventory-rollup.mjs <inputJsonPath> [mode]
// input JSON = { zoneId, zoneCagId, adGroups, campaigns, adsByGroup, creatives }
// adGroups is the FULL scan; selection happens here.
export function cli(argv) {
  const [inputPath, mode = 'all'] = argv;
  if (!inputPath) {
    process.stderr.write('usage: zone-inventory-rollup <inputJsonPath> [all|live|off]\n');
    return 2;
  }
  const input = JSON.parse(readFileSync(inputPath, 'utf8'));
  const { targeted, conflicting } = selectTargeted(input.adGroups, input.zoneId);
  const { rows, summary } = rollup({
    zoneId: input.zoneId, zoneCagId: input.zoneCagId,
    targeted, conflicting,
    campaigns: input.campaigns, adsByGroup: input.adsByGroup, creatives: input.creatives,
    mode,
  });
  process.stdout.write(formatReport({ zoneId: input.zoneId, mode, rows, summary }) + '\n');
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(cli(process.argv.slice(2)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/lincx-inventory/tests/zone-inventory-rollup.test.mjs`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add plugins/lincx-inventory/scripts/zone-inventory-rollup.mjs plugins/lincx-inventory/tests/zone-inventory-rollup.test.mjs
git commit -m "feat(lincx-inventory): pure zone-targeting rollup helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Session state (remember last zone)

**Files:**
- Create: `plugins/lincx-inventory/scripts/session-state.mjs`
- Test: `plugins/lincx-inventory/tests/session-state.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `readState(filePath) → { lastZoneId?: string } | null`
  - `writeState(filePath, state) → void`
  - `getLastZone(filePath) → string | null`
  - `setLastZone(filePath, zoneId) → void`

- [ ] **Step 1: Write the failing test**

Create `plugins/lincx-inventory/tests/session-state.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readState, writeState, getLastZone, setLastZone } from '../scripts/session-state.mjs';

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-zone-'));
  return { path: join(dir, 'state.json'), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('getLastZone returns null when no state file exists', () => {
  const { path, cleanup } = tmp();
  try { assert.equal(getLastZone(path), null); } finally { cleanup(); }
});

test('setLastZone then getLastZone round-trips the zone id', () => {
  const { path, cleanup } = tmp();
  try {
    setLastZone(path, '8z7wzb');
    assert.equal(getLastZone(path), '8z7wzb');
  } finally { cleanup(); }
});

test('setLastZone preserves other state keys', () => {
  const { path, cleanup } = tmp();
  try {
    writeState(path, { lastZoneId: 'old', other: 1 });
    setLastZone(path, 'new');
    assert.deepEqual(readState(path), { lastZoneId: 'new', other: 1 });
  } finally { cleanup(); }
});

test('readState throws CORRUPT_SESSION_STATE on invalid JSON', () => {
  const { path, cleanup } = tmp();
  try {
    writeFileSync(path, '{ not json');
    assert.throws(() => readState(path), /CORRUPT_SESSION_STATE/);
  } finally { cleanup(); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/lincx-inventory/tests/session-state.test.mjs`
Expected: FAIL — `Cannot find module '../scripts/session-state.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `plugins/lincx-inventory/scripts/session-state.mjs`:

```js
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export function readState(filePath) {
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

export function writeState(filePath, state) {
  writeFileSync(filePath, JSON.stringify(state, null, 2) + '\n');
}

export function getLastZone(filePath) {
  const state = readState(filePath);
  return state?.lastZoneId ?? null;
}

export function setLastZone(filePath, zoneId) {
  const state = readState(filePath) ?? {};
  writeState(filePath, { ...state, lastZoneId: zoneId });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/lincx-inventory/tests/session-state.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/lincx-inventory/scripts/session-state.mjs plugins/lincx-inventory/tests/session-state.test.mjs
git commit -m "feat(lincx-inventory): session state to remember last zone

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Plugin scaffold, lint, and test runner

**Files:**
- Create: `plugins/lincx-inventory/.claude-plugin/plugin.json`
- Create: `plugins/lincx-inventory/scripts/check-plugin.mjs`
- Create: `plugins/lincx-inventory/tests/run-all.sh`
- Modify: `.claude-plugin/marketplace.json` (add the plugin entry)

**Interfaces:**
- Consumes: the scripts/tests from Tasks 1–2.
- Produces: `node scripts/check-plugin.mjs` exits 0 once all Task-4 files also exist; `tests/run-all.sh` runs everything.

- [ ] **Step 1: Create the manifest**

Create `plugins/lincx-inventory/.claude-plugin/plugin.json`:

```json
{
  "name": "lincx-inventory",
  "description": "Inventory queries over Lincx config — starting with /zone-targeted: every ad group directly targeted to a zone and whether it's fully live.",
  "version": "0.1.0",
  "author": {
    "name": "Lincx"
  }
}
```

- [ ] **Step 2: Add the marketplace entry**

In `.claude-plugin/marketplace.json`, add to the `plugins` array (after the `lincx-reports` entry):

```json
    {
      "name": "lincx-inventory",
      "source": "./plugins/lincx-inventory",
      "description": "Inventory queries over Lincx config — zone targeting rollups, live/off filtering"
    }
```

- [ ] **Step 3: Write the structural lint**

Create `plugins/lincx-inventory/scripts/check-plugin.mjs`:

```js
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
  'scripts/zone-inventory-rollup.mjs',
  'scripts/session-state.mjs',
  'commands/zone-targeted.md',
  'skills/zone-targeted/SKILL.md',
]) check(existsSync(join(pluginRoot, p)), `missing: ${p}`);

if (errors.length) {
  for (const e of errors) console.error('✖', e);
  process.exit(1);
}
console.log('✔ plugin structure ok');
```

- [ ] **Step 4: Write the test runner**

Create `plugins/lincx-inventory/tests/run-all.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== unit tests =="
node --test tests/*.test.mjs

echo "== structural lint =="
node scripts/check-plugin.mjs

echo "all tests passed"
```

- [ ] **Step 5: Make the runner executable**

Run: `chmod +x plugins/lincx-inventory/tests/run-all.sh`
Expected: no output, exit 0.

- [ ] **Step 6: Verify the marketplace JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 7: Commit** (lint will still fail until Task 4 adds the command + skill — that is expected; the runner is committed here, run green at the end of Task 4)

```bash
git add plugins/lincx-inventory/.claude-plugin/plugin.json plugins/lincx-inventory/scripts/check-plugin.mjs plugins/lincx-inventory/tests/run-all.sh .claude-plugin/marketplace.json
git commit -m "feat(lincx-inventory): plugin scaffold, lint, test runner, marketplace entry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Command + orchestration skill, and green test run

**Files:**
- Create: `plugins/lincx-inventory/commands/zone-targeted.md`
- Create: `plugins/lincx-inventory/skills/zone-targeted/SKILL.md`

**Interfaces:**
- Consumes: `zone-inventory-rollup.mjs` (`cli`), `session-state.mjs` (`getLastZone`/`setLastZone`), MCP read tools.
- Produces: the user-facing `/zone-targeted` behavior. Terminal deliverable — after this, `tests/run-all.sh` is green.

- [ ] **Step 1: Write the command**

Create `plugins/lincx-inventory/commands/zone-targeted.md`:

```markdown
---
description: List every ad group directly targeted to a Lincx zone and whether it is fully live (campaign+adgroup+ad enabled with a viable creative), or where it is off
argument-hint: "[zoneId] [all|live|off]"
---

Invoke the `zone-targeted` skill with arguments `{{args}}`.

Argument parsing:
- A token matching `^[a-z0-9]{6}$` (or any non-mode token) is the **zoneId**.
- A token that is exactly `all`, `live`, or `off` is the **mode** (default `all`).
- If no zoneId is given, reuse the last remembered zone via
  `node ${CLAUDE_PLUGIN_ROOT}/scripts/session-state.mjs` (`getLastZone`). If there is
  no remembered zone, ask the user for one.
- When a zoneId is given, remember it (`setLastZone`) before running.

Then follow the skill's flow exactly.
```

- [ ] **Step 2: Write the orchestration skill**

Create `plugins/lincx-inventory/skills/zone-targeted/SKILL.md`:

```markdown
---
name: zone-targeted
description: Use when the user asks which ad groups are directly targeted to a Lincx zone, or whether a zone's targeted ad groups are live/off — the exhaustive zone-targeting inventory with an enabled-state rollup. Backs the /zone-targeted command.
---

# Lincx — Zone targeting inventory

Answer: "For zone Z, list every ad group **directly targeted** to it, and for each
whether it is **fully live** (campaign + ad group + ad all enabled with a viable
creative attached) or **where it is off**." Exhaustive — no targeted ad group missing.

## Inputs
- `zoneId` — required (the command resolves it, remembering the last one).
- `mode` — `all` (default) | `live` (only fully-live) | `off` (only not-fully-live).

## Rollup rules (the helper enforces these — do not reimplement in prose)
- A level is **on** only if `enabled === true && archived !== true`. `archived` is
  omitted from list rows when false — a missing key means not archived.
- `fully_live = campaign_on && adgroup_on && has_live_viable_ad`.
- `has_live_viable_ad` is a **per-ad conjunction**: some single ad is enabled,
  not archived, AND its `creativeId` resolves to a creative. Never mix "some
  enabled ad" with "some resolving creative" across different ads.
- **Targeting** = the zone appears in the ad group's `params.zoneId`.
  `exceptParams.zoneId` is an **exclusion**: zone only in exceptParams → not
  targeted; zone in both → excluded, reported as `conflicting`.

## Flow (issue each fan-out as ONE parallel batch of tool calls)

1. **Confirm the zone.** `get_zone(id=zoneId)`. Capture its `creativeAssetGroupId`
   (the CAG) and `templateId` for the header. If it 404s, surface and stop.

2. **Exhaustive scan of ALL ad groups** (no zoneId filter exists upstream):
   - Call `list_ad_groups(limit: 50, offset: 0, fields: ["name","params","exceptParams","enabled","archived","campaignId","creativeAssetGroupId"])`.
     Read `total`.
   - **Fan out the remaining offsets in one parallel batch**: `offset = 50, 100, …`
     up to `total`. Do NOT page one-at-a-time.
   - Use `limit: 50` (not 100): field-expanded rows are size-capped and a
     `limit:100` page can silently truncate. For each page assert the returned
     item count equals `min(limit, total - offset)`; if short, refetch that offset
     at a smaller limit before trusting the scan.
   - Collect every row into one `adGroups` array. Report the page count + total
     scanned so exhaustiveness is visible.

3. **Select the matched set locally** by running the helper's `selectTargeted`
   (via the CLI in step 6, or mentally: `params.zoneId ∋ zoneId`, minus
   exceptParams conflicts). You need the matched `campaignId`s and ad-group `id`s
   to scope the next calls.

4. **Fetch rollup inputs for the matched set** (parallel batches, deduped):
   - **Campaigns:** page `list_campaigns(limit: 100, offset: …)` across the whole
     network (rows carry `enabled` + `archived`), fanned out in one batch, and
     build `campaigns = { [id]: { enabled, archived } }`. (One map, reused for all
     matched groups — fewer calls than per-campaign gets.)
   - **Ads by campaign, not by group:** dedupe the matched `campaignId`s, then
     `list_ads(campaignId: X, fields: ["adGroupId","creativeId","enabled","archived"])`
     per unique campaign (parallel), and bucket rows into
     `adsByGroup = { [adGroupId]: [ads] }` (keep only matched ad-group ids).
   - **Creatives:** dedupe the `creativeId`s of the enabled ads, `get_creative(id)`
     each (parallel). Build `creatives = { [id]: { creativeAssetGroupId } }`; a
     creative that does not resolve → `null`.

5. **Write one JSON file** to the scratchpad with shape
   `{ zoneId, zoneCagId, adGroups, campaigns, adsByGroup, creatives }` where
   `adGroups` is the FULL scan (the helper does the selection).

6. **Run the helper** — it does all boolean logic and formatting:
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/zone-inventory-rollup.mjs <jsonPath> <mode>`
   Print its markdown output verbatim.

7. **Add the header** above the table: zone name, CAG, template, and the scan
   receipt (pages fetched / total scanned). If `summary.conflicting > 0`, note the
   conflicting ad groups (targeted AND excepted) below the table.

## Guardrails
- Never pass `networkId` to any tool — it is session-scoped upstream.
- On `"Error: Not authenticated…"` surface it and ask the user to run `auth_login`;
  do not retry. On `"Error: Forbidden…"` check the active network and offer to switch.
- If a scan page truncates even at a smaller limit, say so — do not present a
  partial list as exhaustive.

## Out of scope (do not build here)
"Free radicals" — ad groups targeted to no zone that still render via the zone's
shared CAG. Those are eligibility, not direct targeting; a later command.
```

- [ ] **Step 3: Run the structural lint (now passes)**

Run: `node plugins/lincx-inventory/scripts/check-plugin.mjs`
Expected: `✔ plugin structure ok`.

- [ ] **Step 4: Run the full suite green**

Run: `bash plugins/lincx-inventory/tests/run-all.sh`
Expected: unit tests pass, `✔ plugin structure ok`, `all tests passed`.

- [ ] **Step 5: Smoke-test the CLI end to end**

Run:
```bash
cat > /tmp/zi-smoke.json <<'JSON'
{
  "zoneId": "8z7wzb", "zoneCagId": "0bckt2",
  "adGroups": [
    { "id": "ag1", "name": "Live AG", "enabled": true, "params": { "zoneId": ["8z7wzb"] }, "campaignId": "c1", "creativeAssetGroupId": "0bckt2" },
    { "id": "ag2", "name": "Off AG", "enabled": true, "params": { "zoneId": ["8z7wzb"] }, "campaignId": "c2", "creativeAssetGroupId": "0bckt2" },
    { "id": "ag3", "name": "Other zone", "enabled": true, "params": { "zoneId": ["zzzzzz"] }, "campaignId": "c1", "creativeAssetGroupId": "0bckt2" }
  ],
  "campaigns": { "c1": { "enabled": true }, "c2": { "enabled": false } },
  "adsByGroup": {
    "ag1": [{ "id": "ad1", "enabled": true, "creativeId": "cr1" }],
    "ag2": [{ "id": "ad2", "enabled": true, "creativeId": "cr1" }]
  },
  "creatives": { "cr1": { "creativeAssetGroupId": "0bckt2" } }
}
JSON
node plugins/lincx-inventory/scripts/zone-inventory-rollup.mjs /tmp/zi-smoke.json all
```
Expected: a markdown table with **2** rows (ag1, ag2 — ag3 excluded as other-zone); ag1 fully live ✅, ag2 off at `campaign`; summary line `2 targeted · 1 live · 1 off`.

- [ ] **Step 6: Commit**

```bash
git add plugins/lincx-inventory/commands/zone-targeted.md plugins/lincx-inventory/skills/zone-targeted/SKILL.md
git commit -m "feat(lincx-inventory): /zone-targeted command + orchestration skill

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Live end-to-end validation against zone 8z7wzb

**Files:** none (validation only).

**Interfaces:**
- Consumes: the whole plugin + live Lincx MCP session on network `7jdz0n`.

- [ ] **Step 1: Confirm the active network**

Call `auth_status`. Expected: `active_network` is `7jdz0n` (Core Digital). If not, `network_switch` to it.

- [ ] **Step 2: Run the skill for real**

Drive the `zone-targeted` skill flow for `zoneId=8z7wzb`, `mode=all`: `get_zone`,
the parallel scan of all ~1150 ad groups at `limit:50`, the campaign/ads/creative
fan-outs, write the JSON, run the helper.

- [ ] **Step 3: Verify exhaustiveness + the rendered∩targeted invariant**

- Scan receipt total matches `list_ad_groups` `total`.
- Cross-check: call `get_zone_ads(zoneId=8z7wzb)` (default geo). Every returned ad
  group that is ALSO in the targeted set MUST appear as `fully_live` in the table.
  A rendered+targeted ad group shown `off` is a bug — investigate before shipping.

- [ ] **Step 4: Spot-check one off row**

Pick one ad group the table marks `off` and open its entities (`get_ad_group`,
`get_campaign`, `list_ads`) to confirm the named `off_reason` is correct.

- [ ] **Step 5: Verify memory + filters**

- Run the skill again with NO zoneId → it reuses `8z7wzb`.
- Run with `mode=off` → only not-live rows. Run with `mode=live` → only live rows.

- [ ] **Step 6: No commit** (validation only). Record findings; if a bug surfaces, fix in the relevant task's file and re-run its test.
```
