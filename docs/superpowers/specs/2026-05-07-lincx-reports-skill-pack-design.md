# Lincx Reports — Skill Pack Design

**Date:** 2026-05-07
**Status:** Draft for review
**Owner:** Salaheddine Zaka

## Goal

Give managers (engineering, product, account/campaign, customer success) a small set of Claude skills that turn the existing `lincx-mcp-server` reporting primitives into purposeful, manager-friendly reports. The skills carry no credentials and add no new API capability; they orchestrate the MCP tools that already exist.

## Non-goals

- New MCP tools, endpoints, or auth changes.
- Charting, image rendering, or PDF export.
- Pacing / budget-burn projections (deferred — could be a future skill).
- Recommendations or "next steps" output unless the user asks for them.
- Defaulting time ranges on the user's behalf.

## Constraints

- Read-only by default. Any future write capability must be opt-in per skill.
- The MCP server is the trust boundary: it owns auth, network scoping, and the Lincx JWT. Skills never see credentials.
- `report_query` does not accept a structured filter object. Entity scoping happens through the dimension set's available `dimensions` plus client-side narrowing of the returned rows.
- Resolution is `day` or `hour` only. Multi-week or month comparisons are constructed from daily rows in the skill, not requested as a coarser resolution.
- Output must render correctly in both Claude Code and Claude Desktop — no charts, no HTML.

## Architecture

The skills ship as a Claude Code plugin in `lincx-marketplace`, alongside the existing `templates-editor-plugin`, and are installed via the marketplace's standard install flow:

```
lincx-marketplace/plugins/lincx-reports/
├── .claude-plugin/
│   └── plugin.json
├── README.md
└── skills/
    ├── lincx-reports/                   # router (top-level)
    │   └── SKILL.md
    ├── lincx-campaign-performance/
    │   ├── SKILL.md
    │   └── references/
    │       └── dimension-cheatsheet.md
    ├── lincx-revenue-summary/
    │   └── SKILL.md
    ├── lincx-creative-anomalies/
    │   └── SKILL.md
    └── _shared/
        ├── date-range.md
        ├── output-template.md
        ├── dimension-discovery.md
        └── mcp-call-patterns.md
```

The plugin is registered in `lincx-marketplace/.claude-plugin/marketplace.json` so end users can install via `/plugin install lincx-reports@lincx-marketplace`.

## Components

### Router: `lincx-reports/SKILL.md`

Trigger description covers the family: performance, revenue, fill, RPM, creative, placement, winners, drops, anomalies — combined with Lincx, advertiser, campaign, network, zone, site. Body is short:

- Decision table: intent → which sub-skill to load.
- One hard rule: if the user has not specified a date range, ask before doing anything else (do not start tool calls).
- Reminds Claude that on `"Error: Not authenticated"` from any tool, ask the user to run `auth_login` and stop. On no active network, surface `network_list` results and ask which to switch to.

### `lincx-campaign-performance/SKILL.md`

Owns "how did campaign(s) X perform from A to B."

Flow:

