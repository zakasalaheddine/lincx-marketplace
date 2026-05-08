---
description: Start an edit session for an existing Lincx template
argument-hint: <templateId>
---

Invoke the `editing-lincx-templates` skill in **adjust** mode with `templateId={{arg}}`. The skill will:
1. Verify auth via `auth_status`.
2. Ask the user for `htmlPath` and `cssPath`.
3. Call `mcp__claude_ai_Lincx__get_template_preview_bundle(templateId={{arg}})`. The bundle includes html, css, the CAG schema, the chosen zone id, and a `mockAds` array (real ads from the highest-traffic zone, or synthesized from the CAG if no zone is bound).
4. Persist the bundle to `./.lincx-session.bundle.json`, then run `node ${CLAUDE_PLUGIN_ROOT}/scripts/resolve-zone-and-ads.mjs ./.lincx-session.bundle.json <entryId> <htmlPath> <cssPath> <projectRoot>` to write files and produce a session-state patch.
5. Merge the patch into `./.lincx-session.json` via `scripts/session-state.mjs::upsertEntry` with `dirty:false`. Delete `./.lincx-session.bundle.json`.
6. Surface any `mockAdsSource.warnings` to the user.
7. Dispatch `node ${CLAUDE_PLUGIN_ROOT}/scripts/preview-render.mjs <entryId>` to open the browser preview.

Do not modify files the skill flow doesn't explicitly instruct. Follow the consult-references rule in the skill body before proposing any HTML/CSS edits.
