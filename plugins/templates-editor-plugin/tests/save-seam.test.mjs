import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { save, saveAsync, nextVersionNumber, buildArtifact, computeDiffSummary } from '../scripts/save-seam.mjs';

function fixtureEntry(dir) {
  const htmlPath = join(dir, 'ad.html');
  const cssPath = join(dir, 'ad.css');
  writeFileSync(htmlPath, '<div class="ad"><h1>{{headline}}</h1></div>');
  writeFileSync(cssPath, '.ad { color: red; }');
  return {
    id: 'e1',
    templateId: 't1',
    htmlPath, cssPath,
    previewPath: join(dir, 'preview.html'),
    dirty: true,
  };
}

test('nextVersionNumber is 1 when versions dir is empty or missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-save-'));
  try {
    assert.equal(nextVersionNumber(join(dir, 'versions')), 1);
    mkdirSync(join(dir, 'versions'));
    assert.equal(nextVersionNumber(join(dir, 'versions')), 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('nextVersionNumber returns max + 1 across existing v*.html files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-save-'));
  try {
    mkdirSync(join(dir, 'versions'));
    writeFileSync(join(dir, 'versions', 'v1.html'), '');
    writeFileSync(join(dir, 'versions', 'v3.html'), '');
    writeFileSync(join(dir, 'versions', 'v7.html'), '');
    assert.equal(nextVersionNumber(join(dir, 'versions')), 8);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('buildArtifact inlines CSS into <style> and keeps HTML body intact', () => {
  const out = buildArtifact({ html: '<div>hi</div>', css: 'div { color: red; }' });
  assert.match(out, /<style>\s*div \{ color: red; \}\s*<\/style>/);
  assert.match(out, /<div>hi<\/div>/);
});

test('computeDiffSummary reports added/removed counts', () => {
  const before = 'a\nb\nc\n';
  const after = 'a\nB\nc\nd\n';
  const summary = computeDiffSummary(before, after);
  assert.match(summary, /\+2/);
  assert.match(summary, /-1/);
});

test('save local mode writes v1 on first save, v2 on second', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-save-'));
  try {
    const entry = fixtureEntry(dir);
    const r1 = save(entry, { mcpWriteAvailable: false });
    assert.equal(r1.mode, 'local');
    assert.ok(r1.artifactPath.endsWith('versions/v1.html'));
    writeFileSync(entry.htmlPath, '<div class="ad"><h1>{{headline}}</h1><p>new</p></div>');
    const r2 = save(entry, { mcpWriteAvailable: false });
    assert.ok(r2.artifactPath.endsWith('versions/v2.html'));
    const versions = readdirSync(join(dir, 'versions')).sort();
    assert.deepEqual(versions, ['v1.html', 'v2.html']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('saveAsync mcp mode calls mcpWrite with {templateId, html, css}', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-save-'));
  try {
    const entry = fixtureEntry(dir);
    const calls = [];
    const mcpWrite = async (payload) => { calls.push(payload); return { version: 42 }; };
    const result = await saveAsync(entry, { mcpWriteAvailable: true, mcpWrite });
    assert.equal(result.mode, 'mcp');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].templateId, 't1');
    assert.match(calls[0].html, /<h1>\{\{headline\}\}<\/h1>/);
    assert.match(calls[0].css, /color: red/);
    assert.equal(result.version, 42);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('saveAsync mcp failure falls back to local and reports both', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-save-'));
  try {
    const entry = fixtureEntry(dir);
    const mcpWrite = async () => { throw new Error('boom'); };
    const result = await saveAsync(entry, { mcpWriteAvailable: true, mcpWrite });
    assert.equal(result.mode, 'local');
    assert.match(result.summary, /fell back from mcp.*boom/i);
    assert.ok(result.artifactPath.endsWith('versions/v1.html'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('save with templateId=null still produces a local artifact', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-save-'));
  try {
    const entry = { ...fixtureEntry(dir), templateId: null };
    const result = save(entry, { mcpWriteAvailable: false });
    assert.equal(result.mode, 'local');
    assert.match(result.summary, /ready to paste as a new template/i);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
