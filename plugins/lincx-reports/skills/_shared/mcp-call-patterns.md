# MCP call patterns — what works, what doesn't

## `report_query` accepts no structured filters

The tool takes `dimensionSetId`, `startDate`, `endDate`, `resolution: "day"|"hour"`, `dimensions: string[]`, and `testMode`. There is no `filters` parameter. To "filter to campaign X":

1. Pick a dimension set whose `dimensions` include `campaign_id`.
2. Call `report_query` with `dimensions: ["date", "campaign_id"]`.
3. Filter the returned rows client-side to the campaign ID(s) you resolved.

Never pass `testMode: true` in production reports. Never guess a filter parameter that doesn't exist.

## Resolution is `day` or `hour` only

There is no `week` or `month`. Multi-week reports come from daily rows you sum yourself. If the user asks for "monthly", you query daily and aggregate in your response.

## Pagination on `list_*` tools

All `list_*` tools take `{ limit, offset }`, max `limit: 100`, default 20. They do **not** accept a search/name filter. To find an entity by name:

1. Page through with `limit: 100`.
2. Filter by case-insensitive substring on the entity's `name` field client-side.
3. Stop on first match if it's clearly unique; otherwise collect all matches and ask the user to disambiguate.

For very large networks, consider asking the user for the entity ID directly, or for a parent (e.g. "which advertiser owns this campaign?") to narrow the search.

## Error strings the MCP returns verbatim

- `"Error: Not authenticated. Use 'auth_login' first."` — surface, ask the user to run `auth_login`. Do not retry.
- `"Error: Unauthorized. Use 'auth_logout' then 'auth_login' to re-authenticate."` — same: surface and stop.
- `"Error: Forbidden — you don't have access to this resource on the active network."` — check active network with `network_list` and offer `network_switch`.
- `"Error: Resource not found. Double-check the ID."` — verify the ID; do not invent.
- `"Error: Rate limit hit. Wait a moment then retry."` — wait, retry once.
- `"Error: Request timed out."` — retry once with the same params.

## Truncation detection

Responses include `"[Truncated. Use pagination parameters to see more.]"` (or with a total count) when long. If you see this, do not synthesize numbers from the cut-off body. Tell the user the response was truncated and suggest narrowing the range or breakdown.

## Tool-call budget per turn

Aim for ≤ 5 tool calls per report:

- 1 entity `list_*` (or zero if the user gave an ID)
- 1 `list_dimension_sets`
- 1 `get_dimension_set`
- 1–2 `report_query` (two only for anomaly mode)

Calling `list_dimension_sets` twice in one turn is a bug — cache the catalog mentally.
