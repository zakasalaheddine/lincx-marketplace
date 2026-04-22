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
