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
