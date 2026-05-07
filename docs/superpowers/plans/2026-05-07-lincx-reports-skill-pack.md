# Lincx Reports Skill Pack — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Claude Code plugin in `lincx-marketplace` that gives managers three manager-friendly reports (campaign performance, revenue summary, creative anomalies) by orchestrating the existing `lincx-mcp-server` tools — no new API capability, read-only, with a strict narrative + table + footer output contract.

**Architecture:** A router skill dispatches to one of three sub-skills based on intent; sub-skills orchestrate `list_*`, `list_dimension_sets`/`get_dimension_set`, and `report_query` calls; shared helpers in `_shared/` carry date-parsing, dimension discovery, MCP call patterns, and the output template. A `node --test` static-check suite enforces frontmatter, MCP tool-name validity (against a checked-in snapshot of `mcp/src/tools/*.ts`), and shared-reference resolution.

**Tech Stack:**
- Claude Code plugin format (auto-discovered `skills/*/SKILL.md` files)
- Node 18+ stdlib only — `node:test`, `node:fs`, `node:path` (matches existing marketplace convention; zero `npm install` needed for users)
- Bash for the test runner glue (`tests/run-all.sh`)
- The MCP server at `mcp/src/tools/*.ts` is the source of truth; we capture its surface in `tests/fixtures/mcp-tools.json` via a sync script.

**Spec:** [`docs/superpowers/specs/2026-05-07-lincx-reports-skill-pack-design.md`](../specs/2026-05-07-lincx-reports-skill-pack-design.md)

**Spec deviation:** Spec said vitest; the existing `templates-editor-plugin` uses `node --test` with stdlib only. We follow the existing convention.

---

## File Structure

**Created (all under `lincx-marketplace/plugins/lincx-reports/`):**
- `.claude-plugin/plugin.json` — plugin manifest
- `package.json` — `test` and `test:lint` scripts
- `README.md` — install + usage
- `scripts/check-plugin.mjs` — static structure checks
- `scripts/sync-mcp-tools.mjs` — regenerate the MCP-tools snapshot from a sibling checkout of `mcp/`
- `skills/lincx-reports/SKILL.md` — router
- `skills/lincx-campaign-performance/SKILL.md`
- `skills/lincx-campaign-performance/references/dimension-cheatsheet.md`
- `skills/lincx-revenue-summary/SKILL.md`
- `skills/lincx-creative-anomalies/SKILL.md`
- `skills/_shared/date-range.md`
- `skills/_shared/output-template.md`
- `skills/_shared/dimension-discovery.md`
- `skills/_shared/mcp-call-patterns.md`
- `tests/fixtures/mcp-tools.json` — generated snapshot
- `tests/golden/campaign-performance.md`
- `tests/golden/revenue-summary.md`
- `tests/golden/creative-anomalies.md`
- `tests/run-all.sh` — entrypoint
- `tests/manifest.test.mjs` — manifest sanity
- `tests/skill-frontmatter.test.mjs` — every SKILL.md has valid frontmatter
- `tests/tool-references.test.mjs` — every tool name referenced exists in the snapshot
- `tests/shared-references.test.mjs` — every `_shared/*.md` reference resolves

**Modified:**
- `lincx-marketplace/.claude-plugin/marketplace.json` — register the new plugin

---

## Task 1: Scaffold the plugin tree

**Files:**
- Create: `plugins/lincx-reports/.claude-plugin/plugin.json`
- Create: `plugins/lincx-reports/package.json`
- Create: `plugins/lincx-reports/README.md`

- [ ] **Step 1: Create the plugin manifest**

Create `plugins/lincx-reports/.claude-plugin/plugin.json`:

```json
{
  "name": "lincx-reports",
  "description": "Manager-friendly reports — campaign performance, revenue, creative anomalies — over the Lincx MCP. Read-only.",
  "version": "0.1.0",
  "author": {
    "name": "Lincx"
  }
}
```

- [ ] **Step 2: Create `package.json`**

Create `plugins/lincx-reports/package.json`:

```json
{
  "name": "lincx-reports",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "bash tests/run-all.sh",
    "test:unit": "node --test tests/*.test.mjs",
    "test:lint": "node scripts/check-plugin.mjs",
    "sync-mcp-tools": "node scripts/sync-mcp-tools.mjs"
  }
}
```

- [ ] **Step 3: Create the README**

Create `plugins/lincx-reports/README.md`:

