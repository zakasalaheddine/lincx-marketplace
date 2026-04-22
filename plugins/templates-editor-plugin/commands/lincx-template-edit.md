---
description: Start an edit session for an existing Lincx template
argument-hint: <templateId>
---

Invoke the `editing-lincx-templates` skill in **adjust** mode with `templateId={{arg}}`. The skill will:
1. Verify Lincx auth (call `mcp__claude_ai_Lincx__auth_status`, prompt login if needed).
2. Ask the user for `htmlPath` and `cssPath` in their current project.
3. Call `mcp__claude_ai_Lincx__get_template(id={{arg}})`; write `html` and `css` to the chosen paths.
4. Call `mcp__claude_ai_Lincx__get_creative_asset_group(id=<creativeAssetGroupId from template>)`; cache the schema into session state.
5. Upsert a session-state entry in `./.lincx-session.json` via `scripts/session-state.mjs` with `{templateId, creativeAssetGroupId, htmlPath, cssPath, previewPath, version, dirty:false, cagSchema, mockAdsSource:{kind:"synthesized"}, mockAds:[]}`.
6. Trigger a first render (run `node ${CLAUDE_PLUGIN_ROOT}/scripts/preview-render.mjs <entryId>` directly) so the preview opens in the browser.

Do not modify files the skill flow doesn't explicitly instruct. Follow the consult-references rule in the skill body before proposing any HTML/CSS edits.
