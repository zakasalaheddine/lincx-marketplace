# Deterministic Template Preview Design

**Status:** Approved (awaiting spec review)
**Date:** 2026-05-08
**Owner:** templates-editor-plugin + lincx-mcp

## Problem

The templates-editor-plugin preview today renders against synthesized mock ads built from the CAG schema. The output is structurally correct but visually misleading: every field gets a placeholder string ("Sample headline 1"), so the user can't see how their template behaves with real copy, real lengths, or real image URLs. Worse, when the template uses no Mustache tokens (because the author hasn't tokenized yet), nothing in the page changes between renders and the user is left wondering whether the renderer ran at all.

We want the default preview path to:

1. Pull the template's HTML and CSS.
2. Pull the CAG.
3. Find the zone(s) that serve this template.
4. Pull real ads from the best-matching zone.
5. Render with those ads.

Synthesis from CAG remains the fallback when no zone is bound or all zones are empty.

## Decisions Locked In Brainstorming

| Decision | Choice |
|---|---|
| When auto-resolve fires | Once at session start (`/lincx-template-edit`), manual override only afterward |
| Fallback when no zone or zone empty | Synthesize 2 ads from CAG (today's behavior), with warnings surfaced |
| Multi-zone tiebreaker | Highest ad count wins; on tie, API order |
| Implementation locus | Single MCP tool does the work; thin helper script in plugin handles validation + session-state writeback |

## Architecture

### New MCP tool: `get_template_preview_bundle`

Lives in `mcp/src/tools/templateTools.ts`. Read-only, idempotent. Returns one envelope with everything needed for a local preview.

**Input:** `{ templateId: string, version?: number }`

**Server logic:**

1. `GET /api/templates/{id}` (or `/versions/{n}` if version given) → `html`, `css`, `creativeAssetGroupId`.
2. `GET /api/creative-asset-groups/{cagId}` → `cagSchema`. Error if missing.
3. Resolve zones bound to this template via the work API. Concrete endpoint TBD against the work API surface — first preference is `GET /api/templates/{id}/zones`; if absent, the same path `get_zone_ads` already uses to read template binding will be reused/extended. The implementation plan must confirm the endpoint before writing the tool.
4. For each candidate zone, count ads (`/api/zones/{id}/ads`, `length`). Pick max; ties broken by the order zones come back from the work API.
5. If at least one ad is returned by the winner, that's `mockAds`, `source:"zone"`, `chosenZoneId` set. Otherwise call the existing `generateMockAds(cagData, 2)` helper, set `source:"synthesized"`, `chosenZoneId:null`, append a warning explaining why (no zones / all zones empty).

**Response shape:**

```json
{
  "templateId": "tpl_…",
  "version": 3,
  "html": "...",
  "css": "...",
  "creativeAssetGroupId": "cag_…",
  "cagSchema": { "fields": [...] },
  "chosenZoneId": "zn_…" | null,
  "mockAds": [ { ... }, { ... } ],
  "source": "zone" | "synthesized",
  "warnings": ["..."]
}
```

`render_template` (the existing tool) is left alone. The two are siblings: `render_template` is a one-shot inspector, `get_template_preview_bundle` is the entry point for an editing session.

### Plugin side

The skill calls `get_template_preview_bundle` once in Flow A, then hands the bundle to a new pure helper.

**`scripts/resolve-zone-and-ads.mjs`** (new, pure):

- Inputs: bundle JSON, an entry id, the resolved html/css paths.
- Side effects: writes `bundle.html` and `bundle.css` to disk at the chosen paths.
- Output: a session-state patch object that the skill merges into `.lincx-session.json`.
- Validates `bundle.mockAds` against `bundle.cagSchema` using `validateAdsShape` (already exported from `preview-render.mjs`). On validation failure, replaces with `synthesizeMockAds(cagSchema, 2)` and tags the patch `mockAdsSource.kind:"synthesized-fallback"` with an added warning.
- Exposes a CLI mode (`node scripts/resolve-zone-and-ads.mjs <bundleJsonPath> <entryId>`) so the skill can invoke it via Bash and read back JSON via stdout.

**`scripts/session-state.mjs`** (modified): the `mockAdsSource.kind` enum gains two values:

| kind | Meaning |
|---|---|
| `"zone-resolved"` | Bundle returned `source:"zone"`; ads came from the auto-picked zone. |
| `"zone"` | User ran `/lincx-template-load-ads <zoneId>` manually. (existing) |
| `"synthesized"` | Bundle returned `source:"synthesized"` (no zone bound or all empty). (existing) |
| `"synthesized-fallback"` | Bundle returned ads but they failed CAG validation in the helper. |

`mockAdsSource` also stores `warnings: string[]` so the skill can surface them once when the session starts.

**Skill: `editing-lincx-templates/SKILL.md`** — Flow A rewritten:

1. `auth_status`.
2. Ask for `htmlPath` and `cssPath`.
3. `get_template_preview_bundle(templateId)`. Surface any error inline; do not mutate session state on error.
4. Persist the bundle to `./.lincx-session.bundle.json` (gitignored), then call `node ${CLAUDE_PLUGIN_ROOT}/scripts/resolve-zone-and-ads.mjs ./.lincx-session.bundle.json <entryId>`.
5. The helper writes html/css and prints a session-state patch on stdout. Skill merges via existing `upsertEntry`. Sets `dirty:false`, `previewOpened:false`.
6. Print the bundle's `warnings` to the user (one-shot, on session start).
7. Dispatch `node ${CLAUDE_PLUGIN_ROOT}/scripts/preview-render.mjs <entryId>`. Browser opens.
8. From here, every Edit/Write triggers the existing PostToolUse hook → re-renders against cached `mockAds`. No new network calls.

The two old MCP calls in Flow A (`get_template`, `get_creative_asset_group`) are removed — the bundle subsumes them.

**Flow B (`/lincx-template-new`)** — unchanged. No `templateId` exists yet, so we stay on synthesized. Once a draft is saved and earns an id, the user can rerun `/lincx-template-edit` to upgrade.

**`/lincx-template-load-ads <zoneId>`** — unchanged. Manual override; sets `mockAdsSource.kind:"zone"` and bypasses the bundle.

**`/lincx-template-refresh-schema`** — extended: re-calls `get_template_preview_bundle` for entries whose `mockAdsSource.kind` is `"zone-resolved"` or `"synthesized-fallback"`. Entries with `kind:"zone"` (manual override) are left alone; the user picked that zone explicitly.

**Renderer (`preview-render.mjs`)** — untouched. It already reads `mockAds` from session state. The fix is upstream of it.

## Data Flow

### Session start (`/lincx-template-edit tpl_x`)

```
user → skill → MCP get_template_preview_bundle(tpl_x)
                  ↳ work API: GET /templates/tpl_x
                  ↳ work API: GET /cag/cag_y
                  ↳ work API: list zones for tpl_x
                  ↳ work API: count ads per zone
                  ↳ pick winner OR synthesize
              → bundle JSON
       skill writes ./.lincx-session.bundle.json
       skill runs resolve-zone-and-ads.mjs <bundle> <entryId>
              ↳ writes html, css to disk
              ↳ validates mockAds vs cagSchema (helper-side guard)
              ↳ prints session-state patch
       skill merges patch into .lincx-session.json
       skill prints bundle.warnings
       skill runs preview-render.mjs <entryId> → browser opens
```

### Edit loop

User edits HTML/CSS → PostToolUse hook → `preview-render.mjs <entryId>` → uses cached `mockAds`. No network.

### Manual override

`/lincx-template-load-ads <zoneId>` → `get_zone_ads` → replaces `mockAds`, sets `kind:"zone"` → renderer.

### Refresh

`/lincx-template-refresh-schema` → re-calls bundle for `zone-resolved` / `synthesized-fallback` entries → updates `cagSchema` and `mockAds` together → renderer.

## Failure Modes

| Failure | Behavior |
|---|---|
| Template has no CAG | MCP tool returns error; skill surfaces inline; no session-state mutation. |
| Template has 0 zones | Bundle returns `source:"synthesized"`, `chosenZoneId:null`, warnings include "no zones bound to this template". Render proceeds. |
| All zones empty | Same as above with warning "zones present but contain no ads". |
| Best zone's ads fail CAG validation in the helper | Helper synthesizes from CAG, sets `kind:"synthesized-fallback"`, adds warning naming the offending field(s). |
| MCP tool errors (network, auth, work API 5xx) | Skill surfaces error; no session-state mutation; user can retry or use `/lincx-template-load-ads` manually. |
| Helper called with bundle missing required fields | Helper exits non-zero, prints diagnostic; skill surfaces inline. |

## Testing

### MCP tool (`mcp/src/tests/templateTools.test.ts`)

Mock `workApiRequest`. Verify:

1. **Happy path** — 2 zones, zone B has 5 ads, zone A has 2 → bundle returns B's ads, `chosenZoneId:"B"`, `source:"zone"`.
2. **Tie** — equal ad counts → first by API order; deterministic.
3. **No zones** → `source:"synthesized"`, 2 ads conforming to CAG, `chosenZoneId:null`, warnings non-empty.
4. **Zones all empty** → as above with the empty-zone warning.
5. **Template missing CAG** → tool returns error response.
6. **Template fetch fails** → error bubbles cleanly.
7. **Zone resolution fails but template + CAG OK** → falls through to synthesized + warning.

### Helper (`plugins/templates-editor-plugin/tests/resolve-zone-and-ads.test.mjs`)

Fixture bundles under `tests/fixtures/preview-bundles/`. Pure-function tests:

1. Bundle with `source:"zone"` → writes html/css to entry paths; patch has `mockAdsSource.kind:"zone-resolved"`, `mockAds` from bundle.
2. Bundle with `source:"synthesized"` → patch has `kind:"synthesized"` plus warnings.
3. Bundle whose `mockAds` fail `validateAdsShape` → helper synthesizes; patch has `kind:"synthesized-fallback"` + a warning naming the missing field.
4. Path traversal guard — refuses to write outside the user's project root (htmlPath/cssPath sanity check).

### Skill flow (golden transcript)

`plugins/templates-editor-plugin/tests/transcripts/flow-a-bundle.md` showing the new conversation: `/lincx-template-edit tpl_x` → bundle call → helper invocation → preview opens. Style mirrors the existing transcript.

### Out of scope

- E2E hitting the real work API.
- Performance / fan-out tests on zone counts (bounded in practice).
- `preview-render.mjs` tests (unchanged contract).

## Open Items For Implementation

These are the things that must be confirmed during implementation, not now:

1. The exact work-API endpoint that lists zones for a template. The implementation plan starts by probing `lincx-core` / the work API and confirming the URL before writing the tool.
2. Whether `mcp__claude_ai_Lincx__save_template_version` is the channel by which the skill should also push back changes — orthogonal to this design, but the implementation plan should not regress that.
3. Whether the bundle should include `version` so refresh-schema can detect if the template was bumped server-side; default yes, but verify the work API exposes it consistently.

## Non-Goals

- Replacing `render_template`. It stays as-is for one-off inspections.
- Building from scratch (Flow B) auto-resolving a zone — there's no template id yet.
- Letting the user pick among multiple zones interactively. The brainstorm picked "highest ad count" silently. A future enhancement could add an interactive `/lincx-template-pick-zone` command.
- Polling for new ads while the session is open. Manual refresh only.
