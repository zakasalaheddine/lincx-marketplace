---
name: lincx-reports
description: Use when the user asks for Lincx reports — campaign performance, revenue, fill rate, RPM, creative or placement winners, drops, or anomalies. Routes to the matching sub-skill.
---

# Lincx Reports — router

You handle Lincx reporting requests by dispatching to the right sub-skill. Three reports are supported.

## Decision table

| User intent | Sub-skill |
|---|---|
| "How did campaign X perform?", "show me campaign Y last month", spend / clicks / conversions on a named campaign | `lincx-campaign-performance` |
| "Revenue by advertiser / network / site", fill rate, RPM totals for a period | `lincx-revenue-summary` |
| Top / bottom creatives / zones / sites; "what dropped this week"; week-over-week or day-over-day comparisons | `lincx-creative-anomalies` |

If the request blends two reports ("revenue and top creatives this week"), run them sequentially as two separate reports — do not merge.

## Hard rule — date range first

If the user did not give a date range, ask before doing anything. Do not start tool calls. Apply `_shared/date-range.md`.

## Auth and network preconditions

If any tool returns `"Error: Not authenticated"`, stop and ask the user to run `auth_login` (you can mention it; do not run it for them — it opens a browser flow that requires their credentials).

If the active network is wrong or missing, surface `network_list` results and ask which network to switch to with `network_switch`.

## What you never do

- Default a date range.
- Pick a network for the user.
- Combine data across networks (each MCP call is scoped to the active network).
- Speculate on causes when the data does not show them.
