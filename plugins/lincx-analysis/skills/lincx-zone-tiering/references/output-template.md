# Output template — the five-part contract

Every tier analysis response is exactly five parts in this order.

## 1. Headline (≤ 25 words, one sentence)

The tier structure and the confidence it rests on. Name the zone and the date range.

> Zone `abc123` splits into 3 tiers over 2026-06-01 → 2026-06-30; Tier 1 holds 4 creatives at 71% of revenue (HIGH confidence).

No hedging adjectives. Numbers carry the verdict.

## 2. Tier rationale (2–4 sentences)

This is `tier_grouping.tier_rationale`, which arrives empty for you to write.

Explain *why* the zone splits where it does — the CPM separation between bands, whether
Tier 1 is thin, whether revenue is concentrated. Cite the specific creatives that define
each boundary. Ground it in `dataset_confidence` and `overall_zone_health`.

If the split is weak (one dominant creative, no meaningful gap), say that outright. A
tier structure the data does not support is worse than no recommendation.

## 3. Tier tables

One markdown table per non-empty tier, in order `TIER_1`, `TIER_2A`, `TIER_2B`, `TIER_3`.
Head each with the tier label and its creative count.

Fixed columns:

`rank | creativeId | adGroupId | impressions | ctr | cpm | revenue | days_at_rank | localTier`

- Sorted by revenue desc, then cpm desc — the order the engine already returns.
- **Cap at 25 rows per tier.** Past that, show the top 25 by revenue and note how many
  were omitted.
- Currency `$1,234.56`; rates `12.3%`; counts with thousands separators.
- Add a one-line `justification` under any row whose placement is not self-evident from
  its own numbers — a low-CPM creative in Tier 1 (carried by volume), a
  `Rank-Constrained` row, anything a reader would otherwise read as an error.

For `rankedOfferOptimization`, replace the tier tables with one slot table:

`rank | status | tier (group_key) | creativeId | adGroupId | cpm | impressions | days_at_rank | standing`

then list `unassigned` creatives below it.

## 4. Findings and actions

Two short lists, both of which you write from scratch:

**Risks** — every entry in `risk_flags`, translated into what it means for this zone.
`RPZL_THIN_TIER1` means the tier structure will not hold; `RPZL_CONCENTRATION` means one
creative is carrying the zone and its loss is the real risk; `RANK_TIER_MISMATCH` means
a specific placement contradicts the tiering.

**Next actions** — a prioritized checklist, most impactful first. Concrete and
attributable: name the creative, the tier, the rank. "Promote `cr_x9k2` from Tier 2B to
Tier 1 — Promotion-Eligible at 1.4× its tier's CPM benchmark" beats "consider promoting
strong performers."

Where an action needs a publisher-side zone-tier-config change, say so — the analysis
does not enact it.

## 5. Footer (one line, fixed format)

`Source: analysis <analysisId> · zone <zoneId> · <YYYY-MM-DD> → <YYYY-MM-DD> <TZ> · <analysisType> · confidence <HIGH|MEDIUM|LOW> · deterministic engine, narrative by Claude`

Append extra lines when they apply:

- `Note: dataset spans <N> days (< 14) — rank standings are DIRECTIONAL, not CONFIRMED.`
- `Note: input sections omitted for size: <omitted list>. Tier assignments are unaffected.`
- `Note: response incomplete — only the engine verdict returned. Re-run over a shorter range for the input breakdown.`

The footer makes the result auditable: anyone can re-run `get_analysis` on that id and
check every number.

## Forbidden

- Emoji.
- First person ("I", "we").
- Filler: "based on the data", "the data shows", "as you can see".
- Recomputed tiers, ranks, or scores. The engine's numbers are the numbers.
- Presenting the empty `tier_rationale` / `justification` / `next_actions` fields as
  missing data. They are your assignment.
- Causal claims the data does not support. "Tier 3 creative `cr_a1` sits at rank 1" is a
  finding; "because the publisher misconfigured it" is a guess.
