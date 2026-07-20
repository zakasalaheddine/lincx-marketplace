# Zone Inventory — design

> Workflow #1: "For zone X, list every ad group directly targeted to it, and for
> each tell me whether it's fully live — campaign, ad group, and ad all enabled
> with a viable creative attached — or where it's off."
>
> Date: 2026-07-20. Reference IDs: network `7jdz0n` (Core Digital), zone `8z7wzb`
> (Quicken Loans Refinance - Match), template `ayf1pr`, CAG `0bckt2`.

## Goal

One installable plugin that pulls the **exhaustive** inventory of ad groups
directly targeted to a zone and, for each, an accurate enabled-state rollup
across campaign → ad group → ad → creative, so the user can see what is fully
live and, where not, which level is off. Verifiable against the zone's targeting
view in the UI.

## Data model (verified live, not assumed)

- **Targeting lives on the ad group, not the zone.** `get_zone 8z7wzb` has no
  reverse targeting list. An ad group targets a zone via
  `params.zoneId: ["8z7wzb", ...]`. `exceptParams.zoneId`, if present, is an
  **exclusion** (anti-targeting) and must not count as targeting.
- **No `zoneId` filter exists on `list_ad_groups`** (only `campaignId` /
  `advertiserId`). The exhaustive set therefore requires scanning **every** ad
  group in the network and filtering client-side on `params.zoneId`. This is the
  "parent-scope / pagination fix" the workflow names. Core Digital has **1150**
  ad groups → 12 pages at `limit:100`.
- `list_ad_groups` rows are compact and already carry everything for the ad-group
  level: `{ id, name, enabled, archived, params, campaignId, advertiserId,
  creativeAssetGroupId }` via `fields`.
- **Campaign** has `enabled` (`get_campaign`).
- **Ad** has `enabled` and a single `creativeId` (`list_ads?adGroupId=` returns
  `{ id, name, enabled, creativeId }` compactly).
- **Creative has no `enabled` flag.** "Viable creative attached" therefore means:
  the ad's `creativeId` resolves to an existing creative. CAG match
  (creative.creativeAssetGroupId === zone CAG) is reported as a note, not a gate.

## Rollup semantics

Four **independent** boolean flags per targeted ad group (keep them separate — a
single AND collapses the "where is it off" answer):

| flag | source |
|---|---|
| `campaign_on` | campaign.enabled === true |
| `adgroup_on` | adGroup.enabled === true |
| `has_live_ad` | ≥ 1 ad with enabled === true |
| `has_viable_creative` | that live ad's `creativeId` resolves to a creative |

`fully_live = campaign_on && adgroup_on && has_live_ad && has_viable_creative`.

`off_reason` = the list of failing levels (e.g. `["adgroup_on"]`,
`["has_live_ad","has_viable_creative"]`).

**Archived targeted ad groups are shown, flagged `archived`, and always render as
`off`** (decision: maximize "none missing"; archived reads as an off-entry, not an
omission).

## Command surface

`/lincx-zone-inventory <zoneId> [all|live|off]`

- `all` (default) — every targeted ad group with its rollup.
- `live` — only `fully_live` ad groups.
- `off` — only not-`fully_live` (incl. archived).

## Architecture

New plugin, mirroring `templates-editor-plugin` / `lincx-reports` (skill +
command + pure tested helper). The skill makes MCP calls; the pure helper does
the boolean logic and formatting — MCP tools are unavailable to node scripts, so
the skill dumps raw entities to JSON and the script reads that (same seam as
`resolve-zone-and-ads.mjs`).

```
plugins/zone-inventory/
├── .claude-plugin/plugin.json
├── commands/lincx-zone-inventory.md
├── skills/zone-inventory/SKILL.md
├── scripts/zone-inventory-rollup.mjs      # pure: raw entities → rollup rows + table
└── tests/zone-inventory-rollup.test.mjs
```

### Skill flow

1. `get_zone <zoneId>` — confirm it exists; capture CAG + template for the header.
2. **Scan:** page `list_ad_groups` `limit:100` with
   `fields:["params","enabled","archived","campaignId","creativeAssetGroupId"]`
   until `has_more` is false. Keep rows where `params.zoneId` includes the zone
   (ignore `exceptParams.zoneId`). Log the page count and total scanned so the
   exhaustiveness is visible.
3. For the matched set:
   - dedupe `campaignId` → `get_campaign` each → `{enabled}`.
   - `list_ads?adGroupId=` per matched ad group → `{enabled, creativeId}`.
   - dedupe `creativeId` (of live ads) → `get_creative` each → resolves? CAG match?
4. Write raw JSON to the scratchpad, run `zone-inventory-rollup.mjs`, print its
   table filtered by the requested mode.

### Helper output

Per ad group: `id, name, archived, campaign_on, adgroup_on, has_live_ad,
has_viable_creative, fully_live, off_reason`. Plus a summary line (N targeted, X
live, Y off, Z archived) and the 12-page scan receipt.

## Verification

- `tests/zone-inventory-rollup.test.mjs` — pure-logic asserts on fixture entities:
  each flag independently, `off_reason` correctness, archived-forced-off.
- **Rendered ⊆ live self-check (in the test):** any ad group returned by
  `get_zone_ads` must roll up `fully_live`. One-directional (geo/rotation makes
  live a superset of rendered), but it cheaply catches a false `off`. Seed the
  fixture with the known-rendered ad groups from the `8z7wzb` probe
  (cb1v4z, pa8vkn, szg7re, hu4gni, fvg5m6, zfcgde, 6ianjo, mke6ol, vd1stu).

## Out of scope (traversal built to extend, not built)

The "free radicals" leg — ad groups targeted to no zone that still render here by
sharing the zone's CAG `0bckt2` via template `ayf1pr`, and are themselves fully
live. That is a static config join (template→CAG membership + targeting + enabled
state), distinct from `get_zone_ads` (which returns one rotation's selection, not
eligibility). The rollup helper's flags are the building blocks for it; the join
is a later pass.

## Cost note

Worst case ≈ 12 (scan) + M `list_ads` + unique-campaigns + unique-creatives
calls, M = matched ad groups. Dedup on campaign/creative IDs keeps it bounded.
Acceptable for a debugging tool; no server-side composite added (MCP stays thin
per its CLAUDE.md).
