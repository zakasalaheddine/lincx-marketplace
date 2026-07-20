import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTargeted, rollup, formatReport } from '../scripts/zone-inventory-rollup.mjs';

const ZONE = '8z7wzb';
const CAG = '0bckt2';

function ag(over = {}) {
  return {
    id: 'ag1', name: 'AG1', enabled: true,
    params: { zoneId: [ZONE] }, campaignId: 'c1', creativeAssetGroupId: CAG,
    ...over,
  };
}

// ---- selectTargeted ----

test('selectTargeted keeps groups whose params.zoneId includes the zone', () => {
  const groups = [ag({ id: 'a' }), ag({ id: 'b', params: { zoneId: ['other'] } })];
  const { targeted, conflicting } = selectTargeted(groups, ZONE);
  assert.deepEqual(targeted.map(g => g.id), ['a']);
  assert.deepEqual(conflicting, []);
});

test('selectTargeted ignores a group with the zone only in exceptParams', () => {
  const groups = [ag({ id: 'x', params: { zoneId: ['other'] }, exceptParams: { zoneId: [ZONE] } })];
  const { targeted } = selectTargeted(groups, ZONE);
  assert.deepEqual(targeted, []);
});

test('selectTargeted flags a group with the zone in BOTH params and exceptParams as conflicting, not targeted', () => {
  const groups = [ag({ id: 'y', params: { zoneId: [ZONE] }, exceptParams: { zoneId: [ZONE] } })];
  const { targeted, conflicting } = selectTargeted(groups, ZONE);
  assert.deepEqual(targeted, []);
  assert.deepEqual(conflicting.map(g => g.id), ['y']);
});

// ---- rollup: level flags ----

function base(over = {}) {
  return {
    zoneId: ZONE, zoneCagId: CAG,
    targeted: [ag()], conflicting: [],
    campaigns: { c1: { enabled: true } },
    adsByGroup: { ag1: [{ id: 'ad1', enabled: true, creativeId: 'cr1' }] },
    creatives: { cr1: { creativeAssetGroupId: CAG } },
    mode: 'all',
    ...over,
  };
}

test('fully_live when campaign, ad group, and a live+viable ad are all on', () => {
  const { rows, summary } = rollup(base());
  assert.equal(rows[0].fully_live, true);
  assert.deepEqual(rows[0].off_reason, []);
  assert.equal(summary.live, 1);
  assert.equal(summary.off, 0);
});

test('campaign off → not live, off_reason names campaign', () => {
  const { rows } = rollup(base({ campaigns: { c1: { enabled: false } } }));
  assert.equal(rows[0].campaign_on, false);
  assert.equal(rows[0].fully_live, false);
  assert.deepEqual(rows[0].off_reason, ['campaign']);
});

test('ad group enabled but archived → forced off, off_reason names archived', () => {
  const { rows, summary } = rollup(base({ targeted: [ag({ enabled: true, archived: true })] }));
  assert.equal(rows[0].archived, true);
  assert.equal(rows[0].adgroup_on, false);
  assert.equal(rows[0].fully_live, false);
  assert.deepEqual(rows[0].off_reason, ['archived']);
  assert.equal(summary.archived, 1);
});

test('per-ad conjunction: enabled ad with dangling creative + disabled ad with valid creative → NOT live-viable', () => {
  const { rows } = rollup(base({
    adsByGroup: { ag1: [
      { id: 'ad1', enabled: true, creativeId: 'missing' },   // enabled but creative does not resolve
      { id: 'ad2', enabled: false, creativeId: 'cr1' },       // valid creative but disabled
    ] },
    creatives: { cr1: { creativeAssetGroupId: CAG }, missing: null },
  }));
  assert.equal(rows[0].has_enabled_ad, true);       // diagnostic: yes, ad1 is enabled
  assert.equal(rows[0].creative_resolves, true);    // diagnostic: yes, cr1 resolves
  assert.equal(rows[0].has_live_viable_ad, false);  // but no SINGLE ad is both
  assert.equal(rows[0].fully_live, false);
  assert.deepEqual(rows[0].off_reason, ['no_live_viable_ad']);
});

test('archived ad is not a live ad', () => {
  const { rows } = rollup(base({
    adsByGroup: { ag1: [{ id: 'ad1', enabled: true, archived: true, creativeId: 'cr1' }] },
  }));
  assert.equal(rows[0].has_live_viable_ad, false);
});

// ---- mode filter ----

test('mode "off" returns only not-fully-live rows', () => {
  const { rows } = rollup(base({
    targeted: [ag({ id: 'ag1' }), ag({ id: 'ag2', campaignId: 'c2' })],
    campaigns: { c1: { enabled: true }, c2: { enabled: false } },
    adsByGroup: {
      ag1: [{ id: 'ad1', enabled: true, creativeId: 'cr1' }],
      ag2: [{ id: 'ad2', enabled: true, creativeId: 'cr1' }],
    },
    mode: 'off',
  }));
  assert.deepEqual(rows.map(r => r.id), ['ag2']);
});

// ---- rendered ∩ targeted ⊆ live self-check ----

test('every known-rendered targeted ad group rolls up fully_live (rendered∩targeted ⊆ live)', () => {
  const rendered = ['cb1v4z', 'pa8vkn', 'szg7re', 'hu4gni', 'fvg5m6', 'zfcgde', '6ianjo', 'mke6ol', 'vd1stu'];
  const targeted = rendered.map(id => ag({ id, campaignId: `camp_${id}` }));
  const campaigns = Object.fromEntries(rendered.map(id => [`camp_${id}`, { enabled: true }]));
  const adsByGroup = Object.fromEntries(rendered.map(id => [id, [{ id: `ad_${id}`, enabled: true, creativeId: `cr_${id}` }]]));
  const creatives = Object.fromEntries(rendered.map(id => [`cr_${id}`, { creativeAssetGroupId: CAG }]));
  const { rows } = rollup({ zoneId: ZONE, zoneCagId: CAG, targeted, conflicting: [], campaigns, adsByGroup, creatives, mode: 'all' });
  for (const r of rows) assert.equal(r.fully_live, true, `${r.id} should be fully_live`);
});

// ---- formatReport ----

test('formatReport renders a markdown table with a summary line', () => {
  const { rows, summary } = rollup(base());
  const out = formatReport({ zoneId: ZONE, mode: 'all', rows, summary });
  assert.match(out, /AG1/);
  assert.match(out, /1 targeted/);
});
