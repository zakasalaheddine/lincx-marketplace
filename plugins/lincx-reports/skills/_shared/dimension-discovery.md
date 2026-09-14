# Dimension check — before every `report_query`

A dimension set (a custom report in Reports Center) decides which dimensions exist for the answer. Reports Center caps how many dimensions one report can carry, so a network usually has many overlapping reports and none of them is complete. Picking one without checking it against the question produces answers that look fine and are wrong — e.g. a `timezone` on a report without `hour` used to shift every date by a day.

This check is a **gate**. Do not call `report_query` until it passes.

## Step 1 — Derive the required dimensions from the request

Write the list down before looking at any report:

| The user asks for… | Required dimension |
|---|---|
| A breakdown ("by zone", "per advertiser") | that entity → goes in `groupBy` |
| One specific entity ("how did campaign X do") | that entity → goes in `filter` |
| A time series ("per day", "trend", "WoW") | `date` |
| Per-hour detail, OR any local-time day (`timezone` other than UTC, "Denver days", "our business day") | `hour` |
| Device, geo, rank, template, … | that dimension |

Match names to what the report actually lists — dimension names are the report's own strings (`zone`, `advertiser`, `campaign`, `geoRegion`, `device`, `hour`, …), compared case-insensitively. Never guess a spelling like `campaign_id`; read it from the catalog.

## Step 2 — Load the catalog once, with dimensions

`list_dimension_sets({ limit: 100, offset: 0, fields: ["dimensions"] })` — one call returns every report with its `dimensions` array (the MCP's equivalent of the Dimensions column in Reports Center). Page with `offset` only if `next_offset` is present. Never call it twice in one turn.

If a returned set has no `dimensions` field, `get_dimension_set({ id })` that one candidate.

## Step 3 — Check coverage

For each set, **missing = required − set.dimensions**.

- **The report the user named, or the obvious candidate, covers everything** → use it.
- **It's missing something, but other reports cover everything** → do not run it. Tell the user what's missing and offer the reports that do cover it (names and ids below are illustrative):

  > `Zones Daily` (ab12cd-ef34gh) has no `hour`, so Denver days can't be computed from it. These carry everything you asked for (zone, date, hour): `Zones Hourly` (ab12cd-ij56kl). Use that one?

  Several full matches → prefer the one with the fewest extra dimensions (fewer, smaller rows); list up to 3 and ask if it isn't clear-cut.
- **No report covers everything** → do not run a partial answer. Say which dimensions are missing, name the closest report (fewest missing) and what to add to it:

  > No report on this network has both `geoRegion` and `hour`. Closest is `Geo Daily` (ab12cd-mn78op), missing `hour` — add `hour` to it in Reports Center and I can run this. Or I can answer in UTC days from `Geo Daily` now.

  The MCP is read-only — never offer to create or edit the report yourself.

Never silently drop a required dimension (e.g. quietly switch to UTC, or remove a breakdown) to make a report fit. Offering it as an explicit alternative, like above, is fine.

## Step 4 — Confirm, then run

One line before the call so the choice is auditable: `Using "Zones Hourly" (ab12cd-ij56kl) — has zone, date, hour.` Then call `report_query` with the checked `groupBy` / `filter` / `timezone`.

## Server backstop

`report_query` re-checks this on its side and returns `Error: dimension set <id> is missing [<dims>]…` (or `…returned daily rows with no hour…`). If you see it, the gate above was skipped or the report changed: go back to Step 3 with those dimensions. Do not retry the same call, and do not drop `timezone` or the breakdown without asking.

## Verifying filter values exist

When you plan to filter on a value (e.g. `{ campaign: "Spring Promo" }`), call `get_event_stats_keys()` once per turn to confirm the network has emitted that key in the last 31 days. If it hasn't, surface the absence rather than running an empty `report_query`.

## Single-zone shortcut

If the question is about a single specific zone and needs no other dimension, prefer `get_zone_report({ id, resolution, startDate, endDate })`. It bypasses dimension-set selection entirely and is cheaper.
