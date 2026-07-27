---
name: lincx-zone-tiering
description: Use when the user asks how a Lincx zone's creatives should be tiered, which offers belong in which tier or rank slot, or wants a tier/rank recommendation for a zone over a date range.
---

# Lincx — Zone tier analysis

You run the platform's tier analysis engine for a zone and write the narrative on top of it.

**The division of labour is the whole point of this skill.** The Work API computes every
number — tier assignments, ranks, scores, risk flags — deterministically. You never
compute or revise any of them. You explain them. Read
`references/tiering-rules.md` before writing a single line of output; it is the set of
constraints the numbers were produced under, and violating them produces confident
nonsense.

## Flow

1. **Resolve inputs.** `zoneId` (6 lowercase alphanumerics), `dateStart`, `dateEnd`
   (`YYYY-MM-DD`), and optionally a timezone CODE (`UTC`, `EST`, `PDT` — not an IANA
   name; `UTC` is the default). **If the user did not give a date range, ask. Never
   default one.** A tier recommendation is only as good as its window, and a window you
   invented is a recommendation the user cannot audit.

   Two weeks or more is where the engine's coverage gate (`daysAtRank >= 7`) and
   partial-window rule (`datasetSpan >= 14`) start marking results `CONFIRMED` rather
   than `DIRECTIONAL`. Under 14 days, say so in the footer.

2. **Pick the analysis type:**

   | User is asking | `analysisType` |
   |---|---|
   | "which creatives are my best/worst", "how should I tier this zone", "tier recommendation" | `offerTiering` |
   | "which offer should sit at rank 1/2/3", "how should I order the slots", "rank allocation" | `rankedOfferOptimization` |

   If genuinely ambiguous, ask — do not run both.

3. **Queue it:**

   `create_analysis({ zoneId, dateStart, dateEnd, analysisType, timezone })`

   Leave `noLLM` alone. It defaults to `true`, which is what makes this skill the
   analyst instead of a second one on the server.

   Note the returned `_id`. If the response carries a `note` about a network mismatch,
   surface it — the job exists but `list_analyses` will not show it.

4. **Poll, bounded.** Call `get_analysis({ id })` until `status` is `succeeded` or
   `failed`. **Poll at most 10 times.** If it is still `queued`/`running` after that,
   stop and hand the user the `analysisId` with "still running — ask me to check
   `get_analysis` on this id in a minute." Do not loop indefinitely, and do not report
   on a `queued`/`running` document: it has no `input` and no `output` at all.

5. **Parse.** The tool returns a one-line header, a blank line, then compact JSON.
   Parse everything after the first blank line.

6. **Write the report** per `references/output-template.md`.

## What the payload contains

`output.json` — the verdict:
- `structural_context` — zone, date range, `dataset_confidence`, `overall_zone_health`, `rpzl_trend_summary`
- `tier_grouping` — `recommended_tier_count`, the active tiers
- `tier_tables` — `TIER_1` / `TIER_2A` / `TIER_2B` / `TIER_3`, each row `{ rank, adGroupId, adId, creativeId, localTier, ctr, cpm, impressions, revenue, days_at_rank }`
- `risk_flags` — `RPZL_THIN_TIER1`, `DATASET_LOW_CONFIDENCE`, `RPZL_CONCENTRATION`, `RANK_TIER_MISMATCH`

`input.tieringContext` — the scoring detail behind the verdict: per-creative `tierScore`,
`revenueShare`, `isStable`, slot metrics, `localTiers` + `localTierDiagnostics`,
`rankDistribution`, `datasetConfidence`.

For `rankedOfferOptimization` the shape differs: `output.json` carries `rank_allocation`
(one row per slot with `status`, `tier`, `creative`), `offer_ranking_metrics`,
`unassigned`, `non_monetizing_diagnostics`, and a `tier_grouping` whose tiers map to the
config keys `premium` / `standard` / `starter` plus an implicit default. Render slot-by-slot
rather than tier-by-tier, and quote the `group_key` — it drops straight into zone config.

### The empty fields are empty on purpose

On a `noLLM` run — the default — `output.json` ships with:

- `tier_grouping.tier_rationale`: `""`
- every `tier_tables` row's `justification`: `{}` and `confidence`: `""`
- `improvement_guidance.{creative_updates,funnel_validation,testing_recommendations}`: `[]`
- `next_actions`: `[]`

**These are not missing data and you must never report them as such.** They are the
slots you fill. Writing them is your job in this skill.

## Guardrails

- Never pass `networkId` — session-scoped upstream.
- Never re-cluster, re-rank, or "correct" a tier assignment from the raw metrics. If a
  row looks misfiled, that is a finding to report (usually a `RANK_TIER_MISMATCH` flag),
  not a number to change.
- If the response carries an `omitted` array, some input sections were shed for size;
  say so in the footer. If it carries `complete: false`, only the verdict survived —
  suggest a shorter date range for the input breakdown.
- On `"Error: Not authenticated…"` surface it and ask the user to run `auth_login`; do
  not retry, do not run it for them.
- On a **403 / Forbidden** from `create_analysis`: analysis access is gated by a
  separate email allowlist upstream, independent of network permissions. Say that
  plainly rather than sending the user to check their network.
- On `status: "failed"`, report `error.name` and `error.message` verbatim. Common ones:
  `NotFoundError` (no event data for that zone/range), `ValidationError` (data quality
  gate), `TokenLimitExceededError` (only on non-`noLLM` runs).
