---
name: lincx-creative-anomalies
description: Use when the user asks about top/bottom creatives, zones, sites, or templates, or about WoW/DoD drops, lifts, or anomalies in Lincx delivery. Loaded by the lincx-reports router.
---

# Lincx — Creative anomalies

You produce one of two reports based on the user's wording: **Winners/losers** or **Anomaly comparison**. Output contract is `_shared/output-template.md`.

## Mode A — Winners / losers

Triggered by "top", "best", "worst", "bottom", "underperformers", "highest", "lowest".

1. **Resolve the date range** per `_shared/date-range.md`.
2. **Resolve the entity dimension** (zone / creative / site / template). If unclear, ask.
3. **Resolve N** — default 10 winners + 10 losers. If the user asked "top 5", use 5. If they only asked for "top", confirm 10.
4. **Pick a dimension set** per `_shared/dimension-discovery.md`. The dimension must cover the chosen entity.
5. **Run the report:**

   `report_query({ dimensionSetId, startDate, endDate, resolution: "day", dimensions: ["<entity>_id"] })`

6. **Sort client-side** by the primary metric the user implied (CTR / conversions / revenue / RPM). Take top N + bottom N.
7. **Render** with column order:

   `<entity> | metric | volume | rank`

## Mode B — Anomaly comparison

Triggered by "dropped", "fell", "spiked", "this week vs last week", "today vs yesterday".

1. **Resolve current and prior ranges** per `_shared/date-range.md`. **Never assume "vs prior period of equal length"** — ask. Confirm both ranges back to the user before any tool call (e.g. "Current 2026-05-01 → 2026-05-07, prior 2026-04-24 → 2026-04-30 — both 7 days. Confirm?").
2. **Resolve entity dimension** (zone / creative / site / template).
3. **Pick a dimension set** per `_shared/dimension-discovery.md`.
4. **Run two `report_query` calls** — one per range. Each scoped to the same dimension set + dimensions.
5. **Join client-side on the entity key.** Compute:
   - `delta_pct = (current - prior) / prior * 100`
   - `delta_abs = current - prior`
6. **Apply thresholds:**
   - Default `|delta_pct| ≥ 25%`.
   - **Volume floor** = 10% of the median current-period row volume on the primary metric. If applying it would drop *every* row, surface that fact and ask the user whether to lower it.
7. **Sort by `|delta_pct|` descending.** Render with column order:

   `<entity> | current | prior | delta_pct | delta_abs`

## Single-zone fast path

If the user asks about a single specific zone, prefer `get_zone_report({ id, resolution, startDate, endDate })` directly. It is cheaper and avoids dimension-set selection.

## Edge cases

- **No rows clear the threshold** → state plainly. Offer to lower threshold or floor; do not lower silently.
- **Empty join (entity present in only one range)** → list those rows separately under a "new / disappeared" sub-table; mark `prior` or `current` as `—`.
- **Truncated response on either range** → narrow and re-run; do not synthesize.