```markdown
# lincx-reports

Manager-friendly reports over the Lincx MCP. Read-only. Three reports:

- **Campaign performance** — spend, impressions, clicks, conversions for one or many campaigns over a date range.
- **Revenue summary** — revenue, fill rate, RPM by advertiser / network / site for a period.
- **Creative anomalies** — top/bottom creatives, zones, sites, templates, plus DoD/WoW drops with volume floor.

A router skill (`lincx-reports`) detects the intent and loads the matching sub-skill.

## Install

```
/plugin marketplace add zakasalaheddine/lincx-marketplace
/plugin install lincx-reports@lincx-marketplace
/reload-plugins
```

The Lincx MCP server must be configured in your Claude session — see [`mcp/README.md`](../../../mcp/README.md) for the OAuth flow.

## Output contract

Every response is four parts: a 1-sentence headline, a 2–4-sentence narrative, a markdown table (≤ 30 rows), and a footer naming the dimension set, range, resolution, and active network. The skills never default a date range — ambiguity always prompts a question.

## Compatible MCP versions

Tested against `lincx-mcp-server` `>=1.0.0`. The static-check suite verifies all referenced MCP tool names exist in `tests/fixtures/mcp-tools.json` (regenerated via `npm run sync-mcp-tools`).

## Tests

```
npm test
```

Runs `node --test` over `tests/*.test.mjs` plus a manifest sanity check.
```

- [ ] **Step 4: Commit**

```bash
cd /Users/salaheddinezaka/Documents/work/lincx-marketplace
git add plugins/lincx-reports/.claude-plugin/plugin.json plugins/lincx-reports/package.json plugins/lincx-reports/README.md
git commit -m "feat(lincx-reports): scaffold plugin manifest, package.json, README"
```

---

## Task 2: Static structure check (TDD)

**Files:**
- Create: `plugins/lincx-reports/scripts/check-plugin.mjs`
- Create: `plugins/lincx-reports/tests/manifest.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `plugins/lincx-reports/tests/manifest.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test — expected to fail**

```bash
cd plugins/lincx-reports
node --test tests/manifest.test.mjs
```

Expected: `not ok` with `Error: Cannot find module .../scripts/check-plugin.mjs` (or similar).

- [ ] **Step 3: Implement `scripts/check-plugin.mjs`**

Create `plugins/lincx-reports/scripts/check-plugin.mjs`:

```js
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
```

- [ ] **Step 4: Verify it fails for the right reason** (skills don't exist yet)

```bash
node scripts/check-plugin.mjs
```

Expected stderr lines like `✖ missing skill: skills/lincx-reports/SKILL.md` and exit 1. The manifest part passes.

- [ ] **Step 5: Add a temporary placeholder so the manifest test passes (we'll replace these in later tasks)**

Create the placeholder files so Task 2's test goes green; later tasks will overwrite them with real content. Each file gets a one-line `# placeholder` so `existsSync` returns true.

```bash
mkdir -p skills/lincx-reports skills/lincx-campaign-performance/references skills/lincx-revenue-summary skills/lincx-creative-anomalies skills/_shared
for f in \
  skills/lincx-reports/SKILL.md \
  skills/lincx-campaign-performance/SKILL.md \
  skills/lincx-revenue-summary/SKILL.md \
  skills/lincx-creative-anomalies/SKILL.md \
  skills/_shared/date-range.md \
  skills/_shared/output-template.md \
  skills/_shared/dimension-discovery.md \
  skills/_shared/mcp-call-patterns.md
do echo "# placeholder" > "$f"; done
```

- [ ] **Step 6: Run the test — expected to pass**

```bash
node --test tests/manifest.test.mjs
```

Expected: `ok 1` and exit 0.

- [ ] **Step 7: Commit**

```bash
git add plugins/lincx-reports/scripts/check-plugin.mjs \
        plugins/lincx-reports/tests/manifest.test.mjs \
        plugins/lincx-reports/skills/
git commit -m "feat(lincx-reports): structure check + placeholder skill files"
```

---

## Task 3: MCP-tools snapshot generator

**Files:**
- Create: `plugins/lincx-reports/scripts/sync-mcp-tools.mjs`
- Create: `plugins/lincx-reports/tests/fixtures/mcp-tools.json`

The snapshot lists every tool name registered in the MCP server. We use it to validate that skill bodies don't reference nonexistent tools.

- [ ] **Step 1: Write the sync script**

Create `plugins/lincx-reports/scripts/sync-mcp-tools.mjs`:

```js
#!/usr/bin/env node
/**
 * Regenerate tests/fixtures/mcp-tools.json from a sibling checkout of mcp/.
 *
 * Usage:  node scripts/sync-mcp-tools.mjs [path-to-mcp-repo]
 * Default sibling path:  ../../../mcp  (relative to this plugin)
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, '..');
const defaultMcpRoot = resolve(pluginRoot, '../../../mcp');
const mcpRoot = process.argv[2] ? resolve(process.argv[2]) : defaultMcpRoot;
const toolsDir = join(mcpRoot, 'src', 'tools');

const REGISTER_RE = /server\.registerTool\(\s*"([a-zA-Z0-9_]+)"/g;

const tools = new Set();
for (const entry of readdirSync(toolsDir)) {
  if (!entry.endsWith('.ts')) continue;
  const src = readFileSync(join(toolsDir, entry), 'utf8');
  for (const m of src.matchAll(REGISTER_RE)) tools.add(m[1]);
}

const sorted = Array.from(tools).sort();
const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  source: 'mcp/src/tools/*.ts',
  tools: sorted,
};

const target = join(pluginRoot, 'tests', 'fixtures', 'mcp-tools.json');
writeFileSync(target, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`✔ wrote ${sorted.length} tool names → ${target}`);
```

- [ ] **Step 2: Run the script**

```bash
mkdir -p tests/fixtures
node scripts/sync-mcp-tools.mjs
```

Expected stdout: `✔ wrote N tool names → .../tests/fixtures/mcp-tools.json` where N is around 40 (matches `grep -c registerTool mcp/src/tools/*.ts` in the MCP repo).

- [ ] **Step 3: Spot-check the snapshot**

```bash
cat tests/fixtures/mcp-tools.json
```

Expected: includes `list_campaigns`, `list_advertisers`, `list_zones`, `list_sites`, `list_dimension_sets`, `get_dimension_set`, `get_event_stats_keys`, `report_query`, `get_zone_report`, `auth_login`, `network_list`, `network_switch`.

- [ ] **Step 4: Commit**

```bash
git add plugins/lincx-reports/scripts/sync-mcp-tools.mjs plugins/lincx-reports/tests/fixtures/
git commit -m "feat(lincx-reports): MCP tool-surface snapshot + sync script"
```

---

## Task 4: SKILL.md frontmatter check (TDD)

**Files:**
- Create: `plugins/lincx-reports/tests/skill-frontmatter.test.mjs`

Each `SKILL.md` must have YAML frontmatter with `name` and `description`. `description` must be non-empty and ≤ 200 chars.

- [ ] **Step 1: Write the failing test**

Create `plugins/lincx-reports/tests/skill-frontmatter.test.mjs`:

```js
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
  assert.ok(skillFiles.length >= 4, `expected ≥ 4 skill files, got ${skillFiles.length}`);
  for (const file of skillFiles) {
    const src = readFileSync(file, 'utf8');
    const fm = parseFrontmatter(src);
    assert.ok(fm, `${file}: missing or malformed frontmatter`);
    assert.ok(fm.name && fm.name.length > 0, `${file}: missing 'name'`);
    assert.ok(fm.description && fm.description.length > 0, `${file}: missing 'description'`);
    assert.ok(fm.description.length <= 200, `${file}: description > 200 chars (${fm.description.length})`);
  }
});
```

- [ ] **Step 2: Run the test — expected to fail**

```bash
node --test tests/skill-frontmatter.test.mjs
```

Expected: `not ok` because the placeholder files don't have frontmatter yet. Each `SKILL.md: missing or malformed frontmatter` assertion fails.

- [ ] **Step 3: Don't fix yet — Tasks 7–14 will write the real content. Commit the test only.**

```bash
git add plugins/lincx-reports/tests/skill-frontmatter.test.mjs
git commit -m "test(lincx-reports): require SKILL.md frontmatter (currently failing)"
```

---

## Task 5: MCP tool-reference check (TDD)

**Files:**
- Create: `plugins/lincx-reports/tests/tool-references.test.mjs`

Every snake_case identifier inside backticks in any `SKILL.md` or `_shared/*.md` that *looks like* an MCP tool name must exist in the snapshot. The check ignores known false-positive vocabulary (e.g. `markdown_table`, `delta_pct`).

- [ ] **Step 1: Write the failing test**

Create `plugins/lincx-reports/tests/tool-references.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, '..');
const skillsRoot = join(pluginRoot, 'skills');
const snapshotPath = join(pluginRoot, 'tests', 'fixtures', 'mcp-tools.json');

const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const knownTools = new Set(snapshot.tools);

// Tokens that look like tool names but are field/dimension/metric names — never tools.
const NOT_TOOLS = new Set([
  'campaign_id', 'advertiser_id', 'zone_id', 'site_id', 'creative_id',
  'network_id', 'publisher_id', 'channel_id', 'ad_group_id',
  'fill_rate', 'delta_pct', 'delta_abs', 'current_volume', 'volume_floor',
  'campaign_daily', 'advertiser_daily', 'zone_daily',
  'auth_token', 'access_token', 'refresh_token',
  'start_date', 'end_date',
]);

// snake_case in `backticks`
const TOOL_RE = /`([a-z][a-z0-9_]+)`/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (name.endsWith('.md')) yield full;
  }
}

test('every tool-like reference resolves to a real MCP tool', () => {
  const offenders = [];
  for (const file of walk(skillsRoot)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(TOOL_RE)) {
      const ident = m[1];
      if (!ident.includes('_')) continue;          // e.g. `start`, `data` — not tool-like
      if (NOT_TOOLS.has(ident)) continue;
      // Tool-name heuristic: starts with verb-like prefix used by the MCP
      const looksLikeTool =
        ident.startsWith('list_') || ident.startsWith('get_') ||
        ident.startsWith('auth_') || ident.startsWith('network_') ||
        ident.startsWith('report_') || ident.startsWith('zone_load_');
      if (!looksLikeTool) continue;
      if (!knownTools.has(ident)) {
        offenders.push(`${file}: \`${ident}\` not in snapshot`);
      }
    }
  }
  assert.equal(offenders.length, 0, offenders.join('\n'));
});
```

- [ ] **Step 2: Run the test — expected to pass (placeholders have no tool refs yet)**

```bash
node --test tests/tool-references.test.mjs
```

Expected: `ok 1`. The test will start catching real issues once Tasks 7–14 add tool references.

- [ ] **Step 3: Commit**

```bash
git add plugins/lincx-reports/tests/tool-references.test.mjs
git commit -m "test(lincx-reports): MCP tool references must resolve to snapshot"
```

---

## Task 6: Shared-reference resolution check (TDD)

**Files:**
- Create: `plugins/lincx-reports/tests/shared-references.test.mjs`

Every `_shared/<name>.md` referenced by a sub-skill SKILL.md must exist on disk.

- [ ] **Step 1: Write the failing test**

Create `plugins/lincx-reports/tests/shared-references.test.mjs`:

```js
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
```

- [ ] **Step 2: Run — expected pass (placeholders don't reference anything yet)**

```bash
node --test tests/shared-references.test.mjs
```

Expected: `ok 1`.

- [ ] **Step 3: Commit**

```bash
git add plugins/lincx-reports/tests/shared-references.test.mjs
git commit -m "test(lincx-reports): _shared/*.md references must resolve"
```

---

## Task 7: Test runner glue

**Files:**
- Create: `plugins/lincx-reports/tests/run-all.sh`

- [ ] **Step 1: Write the runner**

Create `plugins/lincx-reports/tests/run-all.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== lint (check-plugin.mjs) ==="
node scripts/check-plugin.mjs

echo "=== unit (node --test tests/*.test.mjs) ==="
node --test tests/*.test.mjs

echo "✔ all green"
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x plugins/lincx-reports/tests/run-all.sh
```

- [ ] **Step 3: Run it — at this point, the frontmatter test still fails (placeholders).**

```bash
cd plugins/lincx-reports && npm test
```

Expected: lint passes (`✔ plugin structure ok`), unit fails on `skill-frontmatter.test.mjs`. That's the current intended state.

- [ ] **Step 4: Commit**

```bash
git add plugins/lincx-reports/tests/run-all.sh
git commit -m "chore(lincx-reports): wire test runner"
```

---

## Task 8: Write `_shared/date-range.md`

**Files:**
- Create (overwrite placeholder): `plugins/lincx-reports/skills/_shared/date-range.md`

- [ ] **Step 1: Write the file**

Create `plugins/lincx-reports/skills/_shared/date-range.md`:

```markdown
# Date range parsing — strict, never-default

You apply this when a sub-skill needs a date range. Three rules, no exceptions.

## Rule 1: Never default a date range

If the user did not give a range — even partially — stop and ask. Suggest two or three concrete options grounded in today's date (e.g. "Last 7 calendar days (`<X>` → `<Y>`) or rolling 7 days (`<A>` → `<B>`)?"). Do not guess.

## Rule 2: Resolve ambiguity by asking

Anything that could be interpreted two ways requires a question:

- **Year missing** ("March 1–15") → ask which year, naming both candidates relative to today.
- **Time-zone implicit** (cross-midnight ambiguity) → assume the network's reporting time zone if known; otherwise ask.
- **Inclusive vs exclusive end date** ("through May 7" vs "before May 7") → ask if not literal ISO.
- **"This week" / "last week"** → ask: calendar week (Monday–Sunday in the network's locale) or rolling 7 days ending today/yesterday?

## Rule 3: Output ISO dates only

Once resolved, you commit to two ISO dates `startDate` and `endDate` (`YYYY-MM-DD`). Repeat them back in the next message ("Using 2026-03-01 → 2026-03-15") so the user can correct before tools run.

## Forbidden

- Inferring a year silently from "the most recent occurrence."
- Picking calendar-week vs rolling-7d on the user's behalf.
- Picking a default range when the user gave none — that includes "yesterday," "last 7 days," or anything else.
- Re-using a previous turn's range without confirming it.
```

- [ ] **Step 2: Run static checks**

```bash
cd plugins/lincx-reports && node scripts/check-plugin.mjs && node --test tests/shared-references.test.mjs tests/tool-references.test.mjs
```

Expected: all pass. (Frontmatter test still fails — `_shared/*.md` files don't have frontmatter and the test deliberately skips `_shared/` via the `name.startsWith('_')` filter in `findSkillFiles`.)

- [ ] **Step 3: Commit**

```bash
git add plugins/lincx-reports/skills/_shared/date-range.md
git commit -m "feat(lincx-reports): _shared/date-range.md — strict, never-default"
```

---

## Task 9: Write `_shared/output-template.md`

**Files:**
- Create (overwrite placeholder): `plugins/lincx-reports/skills/_shared/output-template.md`

- [ ] **Step 1: Write the file**

Create `plugins/lincx-reports/skills/_shared/output-template.md`:

```markdown
# Output template — the four-part contract

Every report response is exactly four parts in this order. No exceptions.

## 1. Headline (≤ 25 words, one sentence)

Lead with the most decision-relevant number for this report:

- Campaign performance → spend or conversions for the period; include WoW direction only if a prior range was queried.
- Revenue summary → total revenue and fill rate for the period.
- Creative anomalies → count of winners/losers, or the single biggest mover.

Always name the entity and the date range. No hedging adjectives ("solid", "decent", "healthy"). Numbers carry the verdict.

## 2. Narrative (2–4 sentences)

Explain the headline. Cite the one row or driver that matters most. If nothing notable, say so explicitly — do not pad. Never speculate on cause; the data does not support it.

## 3. Markdown table

- **Cap at 30 rows.** For longer series, collapse to daily aggregates or top-N + bottom-N as the sub-skill dictates.
- **Column order is fixed per report** — see each sub-skill's `references/` notes.
- **Number formatting:** currency `$1,234.56` (2 decimals); rates `12.3%`; counts with thousands separators (`1,234,567`); right-aligned.
- **Sort:** chronological for time-series; descending by primary metric for ranks; descending by `|delta_pct|` for anomalies.

## 4. Footer (one line, fixed format)

```
Source: dimension set "<name>" (<id>) · range <YYYY-MM-DD> → <YYYY-MM-DD> · resolution <day|hour> · network <active_network>
```

The footer makes every result auditable — a manager can hand the answer to an analyst and they can re-run it.

If the underlying MCP response was truncated, append a second footer line:

```
Note: response truncated — values above may be incomplete. Narrow the range or breakdown to see full data.
```

## Forbidden

- Emoji.
- First person ("I", "we").
- Filler: "based on the data", "the data shows", "as you can see".
- Charts (Claude Desktop renders inconsistently — we do not lie about output fidelity).
- Unsolicited "next steps" or recommendations. Reports answer; they do not prescribe.
```

- [ ] **Step 2: Static checks**

```bash
node --test tests/shared-references.test.mjs tests/tool-references.test.mjs
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add plugins/lincx-reports/skills/_shared/output-template.md
git commit -m "feat(lincx-reports): _shared/output-template.md — four-part contract"
```

---

## Task 10: Write `_shared/dimension-discovery.md`

**Files:**
- Create (overwrite placeholder): `plugins/lincx-reports/skills/_shared/dimension-discovery.md`

- [ ] **Step 1: Write the file**

Create `plugins/lincx-reports/skills/_shared/dimension-discovery.md`:

```markdown
# Dimension-set discovery

The MCP exposes raw dimension sets. The right one for a question is rarely obvious — pick deliberately.

## Algorithm

1. Call `list_dimension_sets({ limit: 100, offset: 0 })` once per turn. Cache the result mentally — never call it twice in the same turn.
2. From the catalog, score each candidate against the user's intent:
   - **+2** if the dimension-set name contains the entity word the user named (`campaign`, `advertiser`, `zone`, etc.).
   - **+2** if the name suggests the resolution the user implied (`daily` for a multi-day range; `hourly` only when the user explicitly asked).
   - **+1** if the name suggests the metric family (`revenue`, `performance`, `delivery`).
3. Inspect the top 1–2 candidates with `get_dimension_set({ id })`. Confirm:
   - Required dimensions are present (e.g. `date` for time series; `campaign_id` for per-campaign breakdown).
   - Required metrics are present (e.g. `revenue`, `impressions`, `fill_rate`).
4. If one candidate clearly wins, use it. Otherwise list the top 2–3 by name and ask the user which to use.

## Verifying filter values exist

When you plan to filter on a key (e.g. `campaign_id = "cmp_4f12"`), call `get_event_stats_keys()` once per turn to confirm the active network has emitted that key in the last 31 days. If it hasn't, surface the absence rather than running an empty `report_query`.

## Falling back

If none of the candidates fit, tell the user — show the available dimension-set names and dimensions, and ask. Do not run `report_query` against a dimension set that lacks the breakdown they asked for; the response will be misleading.

## Single-zone shortcut

If the question is about a single specific zone, prefer `get_zone_report({ id, resolution, startDate, endDate })`. It bypasses dimension-set selection entirely and is cheaper.
```

- [ ] **Step 2: Static checks** — same command as Task 9.

- [ ] **Step 3: Commit**

```bash
git add plugins/lincx-reports/skills/_shared/dimension-discovery.md
git commit -m "feat(lincx-reports): _shared/dimension-discovery.md"
```

---

## Task 11: Write `_shared/mcp-call-patterns.md`

**Files:**
- Create (overwrite placeholder): `plugins/lincx-reports/skills/_shared/mcp-call-patterns.md`

- [ ] **Step 1: Write the file**

Create `plugins/lincx-reports/skills/_shared/mcp-call-patterns.md`:

```markdown
# MCP call patterns — what works, what doesn't

## `report_query` accepts no structured filters

The tool takes `dimensionSetId`, `startDate`, `endDate`, `resolution: "day"|"hour"`, `dimensions: string[]`, and `testMode`. There is no `filters` parameter. To "filter to campaign X":

1. Pick a dimension set whose `dimensions` include `campaign_id`.
2. Call `report_query` with `dimensions: ["date", "campaign_id"]`.
3. Filter the returned rows client-side to the campaign ID(s) you resolved.

Never pass `testMode: true` in production reports. Never guess a filter parameter that doesn't exist.

## Resolution is `day` or `hour` only

There is no `week` or `month`. Multi-week reports come from daily rows you sum yourself. If the user asks for "monthly", you query daily and aggregate in your response.

## Pagination on `list_*` tools

All `list_*` tools take `{ limit, offset }`, max `limit: 100`, default 20. They do **not** accept a search/name filter. To find an entity by name:

1. Page through with `limit: 100`.
2. Filter by case-insensitive substring on the entity's `name` field client-side.
3. Stop on first match if it's clearly unique; otherwise collect all matches and ask the user to disambiguate.

For very large networks, consider asking the user for the entity ID directly, or for a parent (e.g. "which advertiser owns this campaign?") to narrow the search.

## Error strings the MCP returns verbatim

- `"Error: Not authenticated. Use 'auth_login' first."` — surface, ask the user to run `auth_login`. Do not retry.
- `"Error: Unauthorized. Use 'auth_logout' then 'auth_login' to re-authenticate."` — same: surface and stop.
- `"Error: Forbidden — you don't have access to this resource on the active network."` — check active network with `network_list` and offer `network_switch`.
- `"Error: Resource not found. Double-check the ID."` — verify the ID; do not invent.
- `"Error: Rate limit hit. Wait a moment then retry."` — wait, retry once.
- `"Error: Request timed out."` — retry once with the same params.

## Truncation detection

Responses include `"[Truncated. Use pagination parameters to see more.]"` (or with a total count) when long. If you see this, do not synthesize numbers from the cut-off body. Tell the user the response was truncated and suggest narrowing the range or breakdown.

## Tool-call budget per turn

Aim for ≤ 5 tool calls per report:

- 1 entity `list_*` (or zero if the user gave an ID)
- 1 `list_dimension_sets`
- 1 `get_dimension_set`
- 1–2 `report_query` (two only for anomaly mode)

Calling `list_dimension_sets` twice in one turn is a bug — cache the catalog mentally.
```

- [ ] **Step 2: Static checks** — same command as Task 9.

- [ ] **Step 3: Commit**

```bash
git add plugins/lincx-reports/skills/_shared/mcp-call-patterns.md
git commit -m "feat(lincx-reports): _shared/mcp-call-patterns.md"
```

---

## Task 12: Write the router skill

**Files:**
- Create (overwrite placeholder): `plugins/lincx-reports/skills/lincx-reports/SKILL.md`

- [ ] **Step 1: Write the file**

Create `plugins/lincx-reports/skills/lincx-reports/SKILL.md`:

```markdown
---
name: lincx-reports
description: Use when the user asks for Lincx reports — campaign performance, revenue, fill rate, RPM, creative or placement winners, drops, or anomalies. Routes to the matching sub-skill.
---

# Lincx Reports — router

You handle Lincx reporting requests by dispatching to the right sub-skill. Three reports are supported.

## Decision table

| User intent | Sub-skill |
|---|---|
| "How did campaign X perform?", "show me campaign Y last month", spend / clicks / conversions on a named campaign | `lincx-campaign-performance` |
| "Revenue by advertiser / network / site", fill rate, RPM totals for a period | `lincx-revenue-summary` |
| Top / bottom creatives / zones / sites; "what dropped this week"; week-over-week or day-over-day comparisons | `lincx-creative-anomalies` |

If the request blends two reports ("revenue and top creatives this week"), run them sequentially as two separate reports — do not merge.

## Hard rule — date range first

If the user did not give a date range, ask before doing anything. Do not start tool calls. Apply `_shared/date-range.md`.

## Auth and network preconditions

If any tool returns `"Error: Not authenticated"`, stop and ask the user to run `auth_login` (you can mention it; do not run it for them — it opens a browser flow that requires their credentials).

If the active network is wrong or missing, surface `network_list` results and ask which network to switch to with `network_switch`.

## What you never do

- Default a date range.
- Pick a network for the user.
- Combine data across networks (each MCP call is scoped to the active network).
- Speculate on causes when the data does not show them.
```

- [ ] **Step 2: Run the frontmatter test — should now pass for this file but still fail on the others**

```bash
node --test tests/skill-frontmatter.test.mjs
```

Expected: still failing because the other three SKILL.md files are placeholders.

- [ ] **Step 3: Static checks pass**

```bash
node scripts/check-plugin.mjs && node --test tests/tool-references.test.mjs tests/shared-references.test.mjs
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add plugins/lincx-reports/skills/lincx-reports/SKILL.md
git commit -m "feat(lincx-reports): router skill"
```

---

## Task 13: Write `lincx-campaign-performance` skill

**Files:**
- Create (overwrite placeholder): `plugins/lincx-reports/skills/lincx-campaign-performance/SKILL.md`
- Create: `plugins/lincx-reports/skills/lincx-campaign-performance/references/dimension-cheatsheet.md`

- [ ] **Step 1: Write `SKILL.md`**

Create `plugins/lincx-reports/skills/lincx-campaign-performance/SKILL.md`:

```markdown
---
name: lincx-campaign-performance
description: Use when the user asks how a Lincx campaign performed over a date range — spend, impressions, clicks, conversions, CTR, eCPM. Loaded by the lincx-reports router.
---

# Lincx — Campaign performance

You produce a campaign-performance report. The output contract is `_shared/output-template.md`.

## Flow

1. **Resolve the date range** per `_shared/date-range.md`. If not given, ask. Never default.
2. **Resolve the campaign(s):**
   - Page through `list_campaigns({ limit: 100, offset })` and match by case-insensitive substring on `name`.
   - One match → use it. Multiple matches → list candidates with IDs and ask. No matches → surface the closest names from what you've seen and ask.
   - On large networks, if the first 2–3 pages don't yield a match, ask the user for the campaign ID or the owning advertiser to narrow the search. See `_shared/mcp-call-patterns.md`.
3. **Pick a dimension set** per `_shared/dimension-discovery.md`. Prefer one whose dimensions include `campaign_id` and `date`.
4. **Run the report:**
   ```
   report_query({
     dimensionSetId,
     startDate,
     endDate,
     resolution: "day",
     dimensions: ["date", "campaign_id"]
   })
   ```
5. **Filter rows client-side** to the resolved campaign ID(s).
6. **Render** per `_shared/output-template.md`. Fixed column order:
   ```
   date | spend | impressions | clicks | conversions | ctr | ecpm
   ```
   If the dimension set is missing one of these metrics (e.g. `ecpm`), drop that column and note the missing one in the narrative.

## Edge cases

- **Empty result for a campaign you confirmed exists** → suggest checking with `auth_status` (right network?) and `get_event_stats_keys` (events being received?). Do not run them automatically.
- **Truncated `report_query` response** → narrow the range and re-run; do not synthesize from the partial body.

## Cheatsheet

`references/dimension-cheatsheet.md` records the dimension-set names the team has seen. It is not authoritative — always verify with `get_dimension_set` before using.
```

- [ ] **Step 2: Write the cheatsheet**

Create `plugins/lincx-reports/skills/lincx-campaign-performance/references/dimension-cheatsheet.md`:

```markdown
# Campaign-performance dimension cheatsheet

This is a hint, not a contract. Always verify with `get_dimension_set` before using.

## Dimension sets the team has used for campaign perf

| Name (likely)        | Dimensions present (likely)        | Metrics present (likely)                                |
|----------------------|------------------------------------|---------------------------------------------------------|
| `campaign_daily`     | `date`, `campaign_id`              | `spend`, `impressions`, `clicks`, `conversions`, `ctr`, `ecpm` |
| `campaign_hourly`    | `hour`, `date`, `campaign_id`      | same as `campaign_daily`                                |

If the names differ on a given network, fall back to the dimension-discovery algorithm in `_shared/dimension-discovery.md`.

## Column order in the rendered table

```
date | spend | impressions | clicks | conversions | ctr | ecpm
```

Drop any missing column rather than synthesizing it.
```

- [ ] **Step 3: Run all checks**

```bash
cd plugins/lincx-reports && npm test
```

Expected: lint passes; frontmatter still fails on the two remaining placeholder skills.

- [ ] **Step 4: Commit**

```bash
git add plugins/lincx-reports/skills/lincx-campaign-performance/
git commit -m "feat(lincx-reports): campaign-performance sub-skill"
```

---

## Task 14: Write `lincx-revenue-summary` skill

**Files:**
- Create (overwrite placeholder): `plugins/lincx-reports/skills/lincx-revenue-summary/SKILL.md`

- [ ] **Step 1: Write the file**

Create `plugins/lincx-reports/skills/lincx-revenue-summary/SKILL.md`:

```markdown
---
name: lincx-revenue-summary
description: Use when the user asks for revenue, fill rate, or RPM totals broken down by Lincx advertiser, network, or site for a period. Loaded by the lincx-reports router.
---

# Lincx — Revenue summary

You produce a revenue / fill / RPM summary. Output contract is `_shared/output-template.md`.

## Flow

1. **Resolve the date range** per `_shared/date-range.md`. If not given, ask.
2. **Resolve the entity dimension** — advertiser, network, or site? If the user named one, use it. If they named none, ask: "Break down by advertiser, network, or site?" Do not guess.
3. **(Optional) Resolve a specific entity** — if the user asked about a *specific* advertiser/site rather than all of them:
   - Page through the matching `list_advertisers` / `list_sites` (max `limit: 100`) and match by case-insensitive substring.
   - Multiple matches → ask. None → surface candidates seen.
4. **Pick a dimension set** per `_shared/dimension-discovery.md`. Prefer one whose dimensions include the chosen entity (`advertiser_id` / `network_id` / `site_id`) and whose metrics include `revenue`, `impressions`, and `fill_rate`.
5. **Run the report:**
   ```
   report_query({
     dimensionSetId,
     startDate,
     endDate,
     resolution: "day",
     dimensions: ["<entity>_id"]   // or ["date", "<entity>_id"] if the user wants a time series
   })
   ```
6. **Aggregate client-side** if you queried with `date` as a second dimension.
7. **Render** per `_shared/output-template.md`. Column order:
   ```
   <entity> | revenue | impressions | fill_rate | rpm
   ```
   Plus a **totals row** at the bottom showing aggregate `revenue`, total `impressions`, weighted-average `fill_rate`, and overall `rpm`.

## Multi-entity asks

"Revenue by advertiser and site" → run two separate `report_query` calls and emit two tables. Do not Cartesian-product.

## Edge cases

- **No `fill_rate` in the dimension set** → drop the column; note in narrative.
- **Single-entity ask returning many rows** (you forgot to filter) → narrow client-side and re-render.
- **Truncated response** → narrow and re-run.
```

- [ ] **Step 2: Run all checks**

```bash
cd plugins/lincx-reports && npm test
```

Expected: lint passes; frontmatter test now fails only on `lincx-creative-anomalies` (the last placeholder).

- [ ] **Step 3: Commit**

```bash
git add plugins/lincx-reports/skills/lincx-revenue-summary/SKILL.md
git commit -m "feat(lincx-reports): revenue-summary sub-skill"
```

---

## Task 15: Write `lincx-creative-anomalies` skill

**Files:**
- Create (overwrite placeholder): `plugins/lincx-reports/skills/lincx-creative-anomalies/SKILL.md`

- [ ] **Step 1: Write the file**

Create `plugins/lincx-reports/skills/lincx-creative-anomalies/SKILL.md`:

```markdown
---
name: lincx-creative-anomalies
description: Use when the user asks about top/bottom creatives, zones, sites, or templates, or about WoW/DoD drops, lifts, or anomalies in Lincx delivery. Loaded by the lincx-reports router.
---

# Lincx — Creative anomalies

You produce one of two reports based on the user's wording: **Winners/losers** or **Anomaly comparison**. Output contract is `_shared/output-template.md`.

## Mode A — Winners / losers

Triggered by "top", "best", "worst", "bottom", "underperformers", "highest", "lowest".

1. **Resolve the date range** per `_shared/date-range.md`.
2. **Resolve the entity dimension** (zone / creative / site / template). If unclear, ask.
3. **Resolve N** — default 10 winners + 10 losers. If the user asked "top 5", use 5. If they only asked for "top", confirm 10.
4. **Pick a dimension set** per `_shared/dimension-discovery.md`. The dimension must cover the chosen entity.
5. **Run the report:**
   ```
   report_query({ dimensionSetId, startDate, endDate, resolution: "day", dimensions: ["<entity>_id"] })
   ```
6. **Sort client-side** by the primary metric the user implied (CTR / conversions / revenue / RPM). Take top N + bottom N.
7. **Render** with column order:
   ```
   <entity> | metric | volume | rank
   ```

## Mode B — Anomaly comparison

Triggered by "dropped", "fell", "spiked", "this week vs last week", "today vs yesterday".

1. **Resolve current and prior ranges** per `_shared/date-range.md`. **Never assume "vs prior period of equal length"** — ask. Confirm both ranges back to the user before any tool call (e.g. "Current 2026-05-01 → 2026-05-07, prior 2026-04-24 → 2026-04-30 — both 7 days. Confirm?").
2. **Resolve entity dimension** (zone / creative / site / template).
3. **Pick a dimension set** per `_shared/dimension-discovery.md`.
4. **Run two `report_query` calls** — one per range. Each scoped to the same dimension set + dimensions.
5. **Join client-side on the entity key.** Compute:
   - `delta_pct = (current - prior) / prior * 100`
   - `delta_abs = current - prior`
6. **Apply thresholds:**
   - Default `|delta_pct| ≥ 25%`.
   - **Volume floor** = 10% of the median current-period row volume on the primary metric. If applying it would drop *every* row, surface that fact and ask the user whether to lower it.
7. **Sort by `|delta_pct|` descending.** Render with column order:
   ```
   <entity> | current | prior | delta_pct | delta_abs
   ```

## Single-zone fast path

If the user asks about a single specific zone, prefer `get_zone_report({ id, resolution, startDate, endDate })` directly. It is cheaper and avoids dimension-set selection.

## Edge cases

- **No rows clear the threshold** → state plainly. Offer to lower threshold or floor; do not lower silently.
- **Empty join (entity present in only one range)** → list those rows separately under a "new / disappeared" sub-table; mark `prior` or `current` as `—`.
- **Truncated response on either range** → narrow and re-run; do not synthesize.
```

- [ ] **Step 2: Run the full suite**

```bash
cd plugins/lincx-reports && npm test
```

Expected: **all green**. Lint passes, all four tests pass.

- [ ] **Step 3: Commit**

```bash
git add plugins/lincx-reports/skills/lincx-creative-anomalies/SKILL.md
git commit -m "feat(lincx-reports): creative-anomalies sub-skill"
```

---

## Task 16: Golden transcripts

**Files:**
- Create: `plugins/lincx-reports/tests/golden/campaign-performance.md`
- Create: `plugins/lincx-reports/tests/golden/revenue-summary.md`
- Create: `plugins/lincx-reports/tests/golden/creative-anomalies.md`

These are reference transcripts for manual pre-release review. Not executed by the test runner — they document the contract.

- [ ] **Step 1: Create `tests/golden/campaign-performance.md`**

```markdown
# Golden — campaign performance

**User:** How did the Acme Spring campaign do March 1–15?

**Expected tool sequence:**

1. (no tool) — Claude asks "March 2026 or March 2025?" because the year is unspecified.
2. `list_campaigns({ limit: 100, offset: 0 })` — pages until `Acme Spring` is found.
3. `list_dimension_sets({ limit: 100, offset: 0 })`.
4. `get_dimension_set({ id })` for the best candidate (likely `campaign_daily`).
5. `report_query({ dimensionSetId, startDate: "2026-03-01", endDate: "2026-03-15", resolution: "day", dimensions: ["date", "campaign_id"] })`.
6. Client-side filter to the resolved campaign ID.

**Expected response shape:**

- 1-sentence headline naming the campaign and the date range.
- 2–4-sentence narrative.
- Markdown table with columns `date | spend | impressions | clicks | conversions | ctr | ecpm`, ≤ 30 rows, sorted ascending by date.
- Footer: `Source: dimension set "<name>" (<id>) · range 2026-03-01 → 2026-03-15 · resolution day · network <active_network>`.

**Reviewer checklist:**

- [ ] Year was confirmed before any tool call.
- [ ] No `auth_login` was attempted automatically.
- [ ] Footer includes all four facts (dimension set + id, range, resolution, network).
- [ ] Numbers formatted: currency $ with 2 decimals, rates with %, counts with thousands separators.
```

- [ ] **Step 2: Create `tests/golden/revenue-summary.md`**

```markdown
# Golden — revenue summary

**User:** Give me revenue by advertiser for last week.

**Expected tool sequence:**

1. (no tool) — Claude asks: "Calendar week (Mon–Sun) or rolling 7 days?"
2. `list_dimension_sets({ limit: 100, offset: 0 })`.
3. `get_dimension_set({ id })` for the best candidate (likely `advertiser_daily`).
4. `report_query({ dimensionSetId, startDate, endDate, resolution: "day", dimensions: ["advertiser_id"] })`.

**Expected response shape:**

- Headline naming total revenue and fill rate for the resolved range.
- Narrative cites the leading advertiser and a one-sentence shape-of-the-distribution observation.
- Markdown table: `advertiser | revenue | impressions | fill_rate | rpm`, sorted by revenue descending, with a totals row at the bottom.
- Footer matching the resolved range.

**Reviewer checklist:**

- [ ] The skill asked between calendar vs rolling week before any tool call.
- [ ] Totals row weighted-averages `fill_rate` (not arithmetic mean).
- [ ] No `auth_login` automatic invocation.
```

- [ ] **Step 3: Create `tests/golden/creative-anomalies.md`**

```markdown
# Golden — creative anomalies (anomaly mode)

**User:** Which zones dropped this week vs last week?

**Expected tool sequence:**

1. (no tool) — Claude asks for the comparison window: "this week = current 7 days? prior = previous 7 days? Confirm dates."
2. `list_dimension_sets({ limit: 100, offset: 0 })`.
3. `get_dimension_set({ id })` for the chosen `zone_*` dimension set.
4. `report_query` for the **current** range, dimensions `["zone_id"]`.
5. `report_query` for the **prior** range, dimensions `["zone_id"]`.
6. Client-side join on `zone_id`; compute `delta_pct`, `delta_abs`; apply `|delta_pct| ≥ 25%` and a volume floor at 10% of median current revenue.

**Expected response shape:**

- Headline: count of zones that moved ≥ ±25% with non-trivial volume; biggest mover named.
- Narrative cites the largest dollar-impact mover.
- Markdown table: `zone | current | prior | delta_pct | delta_abs`, sorted by `|delta_pct|` descending.
- Footer naming the dimension set, both ranges, resolution, and active network.

**Reviewer checklist:**

- [ ] Comparison window was confirmed before any tool call.
- [ ] Volume floor was applied; if it would drop everything, the skill asked instead of silently lowering.
- [ ] Two `report_query` calls — not one.
```

- [ ] **Step 4: Commit**

```bash
git add plugins/lincx-reports/tests/golden/
git commit -m "docs(lincx-reports): golden transcripts for the three reports"
```

---

## Task 17: Register the plugin in the marketplace

**Files:**
- Modify: `lincx-marketplace/.claude-plugin/marketplace.json`

- [ ] **Step 1: Read current `marketplace.json`**

```bash
cat /Users/salaheddinezaka/Documents/work/lincx-marketplace/.claude-plugin/marketplace.json
```

Expected: a JSON object with `plugins: [{ name: "templates-editor-plugin", … }]`.

- [ ] **Step 2: Add the new entry**

Replace the file's `plugins` array with both entries:

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
    },
    {
      "name": "lincx-reports",
      "source": "./plugins/lincx-reports",
      "description": "Manager-friendly reports — campaign performance, revenue, creative anomalies — over the Lincx MCP"
    }
  ]
}
```

- [ ] **Step 3: Validate JSON**

```bash
node -e "JSON.parse(require('node:fs').readFileSync('.claude-plugin/marketplace.json','utf8'))" && echo ok
```

Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/marketplace.json
git commit -m "feat(marketplace): register lincx-reports plugin"
```

---

## Task 18: Final verification

- [ ] **Step 1: Run the full suite from a clean state**

```bash
cd plugins/lincx-reports && npm test
```

Expected output:

```
=== lint (check-plugin.mjs) ===
✔ plugin structure ok
=== unit (node --test tests/*.test.mjs) ===
…
# pass 4
# fail 0
✔ all green
```

- [ ] **Step 2: Re-sync the MCP snapshot to confirm the script still works**

```bash
node scripts/sync-mcp-tools.mjs
git diff --stat tests/fixtures/mcp-tools.json
```

Expected: no diff if the MCP surface hasn't changed since Task 3.

- [ ] **Step 3: Visual check — frontmatter on every `SKILL.md`**

```bash
for f in plugins/lincx-reports/skills/*/SKILL.md; do
  echo "=== $f ==="; head -4 "$f"
