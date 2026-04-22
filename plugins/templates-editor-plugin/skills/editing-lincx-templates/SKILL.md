---
name: editing-lincx-templates
description: Build and adjust Lincx ad templates (HTML+CSS). Use when the user asks to create, modify, preview, or save a Lincx template, or when a slash command in the `/lincx-template-*` family is invoked.
---

# Editing Lincx Templates

You help users author and adjust Lincx ad creative templates (HTML + CSS) bound to a `creativeAssetGroup` (CAG) schema. You work with the `lincx-mcp` for reads (template, CAG, zone ads) and cache results into `./.lincx-session.json` so a local preview loop runs automatically on every edit.

## Consult-references rule (MANDATORY before authoring)

Before proposing any template HTML or CSS:

1. Read `${CLAUDE_PLUGIN_ROOT}/references/README.md`.
2. Read the most relevant files under `${CLAUDE_PLUGIN_ROOT}/references/patterns/`.
3. If the user's request is covered by a pattern, follow that pattern exactly.
4. Only deviate when the request isn't covered by any pattern, or is trivially simple (e.g. "change this color to red").
5. When deviating, state in one sentence which pattern the work is closest to and why you're not following it exactly.

If `references/patterns/` is empty (user hasn't populated it yet):
- **For trivially simple requests** (color, copy, padding, single-line tweaks): proceed, noting the absence.
- **For any non-trivial authoring** (from-scratch templates, layout changes, new elements): stop and ask the user to either supply at least one example pattern or explicitly authorize a one-off deviation. Do not improvise.

## Session state

Single source of truth: `./.lincx-session.json` in the user's current working directory. Shape:

```json
{
  "previewDisabled": false,
  "activeTemplates": [
    {
      "id": "<stable id, e.g. entry-1>",
      "templateId": "<string or null>",
      "creativeAssetGroupId": "<string>",
      "htmlPath": "<user-chosen path>",
      "cssPath": "<user-chosen path>",
      "previewPath": "<typically sibling preview.html>",
      "version": "<number or null>",
      "dirty": false,
      "cagSchema": { "fields": [ ... ] },
      "mockAdsSource": { "kind": "synthesized" | "zone", "zoneId": "..." },
      "mockAds": []
    }
  ]
}
```

Use `${CLAUDE_PLUGIN_ROOT}/scripts/session-state.mjs` (`readSessionState`, `writeSessionState`, `upsertEntry`, `removeEntry`, `findEntryByPath`) via a small inline `node --input-type=module -e ...` invocation. Do not hand-parse the file.

## Flows

### Flow A — Adjust an existing template (from `/lincx-template-edit <id>`)

1. `auth_status` — if unauthenticated, tell the user to run `auth_login` and stop.
2. Ask the user where to place the files (prompt for `htmlPath` and `cssPath` under their current project). Do not default silently.
3. `get_template(id)` → write `html` and `css` to the chosen paths.
4. `get_creative_asset_group(id=<creativeAssetGroupId from template>)` → cache as `cagSchema`.
5. Upsert entry into `.lincx-session.json` (set `dirty:false`, `version` from template, `previewOpened:false`).
6. Dispatch a first render: `node ${CLAUDE_PLUGIN_ROOT}/scripts/preview-render.mjs <entryId>`. The browser opens.
7. Converse with the user. When authoring edits, apply the consult-references rule first. Every Edit/Write triggers the hook, which re-renders preview silently. Mark `dirty:true` after any write.
8. On `/lincx-template-save` → Flow C.

### Flow B — Build from scratch (from `/lincx-template-new <name>`)

1. `auth_status`.
2. `list_creative_asset_groups` → ask the user to pick a CAG. Record `creativeAssetGroupId`.
3. Ask for `htmlPath` and `cssPath`. Create empty files at those paths.
4. `get_creative_asset_group(id=<chosen>)` → cache `cagSchema`.
5. Upsert entry with `templateId:null`.
6. Consult references per the mandatory rule, ask a few shaping questions (layout family, purpose, constraints), then author initial HTML/CSS. Mark `dirty:true`.
7. Same live-preview loop as Flow A; same save path.

### Flow C — Save (from `/lincx-template-save`)

1. Read `.lincx-session.json`.
2. For each entry with `dirty:true`:
   - Determine if `mcp__claude_ai_Lincx__save_template_version` is available in this session's tools.
   - If yes and `templateId != null`: import `saveAsync` from `${CLAUDE_PLUGIN_ROOT}/scripts/save-seam.mjs`; wrap the MCP call in a `mcpWrite` function you pass in:
     ```
     async function mcpWrite({ templateId, html, css }) {
       // Call the MCP tool with these params; return { version }.
     }
     ```
     Call `saveAsync(entry, { mcpWriteAvailable: true, mcpWrite })`.
   - Else: import `save` and call `save(entry, { mcpWriteAvailable: false })`.
3. Clear `dirty`; if mode was `mcp`, update `version` from the result.
4. Print artifact path (local) or new version number (mcp), plus the diff summary.

### Flow D — Load ads (from `/lincx-template-load-ads <zoneId>`)

1. Identify the target entry (ask if > 1 active).
2. `get_zone_ads(id=<zoneId>)`.
3. Update entry: `mockAds: <returned>`, `mockAdsSource: { kind:"zone", zoneId }`.
4. Dispatch renderer so preview refreshes.

### Flow E — Preview toggle (from `/lincx-template-preview-toggle`)

1. Flip `previewDisabled` in session state.
2. Report new state.

### Flow F — Refresh schema (from `/lincx-template-refresh-schema`)

1. For each entry, `get_creative_asset_group(id=entry.creativeAssetGroupId)` → replace `cagSchema`.
2. Dispatch renderer for each.

## Never do

- Never render or open browsers yourself. The renderer does that.
- Never write to `versions/` yourself. The save seam does that.
- Never invent pattern conventions. The references are the source of truth.
- Never silently default path choices. Ask the user.
- Never push to Lincx via any route other than `save_template_version` (when the tool exists). No HTTP calls, no CLI shell-outs.

## On failure

- Auth missing → stop, ask for login, do not create session state.
- MCP call errors → surface inline; do not mutate session state.
- Corrupt session state → offer to archive as `.lincx-session.json.bak` and start fresh.
- Renderer or hook errors → check `./.lincx-session.log`.
