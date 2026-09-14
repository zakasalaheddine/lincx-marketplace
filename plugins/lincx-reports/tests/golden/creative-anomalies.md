# Golden — creative anomalies (anomaly mode)

**User:** Which zones dropped this week vs last week?

**Expected tool sequence:**

1. (no tool) — Claude asks for the comparison window: "this week = current 7 days? prior = previous 7 days? Confirm dates."
2. `list_dimension_sets({ limit: 100, offset: 0, fields: ["dimensions"] })`.
3. (no tool) — dimension check: required `zone`. Claude names the set it picked.
4. `report_query` for the **current** range, `groupBy: ["zone"]`.
5. `report_query` for the **prior** range, `groupBy: ["zone"]`.
6. Client-side join on `zone`; compute `delta_pct`, `delta_abs`; apply `|delta_pct| ≥ 25%` and a volume floor at 10% of median current revenue.

**Expected response shape:**

- Headline: count of zones that moved ≥ ±25% with non-trivial volume; biggest mover named.
- Narrative cites the largest dollar-impact mover.
- Markdown table: `zone | current | prior | delta_pct | delta_abs`, sorted by `|delta_pct|` descending.
- Footer naming the dimension set, both ranges, resolution, and active network.

**Reviewer checklist:**

- [ ] Comparison window was confirmed before any tool call.
- [ ] Volume floor was applied; if it would drop everything, the skill asked instead of silently lowering.
- [ ] Two `report_query` calls — not one.
