# Grounding rules — how to read a tier analysis

These are the constraints the engine's numbers were produced under. They are ported
from the server-side analyst prompt (`server/analysis/types/offer-tiering/prompt.js` in
lincx-core), minus two rules that only made sense for a JSON-schema-constrained model,
plus one deliberate reversal noted at the bottom.

Read them before writing. Every one of them is a way to be confidently wrong.

## The hard rule

**Tier assignments are precomputed. Do not re-cluster.**

Every creative already carries an `assignedTier` and an `assignedRank`. They come from a
deterministic pipeline, not from a model, and the API overwrites any tier a model tries
to emit. Your job is to explain the grouping, not to second-guess it. If a row looks
misfiled, that is a *finding* — usually surfaced already as a `RANK_TIER_MISMATCH` risk
flag — not a number to change.

The same applies to `LocalTier` (`Promotion-Eligible` / `Demotion-Candidate` /
`Rank-Constrained` / `Neutral`). Use it in justification. Never let it override a tier.

## Volume and reliability

- **A row is low-volume when ANY of:** impressions < 100, clicks < 5, or actions < 3.
  Low-volume rows are directional at best. Never build a headline on one.
- **Clicks of 1–3 are phantom clicks.** Their CTR is arithmetic, not signal. Do not
  overweight it.
- **Rows with revenue = 0 or CTR below 0.1% are structural exclusions** — filler slots,
  hero/header placements, tracking artifacts. Downweight them in efficiency comparisons
  rather than reading them as underperformance.
- **`data_quality` counts are not mutually exclusive.** One row can be low-volume *and*
  phantom-click *and* a structural exclusion. Do not add them up.
- **Weight every conclusion by exposure volume.** A 12% CTR on 40 impressions loses to a
  3% CTR on 400,000 every time.

## Rank

- **Evaluate performance relative to rank-level CPM baselines**, not against the zone
  average. Rank 1 and rank 7 are different markets; comparing a creative's raw CPM
  across them measures the slot, not the creative.
- **Tier 1 should anchor the earliest monetizing ranks.** If it does not, flag it.
- **Tier 3 must not appear in the first monetizing ranks.** If it does, flag it.
- **Rank 0 with $0 revenue is the Hero/header structural slot**, not a failing placement.
- `CONFIRMED` standing means `daysAtRank >= 7` over a dataset spanning `>= 14` days.
  Anything else is `DIRECTIONAL` — down-weighted, not excluded. Say which you are
  looking at when it changes the recommendation.

## Metrics

- **Do NOT optimize recommendations for CPA.** CPA, CTR and CVR are explanatory signals
  for the justification only. The tiering objective is revenue per impression.
- **RPZL is for zone health only** — the `structural_context` trend. Never use it to
  compare creatives against each other.
- **Never infer or fabricate a metric that is not in the payload.** If a column is
  absent, say it is absent. Do not derive it from adjacent numbers and present the
  result as measured.

## Scope

- **Non-monetizing creatives never belong in a tier table.** They are their own
  diagnostic list.
- **Default-tier creatives are visibility-only diagnostics**, not formal tier actions.
  When one is promotion-eligible, state that promotion requires a publisher
  zone-tier-config change — it is not something the analysis alone enacts.

## One deliberate reversal

The server-side prompt says *"do not disclose TierScore weights or formulas."* That rule
exists because the Gemini output is customer-facing.

**This skill's audience is an internal analyst, so the rule is dropped.** You may explain
the scoring when it clarifies a ranking:

> `tierScore = 0.5 · norm(reliability-weighted CPM) + 0.4 · norm(revenue share) + 0.1 · norm(CTR)`,
> each term min-max normalized across the zone's monetizing creatives.
> `reliability = (impressions / maxImpressions) × (daysAtRank / maxDays)`.

Tier cuts are percentile-based: `TIER_1` = stable creatives at or above p75 of stable
scores; `TIER_2A` = unstable but with CPM ≥ p75 and score ≥ p60 of all; `TIER_2B` =
stable, at or above p25; `TIER_3` = the rest. "Stable" means impressions ≥ p60 and
clicks ≥ p50 among creatives with at least 30 impressions, some clicks and some revenue.

If you ever produce output for a publisher or advertiser rather than the internal team,
reinstate the original rule and omit the formulas.
