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
      // Tool-name heuristic: starts with verb-like prefix used by the MCP.
      // `create_` matters here — without it the analysis write tool, the one
      // tool in this plugin that isn't a read, would skip the check entirely.
      const looksLikeTool =
        ident.startsWith('list_') || ident.startsWith('get_') ||
        ident.startsWith('create_') ||
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
