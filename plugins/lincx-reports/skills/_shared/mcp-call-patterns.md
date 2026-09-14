# MCP call patterns — what works, what doesn't

## `report_query` parameters

Run the dimension check in `_shared/dimension-discovery.md` first — every `groupBy` / `filter` key, and `hour` when `timezone` is set, must be a dimension of the chosen set.

The tool takes exactly these (the schema is strict — anything else is rejected):

- `dimensionSetId` — the checked set.
- `startDate`, `endDate` — required, `YYYY-MM-DD`.
- `groupBy: string[]` — dimensions to roll up by, e.g. `["zone"]`, `["date", "advertiser"]`. Omit for one grand total. Sums are computed server-side.
- `filter: { <dimension>: <value> }` — scope to one entity, e.g. `{ campaign: "Spring Promo" }`. Matches the value the dimension emits (usually the name), case-insensitively. Use this instead of filtering rows yourself.
- `timezone` — IANA name (`America/Denver`). Buckets days in local time. Requires `hour` in the set. Omit for UTC.
- `raw: true` — unaggregated rows; large, only when per-row detail is needed.
- `testMode` — never `true` in production reports.

There is no `resolution` or `dimensions` parameter. Granularity comes from `groupBy`: add `date` for daily rows, `hour` for hourly. There is no `week` or `month` — query with `date` and aggregate in your response.

The response carries `total`, `groups` (sorted by loads/revenue), `rowsScanned`, and `groupsTruncated` when groups were capped to fit.

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
- `"Error: dimension set <id> is missing [<dims>]…"` or `"…returned daily rows with no hour…"` — the chosen report can't answer this. Go back to Step 3 of `_shared/dimension-discovery.md` and suggest reports that carry those dimensions. Do not retry, and do not drop `timezone` or the breakdown without asking.

## Truncation detection

Responses include `"[Truncated. Use pagination parameters to see more.]"` (or with a total count) when long, and `report_query` sets `groupsTruncated` when it kept only the top groups. If you see either, do not synthesize numbers from the cut-off body. Tell the user the response was truncated and suggest narrowing the range, adding a `filter`, or a coarser `groupBy`.

## Tool-call budget per turn

Aim for ≤ 5 tool calls per report:

- 1 entity `list_*` (or zero if the user gave an ID)
- 1 `list_dimension_sets` with `fields: ["dimensions"]`
- 0–1 `get_dimension_set` (only if the catalog didn't include dimensions)
- 1–2 `report_query` (two only for anomaly mode)

Calling `list_dimension_sets` twice in one turn is a bug — cache the catalog mentally.
