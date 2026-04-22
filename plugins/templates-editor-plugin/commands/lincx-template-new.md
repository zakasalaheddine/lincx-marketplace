---
description: Start a new Lincx template from scratch
argument-hint: <templateName>
---

Invoke the `editing-lincx-templates` skill in **from-scratch** mode with `templateName={{arg}}`. The skill will:
1. Verify Lincx auth.
2. Call `mcp__claude_ai_Lincx__list_creative_asset_groups` and ask the user to pick the `creativeAssetGroupId` to target.
3. Ask for `htmlPath` and `cssPath` in the user's current project; create empty files at those paths.
4. Call `mcp__claude_ai_Lincx__get_creative_asset_group(id=...)` and cache the schema in session state.
5. Upsert a session-state entry with `templateId: null`, the chosen paths, cached schema, and `mockAdsSource:{kind:"synthesized"}`.
6. Consult `references/` — follow the consult-references rule in the skill — and author initial HTML/CSS.

Every Edit/Write to the template files triggers the preview hook automatically.
