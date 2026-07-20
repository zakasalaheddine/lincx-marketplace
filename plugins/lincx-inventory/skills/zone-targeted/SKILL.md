---
name: zone-targeted
description: Use when the user asks which ad groups are directly targeted to a Lincx zone, or whether a zone's targeted ad groups are live/off — the exhaustive zone-targeting inventory with an enabled-state rollup. Backs the /zone-targeted command.
---

# Lincx — Zone targeting inventory

Answer: "For zone Z, list every ad group **directly targeted** to it, and for each
whether it is **fully live** (campaign + ad group + ad all enabled with a viable
creative attached) or **where it is off**." Exhaustive — no targeted ad group missing.

## Inputs
- `zoneId` — required (the command resolves it, remembering the last one).
- `mode` — `all` (default) | `live` (only fully-live) | `off` (only not-fully-live).

## Rollup rules (the helper enforces these — do not reimplement in prose)
- A level is **on** only if `enabled === true && archived !== true`. `archived` is
  omitted from list rows when false — a missing key means not archived.
- `fully_live = campaign_on && adgroup_on && has_live_viable_ad`.
- `has_live_viable_ad` is a **per-ad conjunction**: some single ad is enabled,
  not archived, AND its `creativeId` resolves to a creative. Never mix "some
  enabled ad" with "some resolving creative" across different ads.
- **Targeting** = the zone appears in the ad group's `params.zoneId`.
  `exceptParams.zoneId` is an **exclusion**: zone only in exceptParams → not
  targeted; zone in both → excluded, reported as `conflicting`.

## Flow

Pagination rule (applies to every `list_*` call below): **page sequentially,
following `next_offset` until `has_more` is false.** `fields` is top-level only, so
the ad-group scan must request full `params` — those rows are large and the
response is size-capped, so a page often returns FEWER rows than `limit` and
includes a `truncated` object; the endpoint then sets `next_offset` to exactly
where you must continue. `next_offset` is authoritative — always pass it as the
next `offset`. NEVER assume a fixed stride (`offset += limit`) and never fan list
pages out in parallel: a fixed stride skips the fetched-but-dropped rows and
silently breaks exhaustiveness. Refetching the same offset does not help (it
re-truncates identically) — the remedy for a short page is to continue from
`next_offset`. Only independent single-entity gets (`get_creative`) may be
parallel-batched.

1. **Confirm the zone.** `get_zone(id=zoneId)`. Capture its `creativeAssetGroupId`
   (the CAG) and `templateId` for the header. If it 404s, surface and stop.

2. **Exhaustive scan of ALL ad groups** (no zoneId filter exists upstream):
   - Call `list_ad_groups(limit: 50, offset: 0, fields: ["name","params","exceptParams","enabled","archived","campaignId","creativeAssetGroupId"])`,
     read `total`, then page following `next_offset` to the end per the rule above.
   - Collect every row into one `adGroups` array. Report the page count + total
     scanned. If the collected count is below `total`, say so — do not present a
     partial list as exhaustive.

3. **Select the matched set locally** by running the helper's `selectTargeted`
   (via the CLI in step 6, or mentally: `params.zoneId ∋ zoneId`, minus
   exceptParams conflicts). You need the matched `campaignId`s and ad-group `id`s
   to scope the next calls.

4. **Fetch rollup inputs for the matched set** (dedupe IDs; same pagination rule —
   follow `next_offset`, never a fixed stride):
   - **Campaigns:** page `list_campaigns(limit: 100, offset: 0)` following
     `next_offset` to the end (rows carry `enabled` + `archived`); build
     `campaigns = { [id]: { enabled, archived } }`. A missing campaign would make a
     live ad group misreport "off at campaign", so this map must be complete.
   - **Ads by campaign:** dedupe the matched `campaignId`s. For each unique
     campaign, page
     `list_ads(campaignId: X, limit: 100, offset: 0, fields: ["adGroupId","creativeId","enabled","archived"])`
     following `next_offset` to the end. `list_*` tools default to `limit: 20`, so
     an unpaged call silently drops ads and would misreport a live ad group as off.
     Bucket all rows into `adsByGroup = { [adGroupId]: [ads] }`, keeping only
     matched ad-group ids.
   - **Creatives:** dedupe the `creativeId`s of the enabled ads, `get_creative(id)`
     each (independent single gets — safe to batch in parallel). Build
     `creatives = { [id]: { creativeAssetGroupId } }`; a creative that does not
     resolve → `null`.

5. **Write one JSON file** to the scratchpad with shape
   `{ zoneId, zoneCagId, adGroups, campaigns, adsByGroup, creatives }` where
   `adGroups` is the FULL scan (the helper does the selection).

6. **Run the helper** — it does all boolean logic and formatting:
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/zone-inventory-rollup.mjs <jsonPath> <mode>`
   Print its markdown output verbatim.

7. **Add the header** above the table: zone name, CAG, template, and the scan
   receipt (pages fetched / total scanned). If `summary.conflicting > 0`, note the
   conflicting ad groups (targeted AND excepted) below the table.

## Guardrails
- Never pass `networkId` to any tool — it is session-scoped upstream.
- On `"Error: Not authenticated…"` surface it and ask the user to run `auth_login`;
  do not retry. On `"Error: Forbidden…"` check the active network and offer to switch.
- If a scan cannot reach `total` rows (`next_offset` stops advancing while
  `has_more` stays true), say so — never present a partial list as exhaustive.

## Out of scope (do not build here)
"Free radicals" — ad groups targeted to no zone that still render via the zone's
shared CAG. Those are eligibility, not direct targeting; a later command.
