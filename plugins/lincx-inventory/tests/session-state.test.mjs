import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readState, writeState, getLastZone, setLastZone, cli } from '../scripts/session-state.mjs';

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

test('cli set then get round-trips via an explicit path', () => {
  const { path, cleanup } = tmp();
  try {
    let out = '';
    const orig = process.stdout.write;
    process.stdout.write = (s) => { out += s; return true; };
    try {
      assert.equal(cli(['set', '8z7wzb', path]), 0);
      assert.equal(cli(['get', path]), 0);
    } finally { process.stdout.write = orig; }
    assert.equal(out, '8z7wzb\n');
  } finally { cleanup(); }
});

test('cli get on a fresh path prints nothing and exits 0', () => {
  const { path, cleanup } = tmp();
  try {
    let out = '';
    const orig = process.stdout.write;
    process.stdout.write = (s) => { out += s; return true; };
    try { assert.equal(cli(['get', path]), 0); } finally { process.stdout.write = orig; }
    assert.equal(out, '');
  } finally { cleanup(); }
});
