import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

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

const DEFAULT_PATH = join(homedir(), '.lincx-zone-state.json');

// CLI:
//   node session-state.mjs get [filePath]           -> prints remembered zoneId (empty if none)
//   node session-state.mjs set <zoneId> [filePath]  -> remembers zoneId
export function cli(argv) {
  const [cmd, a, b] = argv;
  if (cmd === 'get') {
    const z = getLastZone(a || DEFAULT_PATH);
    if (z) process.stdout.write(z + '\n');
    return 0;
  }
  if (cmd === 'set' && a) {
    setLastZone(b || DEFAULT_PATH, a);
    return 0;
  }
  process.stderr.write('usage: session-state.mjs get [filePath] | set <zoneId> [filePath]\n');
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(cli(process.argv.slice(2)));
}