done
```

Expected: each prints `---`, `name: …`, `description: …`, `---`.

- [ ] **Step 4: Plugin install dry-run (manual, requires Claude Code installed)**

If you have a local Claude Code session, run:

```
/plugin marketplace add /Users/salaheddinezaka/Documents/work/lincx-marketplace
/plugin install lincx-reports@lincx-marketplace
/reload-plugins
```

Then ask in that session: "How did the Acme campaign do March 1–15?" and verify the router triggers `lincx-reports` and the campaign-performance sub-skill loads. This is a manual smoke test, not part of CI.

- [ ] **Step 5: Live smoke test (manual, ~10 min)**

Per the spec's testing layer 3, with the `lincx` MCP server configured (or the deployed Fly endpoint), run the three canonical prompts from the example transcripts in the spec. Confirm:

- All four output sections render (headline, narrative, table, footer).
- Footer includes dimension-set name + id, range, resolution, active network.
- Skills ask for date range / comparison window when not given.
- `auth_login` is not invoked automatically when the session is unauthenticated.

Record any deviations as issues; do not edit the skills mid-smoke-test.

---

## Out of scope (future tasks)

These are explicitly deferred:

1. **Pacing & delivery health** — fourth sub-skill. Adding it should not require changes to `_shared/`.
2. **`zone-load-trace` diagnostic skill** — wraps the existing tool of the same name; useful for support engineers.
3. **MCP write tools** — none of these skills write. If/when a write tool lands, opt-in per skill.
4. **CI integration** — adding the test suite to a GitHub Actions workflow is a separate concern owned by the marketplace as a whole.
5. **Search/filter on `list_*` tools** — a future MCP enhancement that would simplify entity resolution. Not required for v1.
