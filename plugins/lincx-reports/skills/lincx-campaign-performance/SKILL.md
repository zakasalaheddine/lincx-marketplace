---
name: lincx-campaign-performance
description: Use when the user asks how a Lincx campaign performed over a date range — spend, impressions, clicks, conversions, CTR, eCPM. Loaded by the lincx-reports router.
---

# Lincx — Campaign performance

You produce a campaign-performance report. The output contract is `_shared/output-template.md`.

## Flow

1. **Resolve the date range** per `_shared/date-range.md`. If not given, ask. Never default.
2. **Resolve the campaign(s):**
   - Page through `list_campaigns({ limit: 100, offset })` and match by case-insensitive substring on `name`.
   - One match → use it. Multiple matches → list candidates with IDs and ask. No matches → surface the closest names from what you've seen and ask.
   - On large networks, if the first 2–3 pages don't yield a match, ask the user for the campaign ID or the owning advertiser to narrow the search. See `_shared/mcp-call-patterns.md`.
3. **Pick a dimension set** per `_shared/dimension-discovery.md`. Prefer one whose dimensions include `campaign_id` and `date`.
4. **Run the report:**

   `report_query({ dimensionSetId, startDate, endDate, resolution: "day", dimensions: ["date", "campaign_id"] })`

5. **Filter rows client-side** to the resolved campaign ID(s).
6. **Render** per `_shared/output-template.md`. Fixed column order:

   `date | spend | impressions | clicks | conversions | ctr | ecpm`

   If the dimension set is missing one of these metrics (e.g. `ecpm`), drop that column and note the missing one in the narrative.

## Edge cases

- **Empty result for a campaign you confirmed exists** → suggest checking with `auth_status` (right network?) and `get_event_stats_keys` (events being received?). Do not run them automatically.
- **Truncated `report_query` response** → narrow the range and re-run; do not synthesize from the partial body.

## Cheatsheet

`references/dimension-cheatsheet.md` records the dimension-set names the team has seen. It is not authoritative — always verify with `get_dimension_set` before using.
