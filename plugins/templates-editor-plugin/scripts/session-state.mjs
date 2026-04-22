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