1. Resolve date range via `_shared/date-range.md`. Never default.
2. Resolve campaign(s): `list_campaigns({ limit: 100 })` paginated until a name match is found. If multiple match, list candidates with IDs and ask. If none match, surface the closest names and ask.
3. Pick a dimension set per `_shared/dimension-discovery.md`. Prefer one whose dimensions include `campaign_id` (or the network's equivalent — discovered, not assumed).
4. `report_query({ dimensionSetId, startDate, endDate, resolution: "day", dimensions: ["date","campaign_id"] })`.
5. Filter the returned rows client-side to the resolved campaign ID(s).
6. Render via `_shared/output-template.md` with column order `date | spend | impressions | clicks | conversions | ctr | ecpm`.

`references/dimension-cheatsheet.md` records the team's canonical dimension-set names for campaign perf and the metrics that matter, but the skill always verifies via `get_dimension_set` rather than trusting the cheatsheet.

### `lincx-revenue-summary/SKILL.md`

Owns "revenue / fill / RPM by advertiser / network / site for period P."

Flow mirrors campaign-performance with two differences:

- Entity resolution branches on advertiser vs network vs site (`list_advertisers`, `list_sites`, plus `network_list` for active context). If the user named no entity, the skill asks before querying — does not pick one.
- Default breakdown is the named entity itself (single-axis), not a date series. The narrative still gives a totals row; column order is `<entity> | revenue | impressions | fill_rate | rpm` plus a totals row at the bottom.

When the user names multiple entity types in one ask ("revenue by advertiser and site"), the skill runs two separate `report_query` calls and emits two tables, not a Cartesian breakdown.

### `lincx-creative-anomalies/SKILL.md`

Owns "what's working / broken among creatives, zones, sites, templates."

Two modes, branched early from the user's wording:

- **Winners / losers**: one date range; one `report_query` with the chosen entity dimension; sort client-side; render top N + bottom N (default N = 10, asks if user wants different).
- **Anomaly**: needs current and prior ranges. The skill asks for the comparison window if not given — never assumes "vs prior period of equal length." Two `report_query` calls; join on entity key client-side; compute `delta_pct` and require `current_volume ≥ floor` (auto-derived from the data: ~10% of the median row volume, asked-to-confirm if it would drop everything). Threshold default is `±25%`; if no rows clear it, the skill says so and asks whether to lower it.

For single-zone questions, the skill prefers `get_zone_report` directly — cheaper and bypasses dimension-set selection.

### Shared helpers (loaded only when a sub-skill cites them)

- **`_shared/date-range.md`** — explicit-date parser. Knows ISO dates, "March 1–15", "yesterday", "last week" only when grounded against today's date. If anything is ambiguous (year, time zone, inclusive/exclusive end date), asks the user. Forbids inventing ranges.
- **`_shared/dimension-discovery.md`** — algorithm: call `list_dimension_sets`, inspect candidates with `get_dimension_set`, prefer ones whose dimensions cover the requested breakdown, use `get_event_stats_keys` to verify the network actually emits the keys you plan to filter on. Falls back to asking the user with the candidate list. Caches the catalog for one turn (do not call `list_dimension_sets` twice).
- **`_shared/mcp-call-patterns.md`** — canonical `report_query` shape; the "no structured filters; breakdown + client-side filter" pattern with examples; resolution rules (`day` vs `hour` only); pagination for `list_*` tools.
- **`_shared/output-template.md`** — the strict output contract (see below).

### Plugin manifest (`.claude-plugin/plugin.json`)

Declares plugin name, version, description, and pointers to the skills directory (auto-discovery). Includes a `requires` note recommending the `lincx` MCP server be configured. The plugin's `README.md` points at `mcp/README.md` for the auth flow.

A new entry is added to `lincx-marketplace/.claude-plugin/marketplace.json`:

```jsonc
{
  "name": "lincx-reports",
  "source": "./plugins/lincx-reports",
  "description": "Manager-friendly reports — campaign performance, revenue, creative anomalies — over the Lincx MCP"
}
```

## Data flow

Happy path — campaign performance:

```
User: "How did the Acme campaign do March 1–15?"
  │
Router (lincx-reports) matches → loads lincx-campaign-performance
  │
Sub-skill steps Claude through:
  1. date-range.md parses "March 1–15" → asks user "March 2026 or March 2025?"
     before committing to a range (year is always confirmed when not given)
  2. list_campaigns({ limit: 100 }) → resolves "Acme" to campaign ID
                                      (pagination + ask if >1 match)
  3. list_dimension_sets() → candidates → get_dimension_set(id) on the
     best match → confirms `campaign_id` is a dimension
  4. report_query({
       dimensionSetId, startDate, endDate,
       resolution: "day",
       dimensions: ["date", "campaign_id"]
     })
  5. Filter rows client-side to the resolved campaign ID
  6. output-template.md → narrative + table + footer
```

Revenue and creative-anomalies follow the same backbone with the variations noted in Components.

State and caching: none. Each invocation is stateless. The MCP server holds session/network. Skills do not persist anything between calls. Tool-call budget is ≤ 5 per turn in the common case (1 entity-list + 1 list_dimension_sets + 1 get_dimension_set + 1–2 report_query). The skill explicitly tells Claude not to call `list_dimension_sets` more than once per turn.

## Error, empty, and large-result handling

- **Auth / session errors** (`"Error: Not authenticated…"`, validation errors): surface plainly, ask user to run `auth_login` (and `network_list` → `network_switch` if no active network). Do not retry the same call.
- **No matching dimension set**: stop. List available sets and dimensions. Ask which to use.
- **Ambiguous entity name**: list all matches with IDs and ask. Paginate `list_*` tools and filter by name client-side rather than guessing.
- **Empty result set**: narrate "No data for `<range>` filtered to `<entity>` using dimension set `<name>`," then suggest one diagnostic (wider range, drop a filter, or `auth_status` / `network_list`).
- **Truncated MCP response** (the server runs `truncateIfNeeded`): detect via cut-off JSON; do not synthesize numbers from a partial body. Tell the user explicitly: "Response was truncated — narrow the date range or breakdown."
- **Large result that fits** (e.g., 720 hourly rows): cap the rendered table at 30 rows; collapse to daily aggregate or top-N + bottom-N as the sub-skill dictates; offer to show specific dates.
- **Anomaly with no rows clearing the threshold**: state plainly; offer to lower threshold or floor; do not silently lower them.
- **Suspicious zero rows** (known-active campaign returns nothing): suggest `get_event_stats_keys` and `auth_status`. Do not run automatically.
- **Network errors / 5xx**: surface verbatim, suggest one retry, then stop.

## Output template

Defined in `_shared/output-template.md`. Four parts in order:

1. **Headline (≤ 25 words, 1 sentence)** — leads with the most decision-relevant number for the report. Always names the entity and date range. No hedging adjectives.
2. **Narrative (2–4 sentences)** — explains the headline; cites the one row or driver that matters most; says "nothing notable" when that's true; never speculates on cause.
3. **Markdown table** — capped at 30 rows; column order fixed per report (in each sub-skill's `references/`); numbers right-aligned; currency `$` with 2 decimals; rates `12.3%`; counts with thousands separators; sort chronological for time series, descending by primary metric for ranks, descending by `|delta_pct|` for anomalies.
4. **Footer** — `Source: dimension set "<name>" (<id>) · range <YYYY-MM-DD> → <YYYY-MM-DD>  · resolution <day|hour> · network <active_network>`. Truncation appends a second line.

Forbidden: emoji; first person; "based on the data" filler; charts; unsolicited recommendations.

## Testing

Three layers:

1. **Static checks (lincx-marketplace CI)** — a small Node script (or vitest, matching the marketplace's existing tooling) walks every `SKILL.md` in the plugin and asserts: frontmatter has `name` and `description`; description is ≤ 200 chars and includes vocabulary from a known trigger list; every tool name referenced in a skill body exists in a checked-in snapshot of the MCP tool surface (`tests/fixtures/mcp-tools.json`, regenerated from `mcp/src/tools/*.ts` via a script); every `_shared/*.md` reference resolves. This is the highest-ROI test — it catches drift between skill prose and the actual MCP surface, even though the two repos ship independently.
2. **Golden transcript tests (manual, pre-release)** — `tests/golden/<report>.md` for each of the three reports: a representative prompt, the MCP tool calls Claude should make in order, and the expected output template shape (sections present, column names correct — not exact numbers). Reviewed by eye before each release. Doubles as documentation.
3. **Live smoke test (manual, ~10 min, pre-release)** — install the plugin from the marketplace, run the three canonical prompts against the real MCP in Claude Code; confirm the four output sections render; confirm the footer's source line matches the dimension set actually used.

Out of scope: asserting narrative wording (fights the model); number-format unit tests in isolation (covered by smoke); MCP tool tests (already covered in the server's suite).

## MCP tool sufficiency check

Mapped against the actual MCP surface in `mcp/src/tools/*.ts`. Each sub-skill is annotated with whether the current tools cover it, and what friction remains.

| Skill need | Tools used | Status | Notes |
|---|---|---|---|
| Resolve "the Acme campaign" → campaign_id | `list_campaigns` | ⚠ workable with friction | No name-search param. Skill must paginate (limit max 100) and filter by name client-side. Fast on small networks; expensive on large ones. |
| Resolve advertiser/site name → ID | `list_advertisers` / `list_sites` | ⚠ workable with friction | Same as above. |
| List dimension sets + inspect | `list_dimension_sets`, `get_dimension_set` | ✓ sufficient | Catalog is finite; one call to list, one per inspection. Skill caches the catalog for the turn. |
| Discover available filter keys | `get_event_stats_keys` | ✓ sufficient | 31-day window. Used to verify a dimension actually has values before querying. |
| Run a multi-dim report over a date range | `report_query` | ✓ sufficient | `resolution` is `day` or `hour` only. Filters happen via `dimensions` breakdown + client-side narrowing. |
| Single-zone timeseries | `get_zone_report` | ✓ sufficient | Avoids dimension-set selection entirely. Preferred path in `lincx-creative-anomalies` for single-zone questions. |
| Auth + active network context | `auth_login`, `auth_status`, `network_list`, `network_switch` | ✓ sufficient | Skills surface errors, never carry credentials. |
| Cross-network ("all my networks") | — | ✗ not supported | Each call is scoped to the active network. The skill explicitly tells the user this is a per-network report and asks them to switch if they want another network. |
| Truncated response detection | response suffix `[Truncated…]` | ✓ sufficient | Skill matches on that literal suffix (introduced by `truncateIfNeeded` in `services/workApi.ts`) and refuses to synthesize numbers. |

**Friction call-outs (recorded as future-MCP requests, not blockers for v1):**

1. **`list_*` tools have no name/search filter.** Paginating thousands of campaigns to find one by name is a real cost. v1 mitigates by asking the user to either provide the ID or scope by advertiser ("which advertiser owns this campaign?") to narrow the search; if neither is forthcoming, the skill warns it may take several calls. A future MCP enhancement (`?q=` substring filter on list endpoints) would remove this entirely.
2. **`report_query` response shape is dimension-set-defined.** The skill must read the keys returned from `get_dimension_set` and map them onto the response columns. We don't hardcode column names beyond the rendered output template. If a dimension set lacks an expected metric (e.g., a "revenue" dimension set without `fill_rate`), the skill renders the columns it has and notes the missing one in the narrative.
3. **No bulk parent lookup.** "Campaigns owned by Acme advertiser" requires either an N+1 walk via `get_campaign_parents`, or — preferred — running `report_query` with `dimensions: ["advertiser_id","campaign_id"]` and filtering on the advertiser ID client-side. v1 always uses the latter.
4. **No "this period vs prior period of same length" auto-derivation in the API.** The anomaly sub-skill builds the prior range itself in the skill body and runs two `report_query` calls.

## Example transcripts

These are illustrative — exact JSON payloads will vary by network. They establish the contract for each sub-skill's tool-call sequence and output shape.

### Example 1 — campaign performance

> **User:** How did the Acme Spring campaign do March 1–15?

```
Router (lincx-reports) selects → lincx-campaign-performance

1. _shared/date-range.md → year is unspecified
   Claude asks: "March 2026 or March 2025?"

> User: 2026

2. list_campaigns({ limit: 100, offset: 0 })
   → [{id:"cmp_4f12", name:"Acme Spring", advertiser_id:"adv_a1"}, …]
   Match found by case-insensitive substring. Single match → no follow-up question.

3. list_dimension_sets({ limit: 100, offset: 0 })
   → catalog includes "campaign_daily", "advertiser_daily", "zone_daily", …

4. get_dimension_set({ id:"campaign_daily" })
   → confirms dimensions include `date`, `campaign_id`;
     metrics include `spend, impressions, clicks, conversions`.

5. report_query({
     dimensionSetId:"campaign_daily",
     startDate:"2026-03-01",
     endDate:"2026-03-15",
     resolution:"day",
     dimensions:["date","campaign_id"]
   })
   → 14 rows for cmp_4f12 (others filtered out client-side).
```

> **AI response:**
>
> Acme Spring spent $24,318 with 412 conversions over March 1–15, 2026 — a 4.2% CTR on 1.21M impressions.
>
> Conversions concentrated on March 8 (74) and March 12 (61); spend was steady at ~$1.6K/day. CTR held within ±0.3% of the period average; no day stood out as a problem.
>
> | date       |   spend | impressions | clicks | conversions |   ctr |  ecpm |
> |------------|--------:|------------:|-------:|------------:|------:|------:|
> | 2026-03-01 |  $1,612 |      82,440 |  3,388 |          27 | 4.11% | $19.55 |
> | 2026-03-02 |  $1,587 |      80,910 |  3,341 |          24 | 4.13% | $19.61 |
> | …          |       … |           … |      … |           … |     … |      … |
> | 2026-03-15 |  $1,634 |      83,120 |  3,422 |          29 | 4.12% | $19.66 |
>
> Source: dimension set "campaign_daily" (`ds_camp_d`) · range 2026-03-01 → 2026-03-15 · resolution day · network svce6t

### Example 2 — revenue summary

> **User:** Give me revenue by advertiser for last week.

```
Router → lincx-revenue-summary

1. _shared/date-range.md → "last week" with no anchor.
   Claude asks: "Calendar week (Mon 2026-04-27 – Sun 2026-05-03)
                or rolling 7 days (2026-04-30 – 2026-05-06)?"

> User: rolling 7

2. list_dimension_sets / get_dimension_set
   → picks "advertiser_daily"; confirms `revenue, impressions, fill_rate, rpm`.

3. report_query({
     dimensionSetId:"advertiser_daily",
     startDate:"2026-04-30",
     endDate:"2026-05-06",
     resolution:"day",
     dimensions:["advertiser_id"]
   })
   → 18 rows (one per advertiser).
   Skill aggregates day-level rows to advertiser totals client-side.
```

> **AI response:**
>
> $147,930 total revenue across 18 advertisers from April 30 – May 6, 2026; fill rate held at 87.4%.
>
> Acme Brands led with $42,180 (28.5% of total) at 91.2% fill. The next four advertisers contributed roughly equal shares ($14K–$18K each); the long tail of 13 advertisers added $32K combined.
>
> | advertiser    |  revenue | impressions | fill_rate |    rpm |
> |---------------|---------:|------------:|----------:|-------:|
> | Acme Brands   |  $42,180 |   2,118,400 |     91.2% | $19.91 |
> | Northwind     |  $18,440 |   1,002,800 |     88.0% | $18.39 |
> | Globex        |  $16,210 |     911,500 |     86.7% | $17.79 |
> | …             |        … |           … |         … |      … |
> | **Total (18)**| **$147,930** | **8,206,300** | **87.4%** | **$18.03** |
>
> Source: dimension set "advertiser_daily" (`ds_adv_d`) · range 2026-04-30 → 2026-05-06 · resolution day · network svce6t

### Example 3 — creative anomalies (anomaly mode)

> **User:** Which zones dropped this week vs last week?

```
Router → lincx-creative-anomalies (anomaly mode)

1. _shared/date-range.md
   Claude asks: "Confirm: this week = 2026-05-04 → 2026-05-07
                 vs last week = 2026-04-27 → 2026-04-30 (4 days each)?
                 Or compare full prior week 2026-04-27 → 2026-05-03?"

> User: full prior week

   → current = 2026-05-01 → 2026-05-07,
     prior   = 2026-04-24 → 2026-04-30. Skill confirms range mismatch
     (7 days each) before proceeding.

2. list_dimension_sets / get_dimension_set
   → picks "zone_daily"; dimensions include `zone_id`; metrics
     `impressions, revenue, ctr`.

3. report_query (current week) and report_query (prior week)
   in two calls. Two rows-per-zone responses.

4. Skill joins on zone_id, computes delta_pct on revenue.
   Volume floor = 10% of median current revenue ≈ $84.
   Threshold ±25%. 6 rows clear both.
```

> **AI response:**
>
> 6 zones moved more than ±25% week-over-week with non-trivial volume; the biggest drop was zone "Homepage Top" at -41%.
>
> The drops cluster on three sites; the lifts are spread across the long tail. The single largest dollar-impact mover was "Homepage Top" (-$1,240). No data was missing for any zone in either range.
>
> | zone           | current  | prior    | delta_pct | delta_abs |
> |----------------|---------:|---------:|----------:|----------:|
> | Homepage Top   |  $1,790  |  $3,030  |    -40.9% |   -$1,240 |
> | Footer Banner  |    $312  |    $498  |    -37.3% |     -$186 |
> | Sidebar A      |    $702  |    $988  |    -28.9% |     -$286 |
> | Article Inline |  $1,640  |  $1,212  |    +35.3% |     +$428 |
> | Sticky Mobile  |    $890  |    $688  |    +29.4% |     +$202 |
> | Above Fold B   |    $402  |    $311  |    +29.3% |      +$91 |
>
> Source: dimension set "zone_daily" (`ds_zone_d`) · range 2026-05-01 → 2026-05-07 (vs 2026-04-24 → 2026-04-30) · resolution day · network svce6t

### Example 4 — failure case (auth not present)

> **User:** Revenue by site this week.

```
1. list_dimension_sets({}) → "Error: Not authenticated. Use 'auth_login' first."
   Skill stops. Does not retry.
```

> **AI response:**
>
> No data — your Lincx session isn't authenticated. Run `auth_login` (you'll get a browser prompt to sign in), then `network_list` and `network_switch` if you need to pick a network. Then re-ask the question.

---

## Cross-repo coordination

Because the skill pack lives in `lincx-marketplace` and references tool names defined in `mcp/src/tools/*.ts`:

- A `tests/fixtures/mcp-tools.json` snapshot in this plugin lists every MCP tool name + key parameter shape we rely on.
- A small `scripts/sync-mcp-tools.{sh,ts}` script regenerates that snapshot from a sibling checkout of `mcp/`, run manually whenever the MCP surface changes.
- The static-check test fails CI if a `SKILL.md` references a tool not in the snapshot, or if the snapshot is older than a configurable threshold.
- The plugin's `README.md` calls out the minimum compatible `lincx-mcp-server` version.

## Open questions / future work

- Pacing & delivery health is deferred but is the most-likely 4th sub-skill. Adding it should not require changes to the shared helpers.
- A `zone-load-trace` diagnostic skill (wrapping the existing `zone_load_trace` tool) is a natural extension for support engineers.
- Whether to publish the marketplace publicly or keep it private to the workspace is a release-time question (already open for the marketplace as a whole).

## Acceptance criteria

- All four `SKILL.md` files exist and parse cleanly.
- The static-check suite passes for the plugin in `lincx-marketplace` CI.
- The plugin is installable via `/plugin install lincx-reports@lincx-marketplace` once the marketplace is published.
- A new manager who has never seen the system can ask each of the three canonical prompts in Claude Desktop (with the `lincx` MCP configured) and receive a response matching the four-part output template.
- No skill ever produces a number without a footer that names the dimension set, range, resolution, and active network.
- No skill defaults a date range; ambiguity always prompts a question.
