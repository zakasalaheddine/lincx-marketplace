# Golden — revenue summary

**User:** Give me revenue by advertiser for last week.

**Expected tool sequence:**

1. (no tool) — Claude asks: "Calendar week (Mon–Sun) or rolling 7 days?"
2. `list_dimension_sets({ limit: 100, offset: 0 })`.
3. `get_dimension_set({ id })` for the best candidate (likely `advertiser_daily`).
4. `report_query({ dimensionSetId, startDate, endDate, resolution: "day", dimensions: ["advertiser_id"] })`.

**Expected response shape:**

- Headline naming total revenue and fill rate for the resolved range.
- Narrative cites the leading advertiser and a one-sentence shape-of-the-distribution observation.
- Markdown table: `advertiser | revenue | impressions | fill_rate | rpm`, sorted by revenue descending, with a totals row at the bottom.
- Footer matching the resolved range.

**Reviewer checklist:**

- [ ] The skill asked between calendar vs rolling week before any tool call.
- [ ] Totals row weighted-averages `fill_rate` (not arithmetic mean).
- [ ] No `auth_login` automatic invocation.
