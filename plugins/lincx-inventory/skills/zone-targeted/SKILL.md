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

## Flow (issue each fan-out as ONE parallel batch of tool calls)

1. **Confirm the zone.** `get_zone(id=zoneId)`. Capture its `creativeAssetGroupId`
   (the CAG) and `templateId` for the header. If it 404s, surface and stop.

2. **Exhaustive scan of ALL ad groups** (no zoneId filter exists upstream):
   - Call `list_ad_groups(limit: 50, offset: 0, fields: ["name","params","exceptParams","enabled","archived","campaignId","creativeAssetGroupId"])`.
     Read `total`.
   - **Fan out the remaining offsets in one parallel batch**: `offset = 50, 100, …`
     up to `total`. Do NOT page one-at-a-time.
   - Use `limit: 50` (not 100): field-expanded rows are size-capped and a
     `limit:100` page can silently truncate. For each page assert the returned
     item count equals `min(limit, total - offset)`; if short, refetch that offset
     at a smaller limit before trusting the scan.
   - Collect every row into one `adGroups` array. Report the page count + total
     scanned so exhaustiveness is visible.

3. **Select the matched set locally** by running the helper's `selectTargeted`
   (via the CLI in step 6, or mentally: `params.zoneId ∋ zoneId`, minus
   exceptParams conflicts). You need the matched `campaignId`s and ad-group `id`s
   to scope the next calls.

4. **Fetch rollup inputs for the matched set** (parallel batches, deduped):
   - **Campaigns:** page `list_campaigns(limit: 100, offset: …)` across the whole
     network (rows carry `enabled` + `archived`), fanned out in one batch, and
     build `campaigns = { [id]: { enabled, archived } }`. (One map, reused for all
     matched groups — fewer calls than per-campaign gets.)
   - **Ads by campaign, not by group:** dedupe the matched `campaignId`s, then
     `list_ads(campaignId: X, fields: ["adGroupId","creativeId","enabled","archived"])`
     per unique campaign (parallel), and bucket rows into
     `adsByGroup = { [adGroupId]: [ads] }` (keep only matched ad-group ids).
   - **Creatives:** dedupe the `creativeId`s of the enabled ads, `get_creative(id)`
     each (parallel). Build `creatives = { [id]: { creativeAssetGroupId } }`; a
     creative that does not resolve → `null`.

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
- If a scan page truncates even at a smaller limit, say so — do not present a
  partial list as exhaustive.

## Out of scope (do not build here)
"Free radicals" — ad groups targeted to no zone that still render via the zone's
shared CAG. Those are eligibility, not direct targeting; a later command.
