import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const snapshotPath = join(resolve(here, '..'), 'tests', 'fixtures', 'mcp-tools.json');

// Configurable threshold. Default 90 days; override with MCP_SNAPSHOT_MAX_AGE_DAYS.
const MAX_AGE_DAYS = Number(process.env.MCP_SNAPSHOT_MAX_AGE_DAYS ?? 90);

const snap = JSON.parse(readFileSync(snapshotPath, 'utf8'));

test('mcp-tools snapshot is not stale', () => {
  assert.ok(typeof snap.generatedAt === 'string', 'snapshot is missing generatedAt');
  const generated = Date.parse(snap.generatedAt);
  assert.ok(Number.isFinite(generated), `snapshot generatedAt is not parseable: ${snap.generatedAt}`);
  const ageDays = (Date.now() - generated) / (1000 * 60 * 60 * 24);
  assert.ok(
    ageDays <= MAX_AGE_DAYS,
    `snapshot is ${ageDays.toFixed(1)} days old (limit ${MAX_AGE_DAYS}). Run \`npm run sync-mcp-tools\` to refresh.`,
  );
});
