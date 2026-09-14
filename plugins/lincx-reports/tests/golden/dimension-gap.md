# Golden — dimension gap (report can't answer the question)

**User:** Show NewSeniorDeals.com revenue per day for Sept 1–9, in Denver time. Use the Zones Daily report.

**Catalog (from `list_dimension_sets`):**

- `Zones Daily` — `date`, `zone`, `rank`, `geoRegion`, `device` (no `hour`)
- `Zones Hourly` — `date`, `hour`, `zone`, `rank`
- `Geo Daily` — `date`, `geoRegion`

**Expected tool sequence:**

1. (no tool) — Claude confirms the year and repeats `2026-09-01 → 2026-09-09`.
2. `list_dimension_sets({ limit: 100, offset: 0, fields: ["dimensions"] })`.
3. (no tool) — dimension check: required `zone` (filter), `date`, `hour` (Denver days). `Zones Daily` is missing `hour`; `Zones Hourly` covers all three.
4. (no tool) — Claude stops and asks: `Zones Daily` has no `hour`, so Denver days can't be computed from it; `Zones Hourly` carries zone, date, hour — use that one?
5. After the user agrees: `report_query({ dimensionSetId: "<Zones Hourly id>", startDate: "2026-09-01", endDate: "2026-09-09", groupBy: ["date"], filter: { zone: "NewSeniorDeals.com" }, timezone: "America/Denver" })`.

**Variant — no report covers it:** if `Zones Hourly` didn't exist, step 4 names the missing `hour`, names `Zones Daily` as the closest report, says to add `hour` to it in Reports Center, and offers UTC days as an explicit alternative. No `report_query` until the user picks.

**Reviewer checklist:**

- [ ] `report_query` was NOT called against `Zones Daily` with `timezone`.
- [ ] The missing dimension (`hour`) and the covering report were both named.
- [ ] `timezone` was not silently dropped to make `Zones Daily` fit.
- [ ] No offer to create or edit a report (the MCP is read-only).
- [ ] If the server returned `Error: dimension set … is missing [hour]`, Claude went back to the suggestion step instead of retrying.
