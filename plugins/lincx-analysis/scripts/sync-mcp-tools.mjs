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
