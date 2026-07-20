---
name: zone-targeted
description: Use when the user asks which ad groups are directly targeted to a Lincx zone, or whether a zone's targeted ad groups are live/off — the exhaustive zone-targeting inventory with an enabled-state rollup. Backs the /zone-targeted command.
---

# Lincx — Zone targeting inventory

Answer: "For zone Z, list every ad group **directly targeted** to it, and for each
whether it is **fully live** (campaign + ad group + ad all enabled with a viable
creative attached) or **where it is off**." Exhaustive.

## Inputs
- `zoneId` — required (the command resolves it, remembering the last one).
- `mode` — `all` (default) | `live` (only fully-live) | `off` (only not-fully-live).

## Flow

1. Call **`get_zone_targeting_inventory({ zoneId, mode })`**. It does the whole audit
   server-side and returns `{ zone, summary, groups[], conflicting[], scan }`.
   Each `groups[]` row carries `campaign_on`, `adgroup_on`, `has_live_viable_ad`,
   `fully_live`, `off_reason`, `archived` (plus `has_enabled_ad` / `creative_resolves`
   diagnostics). **Do NOT scan ad groups yourself** — the tool is exhaustive; the
   old client-side `list_ad_groups` scan is gone.
2. Render a markdown table from `groups`: one row per ad group with a ✅/❌ per level
   (campaign / ad group / live+viable ad) and the `off_reason` when not fully live.
   Head it with the zone name / CAG / template and the summary line
   (`N targeted · X live · Y off · Z archived · C conflicting`).
   - If `summary.conflicting > 0`, list the `conflicting` groups below the table
     (they target AND except the zone — excluded from targeting).
   - If `groupsTruncated` is present, say so — do not imply the list is complete.

## Guardrails
- Never pass `networkId` — it is session-scoped upstream.
- On `"Error: Not authenticated…"` surface it and ask the user to run `auth_login`;
  do not retry. On `"Error: Resource not found…"` the zone ID is wrong — do not
  invent one. On `"Error: Forbidden…"` check the active network and offer to switch.

## Out of scope
"Free radicals" — ad groups targeting no zone that still render via the zone's shared
CAG. Eligibility, not direct targeting; a later `mode` on the composite.
