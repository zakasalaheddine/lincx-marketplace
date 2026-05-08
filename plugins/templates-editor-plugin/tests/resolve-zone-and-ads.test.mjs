import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBundle } from '../scripts/resolve-zone-and-ads.mjs';

const FIXTURES = fileURLToPath(new URL('./fixtures/preview-bundles/', import.meta.url));

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-resolve-'));
  return {
    root: dir,
    htmlPath: join(dir, 'tpl.html'),
    cssPath: join(dir, 'tpl.css'),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function loadFixture(name) {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
}

test('zone-source bundle: writes html/css and emits zone-resolved patch', () => {
  const { root, htmlPath, cssPath, cleanup } = tmp();
  try {
    const patch = resolveBundle({
      bundle: loadFixture('zone.json'),
      entryId: 'e1',
      htmlPath, cssPath,
      projectRoot: root,
    });
    assert.equal(readFileSync(htmlPath, 'utf8'), '<h1>{{ headline }}</h1>');
    assert.equal(readFileSync(cssPath, 'utf8'), 'h1{color:red}');
    assert.equal(patch.id, 'e1');
    assert.equal(patch.mockAdsSource.kind, 'zone-resolved');
    assert.equal(patch.mockAdsSource.zoneId, 'zn_B');
    assert.deepEqual(patch.mockAds, [{ headline: 'Real B1' }, { headline: 'Real B2' }]);
    assert.deepEqual(patch.mockAdsSource.warnings, []);
    assert.deepEqual(patch.cagSchema, { fields: [{ name: 'headline', type: 'string' }] });
  } finally { cleanup(); }
});

test('synthesized bundle: emits synthesized patch with warnings', () => {
  const { root, htmlPath, cssPath, cleanup } = tmp();
  try {
    const patch = resolveBundle({
      bundle: loadFixture('synthesized.json'),
      entryId: 'e1',
      htmlPath, cssPath,
      projectRoot: root,
    });
    assert.equal(patch.mockAdsSource.kind, 'synthesized');
    assert.equal(patch.mockAdsSource.zoneId, null);
    assert.equal(patch.mockAdsSource.warnings.length, 1);
  } finally { cleanup(); }
});

test('zone bundle whose ads fail CAG validation falls back to synthesized-fallback', () => {
  const { root, htmlPath, cssPath, cleanup } = tmp();
  try {
    const patch = resolveBundle({
      bundle: loadFixture('invalid-ads.json'),
      entryId: 'e1',
      htmlPath, cssPath,
      projectRoot: root,
    });
    assert.equal(patch.mockAdsSource.kind, 'synthesized-fallback');
    assert.equal(patch.mockAds.length, 2);
    assert.ok(patch.mockAds.every(a => 'headline' in a), 'fallback ads must include all CAG fields');
    assert.match(patch.mockAdsSource.warnings.join(' '), /CAG validation/i);
  } finally { cleanup(); }
});

test('refuses to write outside the project root', () => {
  const { root, cleanup } = tmp();
  try {
    assert.throws(
      () => resolveBundle({
        bundle: loadFixture('zone.json'),
        entryId: 'e1',
        htmlPath: '/etc/passwd',
        cssPath: join(root, 'ok.css'),
        projectRoot: root,
      }),
      /outside project root/i,
    );
  } finally { cleanup(); }
});
