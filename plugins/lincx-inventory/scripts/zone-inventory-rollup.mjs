import { readFileSync } from 'node:fs';

// A level (campaign / ad group / ad) is "on" only if enabled and not archived.
// archived is omitted when false, so `!== true` treats a missing key as false.
const on = (x) => !!x && x.enabled === true && x.archived !== true;

const has = (arr, v) => Array.isArray(arr) && arr.includes(v);

/** Split scanned ad groups into those directly targeting the zone and those
 * that both target and except it (conflicting). exceptParams-only groups are
 * neither (not targeted). */
export function selectTargeted(adGroups, zoneId) {
  const targeted = [];
  const conflicting = [];
  for (const ag of adGroups) {
    const inParams = has(ag.params?.zoneId, zoneId);
    const inExcept = has(ag.exceptParams?.zoneId, zoneId);
    if (inParams && inExcept) conflicting.push(ag);
    else if (inParams) targeted.push(ag);
  }
  return { targeted, conflicting };
}

/** Roll up enabled-state across campaign → ad group → ad → creative for each
 * targeted ad group. Returns rows filtered by mode plus a summary. */
export function rollup({ zoneId, zoneCagId, targeted, conflicting = [], campaigns, adsByGroup, creatives, mode = 'all' }) {
  const resolves = (creativeId) => creatives[creativeId] != null;

  const allRows = targeted.map((ag) => {
    const campaign = campaigns[ag.campaignId];
    const ads = adsByGroup[ag.id] ?? [];

    const campaign_on = on(campaign);
    const adgroup_on = on(ag);
    const has_enabled_ad = ads.some(on);                                  // diagnostic
    const creative_resolves = ads.some((a) => resolves(a.creativeId));    // diagnostic
    const has_live_viable_ad = ads.some((a) => on(a) && resolves(a.creativeId));
    const archived = ag.archived === true;

    const off_reason = [];
    if (!campaign_on) off_reason.push('campaign');
    if (!adgroup_on) off_reason.push(archived ? 'archived' : 'adgroup');
    if (!has_live_viable_ad) off_reason.push('no_live_viable_ad');

    const fully_live = campaign_on && adgroup_on && has_live_viable_ad;
    return { id: ag.id, name: ag.name, archived, campaign_on, adgroup_on, has_enabled_ad, creative_resolves, has_live_viable_ad, fully_live, off_reason };
  });

  const summary = {
    targeted: allRows.length,
    live: allRows.filter((r) => r.fully_live).length,
    off: allRows.filter((r) => !r.fully_live).length,
    archived: allRows.filter((r) => r.archived).length,
    conflicting: conflicting.length,
  };

  const rows = mode === 'live' ? allRows.filter((r) => r.fully_live)
    : mode === 'off' ? allRows.filter((r) => !r.fully_live)
    : allRows;

  return { rows, summary };
}

/** Render rows + summary as a markdown table. */
export function formatReport({ zoneId, mode, rows, summary }) {
  const flag = (b) => (b ? '✅' : '❌');
  const lines = [];
  lines.push(`## Zone ${zoneId} — targeted ad groups (${mode})`);
  lines.push('');
  lines.push(`${summary.targeted} targeted · ${summary.live} live · ${summary.off} off · ${summary.archived} archived · ${summary.conflicting} conflicting`);
  lines.push('');
  lines.push('| Ad group | Campaign | Ad group | Live+viable ad | Fully live | Off at |');
  lines.push('|---|---|---|---|---|---|');
  for (const r of rows) {
    const name = r.archived ? `${r.name} (archived)` : r.name;
    lines.push(`| ${name} (${r.id}) | ${flag(r.campaign_on)} | ${flag(r.adgroup_on)} | ${flag(r.has_live_viable_ad)} | ${flag(r.fully_live)} | ${r.off_reason.join(', ') || '—'} |`);
  }
  return lines.join('\n');
}

// CLI: node zone-inventory-rollup.mjs <inputJsonPath> [mode]
// input JSON = { zoneId, zoneCagId, adGroups, campaigns, adsByGroup, creatives }
// adGroups is the FULL scan; selection happens here.
export function cli(argv) {
  const [inputPath, mode = 'all'] = argv;
  if (!inputPath) {
    process.stderr.write('usage: zone-inventory-rollup <inputJsonPath> [all|live|off]\n');
    return 2;
  }
  const input = JSON.parse(readFileSync(inputPath, 'utf8'));
  const { targeted, conflicting } = selectTargeted(input.adGroups, input.zoneId);
  const { rows, summary } = rollup({
    zoneId: input.zoneId, zoneCagId: input.zoneCagId,
    targeted, conflicting,
    campaigns: input.campaigns, adsByGroup: input.adsByGroup, creatives: input.creatives,
    mode,
  });
  process.stdout.write(formatReport({ zoneId: input.zoneId, mode, rows, summary }) + '\n');
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(cli(process.argv.slice(2)));
}
