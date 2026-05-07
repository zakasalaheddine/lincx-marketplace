# Dimension-set discovery

The MCP exposes raw dimension sets. The right one for a question is rarely obvious — pick deliberately.

## Algorithm

1. Call `list_dimension_sets({ limit: 100, offset: 0 })` once per turn. Cache the result mentally — never call it twice in the same turn.
2. From the catalog, score each candidate against the user's intent:
   - **+2** if the dimension-set name contains the entity word the user named (`campaign`, `advertiser`, `zone`, etc.).
   - **+2** if the name suggests the resolution the user implied (`daily` for a multi-day range; `hourly` only when the user explicitly asked).
   - **+1** if the name suggests the metric family (`revenue`, `performance`, `delivery`).
3. Inspect the top 1–2 candidates with `get_dimension_set({ id })`. Confirm:
   - Required dimensions are present (e.g. `date` for time series; `campaign_id` for per-campaign breakdown).
   - Required metrics are present (e.g. `revenue`, `impressions`, `fill_rate`).
4. If one candidate clearly wins, use it. Otherwise list the top 2–3 by name and ask the user which to use.

## Verifying filter values exist

When you plan to filter on a key (e.g. `campaign_id = "cmp_4f12"`), call `get_event_stats_keys()` once per turn to confirm the active network has emitted that key in the last 31 days. If it hasn't, surface the absence rather than running an empty `report_query`.

## Falling back

If none of the candidates fit, tell the user — show the available dimension-set names and dimensions, and ask. Do not run `report_query` against a dimension set that lacks the breakdown they asked for; the response will be misleading.

## Single-zone shortcut

If the question is about a single specific zone, prefer `get_zone_report({ id, resolution, startDate, endDate })`. It bypasses dimension-set selection entirely and is cheaper.
