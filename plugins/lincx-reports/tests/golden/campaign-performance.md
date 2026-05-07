# Golden — campaign performance

**User:** How did the Acme Spring campaign do March 1–15?

**Expected tool sequence:**

1. (no tool) — Claude asks "March 2026 or March 2025?" because the year is unspecified.
2. `list_campaigns({ limit: 100, offset: 0 })` — pages until `Acme Spring` is found.
3. `list_dimension_sets({ limit: 100, offset: 0 })`.
4. `get_dimension_set({ id })` for the best candidate (likely `campaign_daily`).
5. `report_query({ dimensionSetId, startDate: "2026-03-01", endDate: "2026-03-15", resolution: "day", dimensions: ["date", "campaign_id"] })`.
6. Client-side filter to the resolved campaign ID.

**Expected response shape:**

- 1-sentence headline naming the campaign and the date range.
- 2–4-sentence narrative.
- Markdown table with columns `date | spend | impressions | clicks | conversions | ctr | ecpm`, ≤ 30 rows, sorted ascending by date.
- Footer: `Source: dimension set "<name>" (<id>) · range 2026-03-01 → 2026-03-15 · resolution day · network <active_network>`.

**Reviewer checklist:**

- [ ] Year was confirmed before any tool call.
- [ ] No `auth_login` was attempted automatically.
- [ ] Footer includes all four facts (dimension set + id, range, resolution, network).
- [ ] Numbers formatted: currency $ with 2 decimals, rates with %, counts with thousands separators.
