# Zone Inventory — design

> **SUPERSEDED (2026-07-20):** the client-side scan + rollup described below was
> moved server-side into the MCP composite `get_zone_targeting_inventory` (see the
> lincx-mcp repo). The `/zone-targeted` skill is now a thin presenter of that tool;
> the client-side scan and the `zone-inventory-rollup.mjs` helper were removed. This
> doc is kept for the data-model findings and rollup semantics, which the MCP tool
> ports verbatim.

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
  ad groups; paged at `limit:50` following `next_offset` (see Skill flow — full
  `params` rows truncate, so paging is `next_offset`-driven, ~23+ pages).
- `list_ad_groups` rows are compact and already carry everything for the ad-group
  level: `{ id, name, enabled, archived, params, campaignId, advertiserId,
  creativeAssetGroupId }` via `fields`.
- **Campaign** has `enabled` (`get_campaign`).
- **Ad** has `enabled` and a single `creativeId` (`list_ads?adGroupId=` returns
  `{ id, name, enabled, creativeId }` compactly).
- **Creative has no `enabled` flag.** "Viable creative attached" therefore means:
  the ad's `creativeId` resolves to an existing creative. CAG match
  (creative.creativeAssetGroupId === zone CAG) is reported as a note, not a gate.
- **`archived` is omitted from list rows when false** (verified — same as the
  networks endpoint). So every level's gate is `enabled === true && archived !==
  true`, treating a missing `archived` key as false.

## Rollup semantics

Enabled-state is evaluated **per level**, and each level gates on
`enabled && !archived` (not just `enabled` — a level can be archived-but-enabled):

| flag | source |
|---|---|
| `campaign_on` | campaign.enabled && !campaign.archived |
| `adgroup_on` | adGroup.enabled && !adGroup.archived |
| `has_live_viable_ad` | ∃ ad: `ad.enabled && !ad.archived && resolves(ad.creativeId)` |

`has_live_viable_ad` is a **per-ad conjunction**, not two independent flags — an
enabled ad with a dangling creative and a disabled ad with a valid creative must
NOT combine into a false "live" (Fable review, correctness #1). For diagnostics
the helper still reports `has_enabled_ad` and `creative_resolves` separately so
the user sees *why* an ad group has no viable ad, but the gate is the conjunction.

`fully_live = campaign_on && adgroup_on && has_live_viable_ad`.

`off_reason` = the list of failing levels (e.g. `["adgroup_on"]`,
`["has_live_viable_ad"]`).

**Archived targeted ad groups are shown, flagged `archived`, and always render as
`off`** (decision: maximize "none missing"; archived reads as an off-entry, not an
omission).

**`exceptParams.zoneId` = exclusion, not targeting.** An ad group with the zone
only in `exceptParams` is not targeted (skip it). An ad group with the zone in
**both** `params.zoneId` and `exceptParams.zoneId` is excluded at serve time — drop
it from the targeted set but surface it in a `conflicting` note so it isn't a
silent omission.

## Command surface

`/zone-targeted [<zoneId>] [all|live|off]` — in the new `lincx-inventory` plugin.

- `/zone-targeted 8z7wzb` — set + run against that zone; **remember it** in session
  state (same seam as `templates-editor-plugin`'s `session-state.mjs`).
- `/zone-targeted` — reuse the last remembered zone (managers set it once).
- `/zone-targeted live` / `/zone-targeted off` — reuse last zone, filter.
- `all` (default) — every targeted ad group with its rollup.
- `live` — only `fully_live`. `off` — only not-`fully_live` (incl. archived).

## Architecture

New **`lincx-inventory`** plugin — the home for all inventory-style queries over
the Lincx config (this `/zone-targeted` command is its first; more inventory
commands land here rather than as separate plugins). Mirrors
`templates-editor-plugin` / `lincx-reports` (skill + command + pure tested
helper + `session-state.mjs`). The skill makes MCP calls; the pure helper does
the boolean logic and formatting — MCP tools are unavailable to node scripts, so
the skill dumps raw entities to JSON and the script reads that (same seam as
`resolve-zone-and-ads.mjs`).

```
plugins/lincx-inventory/
├── .claude-plugin/plugin.json
├── commands/zone-targeted.md
├── skills/zone-targeted/SKILL.md
├── scripts/zone-inventory-rollup.mjs      # pure: raw entities → rollup rows + table
├── scripts/session-state.mjs              # remember last zone (reuse templates' pattern)
└── tests/zone-inventory-rollup.test.mjs
```

### Skill flow — sequential paging, follow `next_offset`

Pagination is **sequential and driven by `next_offset`**, not fixed-stride
parallel fan-out. Verified against live data (2026-07-20): `list_ad_groups` with
full `params` is size-capped — a `limit:100` page returned only 62 rows with a
`truncated` object and `next_offset:62`. Row size is data-dependent (some ad
groups carry huge `dateTime`/`params` arrays), so no fixed limit is provably safe
and a fixed offset stride skips the fetched-but-dropped rows, breaking
exhaustiveness. `fields` is **top-level only** — nested `params.zoneId` is ignored
(the whole `params` object is dropped), so `params` cannot be narrowed to dodge
truncation. The one correct rule: page following `next_offset` until `has_more` is
false. Only independent single-entity gets (`get_creative`) may be parallel-batched.

1. `get_zone <zoneId>` — confirm it exists; capture CAG + template for the header.
2. **Scan (all ad groups — exhaustive, no zoneId filter exists):**
   - `list_ad_groups` `limit:50`,
     `fields:["name","params","exceptParams","enabled","archived","campaignId","creativeAssetGroupId"]`,
     `offset:0`. Row `total` reveals the count (e.g. 1150).
   - Page following `next_offset` to the end. A page may return fewer rows than
     `limit`; `next_offset` is authoritative. Refetching a short offset re-truncates
     identically — the remedy is to continue from `next_offset`.
   - Keep rows where `params.zoneId ∋ zoneId`. Apply the `exceptParams` rule above.
   - If collected rows < `total`, report it — never present a partial list as exhaustive.
3. For the matched set (dedupe IDs; same `next_offset` paging rule):
   - **Campaign enabled-map:** page `list_campaigns` `limit:100` following
     `next_offset` (rows carry `enabled` + `archived`) and build
     `campaignId → {enabled, archived}`. (One map, reused for all matched groups.)
   - **Ads by campaign, not by group:** dedupe matched `campaignId`, then page
     `list_ads?campaignId=X` `fields:["adGroupId","creativeId","enabled","archived"]`
     following `next_offset` per unique campaign, and bucket rows back by
     `adGroupId`. `list_ads` accepts `campaignId` and returns `adGroupId` per row
     (verified). `list_*` defaults to `limit:20` — an unpaged call drops ads.
   - **Creatives:** dedupe `creativeId` across the enabled ads, `get_creative`
     each in one parallel batch → resolves? CAG match?
4. Write raw JSON to the scratchpad, run `zone-inventory-rollup.mjs`, print its
   table filtered by the requested mode.

### Helper output

Per ad group: `id, name, archived, campaign_on, adgroup_on, has_enabled_ad,
creative_resolves, has_live_viable_ad, fully_live, off_reason`. Plus a summary
line (N targeted, X live, Y off, Z archived, any `conflicting` exceptParams) and
the scan receipt (pages fetched, total scanned).

## Verification

- `tests/zone-inventory-rollup.test.mjs` — pure-logic asserts on fixture entities:
  each flag independently, `off_reason` correctness, archived-forced-off.
- **Rendered∩targeted ⊆ live self-check (in the test):** any ad group that is
  BOTH returned by `get_zone_ads` AND in the directly-targeted set must roll up
  `fully_live`. The intersection matters — "free radicals" (out of scope) render
  via shared CAG without being directly targeted, so they appear in
  `get_zone_ads` with no rollup row; asserting "every rendered group is live"
  would fail structurally. One-directional (geo/rotation makes live a superset of
  rendered∩targeted), but it cheaply catches a false `off`. It is a frozen-fixture
  assertion (validates the snapshot, not live prod), seeded with the known-
  rendered ad groups from the `8z7wzb` probe (cb1v4z, pa8vkn, szg7re, hu4gni,
  fvg5m6, zfcgde, 6ianjo, mke6ol, vd1stu).
- **Exhaustiveness honesty:** limit/offset paging over a live collection can skip
  or double-count a row if ad groups are created/deleted mid-scan. Negligible for
  a debug tool; the scan receipt reports the total so a mismatch is visible.

## Out of scope (traversal built to extend, not built)

The "free radicals" leg — ad groups targeted to no zone that still render here by
sharing the zone's CAG `0bckt2` via template `ayf1pr`, and are themselves fully
live. That is a static config join (template→CAG membership + targeting + enabled
state), distinct from `get_zone_ads` (which returns one rotation's selection, not
eligibility). The rollup helper's flags are the building blocks for it; the join
is a later pass.

## Cost note

The ad-group scan is inherently **sequential** (≈ total/50 pages, each starting at
the prior page's `next_offset`) because response truncation makes page size
data-dependent — the fixed-stride parallel fan-out first considered is unsafe here
(it skips dropped rows). Matched-set campaign/ads paging is also `next_offset`-driven;
only `get_creative` fans out in parallel. No way to skip the full scan without
breaking exhaustiveness — an off ad group under an unscanned advertiser is exactly
what the query hunts. No server-side composite added (MCP stays thin per its CLAUDE.md).
