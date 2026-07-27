# lincx-analysis

Zone tier analysis over the Lincx MCP.

Ask "how should zone `abc123` be tiered for June?" and get a tier structure, per-tier
creative tables, risk flags, and a prioritized action list — with every number computed
by the platform and every sentence written by Claude.

## The split

The Lincx platform already runs a deterministic tiering engine: aggregation,
reliability-weighted CPM, waterfall rank collapse, percentile tier banding. It also has
a server-side Gemini pass that writes narrative on top — but that pass can't change a
single number, because the engine overwrites every metric the model emits.

So this plugin skips it. `create_analysis` defaults to `noLLM: true`, the engine result
comes back with the narrative fields empty, and Claude fills them in using the grounding
rules in `skills/lincx-zone-tiering/references/tiering-rules.md`.

What that buys:

- **No second LLM bill.** One analysis, one model — the one you're already talking to.
- **The prompt is a markdown file.** Tiering rules change; edit the reference, reload the
  plugin. No server deploy.
- **The MCP stays dumb.** Three thin tools, no prompt logic, usable by any client.

## Skill

| Skill | Covers |
|---|---|
| `lincx-zone-tiering` | Both analysis types — `offerTiering` (which creatives belong in which tier) and `rankedOfferOptimization` (which offer belongs in which rank slot). |

## Command

```
/zone-tiering abc123 2026-06-01 2026-06-30
/zone-tiering abc123 2026-06-01 2026-06-30 ranked
```

Arguments are optional and order-independent — a 6-character token is the zone, ISO
dates are the range, `tiering`/`ranked` picks the type. Anything missing gets asked for.
The date range is never defaulted.

## Install

```
/plugin marketplace add zakasalaheddine/lincx-marketplace
/plugin install lincx-analysis@lincx-marketplace
/reload-plugins
```

## Requirements

- The **Lincx MCP** connected to your session, at a version that ships
  `create_analysis` / `get_analysis` / `list_analyses`. Run `/mcp` to confirm.
- **Analysis access.** These endpoints are gated by an email allowlist upstream
  (`server/analysis-allowlist.js` in lincx-core), separate from network permissions. A
  403 means you're not on it — ask the platform team, not your network admin.

## How it runs

1. `create_analysis` queues a job and returns immediately with an id.
2. The skill polls `get_analysis` — bounded at 10 attempts, then it hands you the id
   rather than looping.
3. On `succeeded`, it parses the payload and writes the report per
   `references/output-template.md`.

Analyses are asynchronous because the underlying ClickHouse query and pipeline take
real time. A wide zone over a long window is the slow case; if polling times out, the
job is still running and `get_analysis` on that id will have it later.

## Development

```
npm test                 # lint + unit tests
npm run sync-mcp-tools   # regenerate tests/fixtures/mcp-tools.json from ../../../mcp
```

`tests/tool-references.test.mjs` fails the build if a skill references an MCP tool that
doesn't exist in the snapshot — which is what keeps the docs honest when the MCP moves.
