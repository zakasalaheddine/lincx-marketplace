# lincx-reports

Manager-friendly reports over the Lincx MCP. Read-only. Three reports:

- **Campaign performance** — spend, impressions, clicks, conversions for one or many campaigns over a date range.
- **Revenue summary** — revenue, fill rate, RPM by advertiser / network / site for a period.
- **Creative anomalies** — top/bottom creatives, zones, sites, templates, plus DoD/WoW drops with volume floor.

A router skill (`lincx-reports`) detects the intent and loads the matching sub-skill.

## Install

```
/plugin marketplace add zakasalaheddine/lincx-marketplace
/plugin install lincx-reports@lincx-marketplace
/reload-plugins
```

The Lincx MCP server must be configured in your Claude session — see [`mcp/README.md`](../../../mcp/README.md) for the OAuth flow.

## Output contract

Every response is four parts: a 1-sentence headline, a 2–4-sentence narrative, a markdown table (≤ 30 rows), and a footer naming the dimension set, range, resolution, and active network. The skills never default a date range — ambiguity always prompts a question.

## Compatible MCP versions

Tested against `lincx-mcp-server` `>=1.0.0`. The static-check suite verifies all referenced MCP tool names exist in `tests/fixtures/mcp-tools.json` (regenerated via `npm run sync-mcp-tools`).

## Tests

```
npm test
```

Runs `node --test` over `tests/*.test.mjs` plus a manifest sanity check.
