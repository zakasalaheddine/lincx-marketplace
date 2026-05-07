---
name: lincx-revenue-summary
description: Use when the user asks for revenue, fill rate, or RPM totals broken down by Lincx advertiser, network, or site for a period. Loaded by the lincx-reports router.
---

# Lincx — Revenue summary

You produce a revenue / fill / RPM summary. Output contract is `_shared/output-template.md`.

## Flow

1. **Resolve the date range** per `_shared/date-range.md`. If not given, ask.
2. **Resolve the entity dimension** — advertiser, network, or site? If the user named one, use it. If they named none, ask: "Break down by advertiser, network, or site?" Do not guess.
3. **(Optional) Resolve a specific entity** — if the user asked about a *specific* advertiser/site rather than all of them:
   - Page through the matching `list_advertisers` / `list_sites` (max `limit: 100`) and match by case-insensitive substring.
   - Multiple matches → ask. None → surface candidates seen.
4. **Pick a dimension set** per `_shared/dimension-discovery.md`. Prefer one whose dimensions include the chosen entity (`advertiser_id` / `network_id` / `site_id`) and whose metrics include `revenue`, `impressions`, and `fill_rate`.
5. **Run the report:**

   `report_query({ dimensionSetId, startDate, endDate, resolution: "day", dimensions: ["<entity>_id"] })`

   Or `dimensions: ["date", "<entity>_id"]` if the user wants a time series.

6. **Aggregate client-side** if you queried with `date` as a second dimension.
7. **Render** per `_shared/output-template.md`. Column order:

   `<entity> | revenue | impressions | fill_rate | rpm`

   Plus a **totals row** at the bottom showing aggregate `revenue`, total `impressions`, weighted-average `fill_rate`, and overall `rpm`.

Apply `_shared/mcp-call-patterns.md` for pagination semantics, error-string handling, truncation detection, and the ≤ 5 tool-call budget.

## Multi-entity asks

"Revenue by advertiser and site" → run two separate `report_query` calls and emit two tables. Do not Cartesian-product.

## Edge cases

- **No `fill_rate` in the dimension set** → drop the column; note in narrative.
- **Single-entity ask returning many rows** (you forgot to filter) → narrow client-side and re-render.
- **Truncated response** → narrow and re-run.
