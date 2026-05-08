---
description: Re-fetch and cache the CAG schema for each active template entry
---

Invoke the `editing-lincx-templates` skill's **refresh-schema** flow:
1. For each session-state entry with `mockAdsSource.kind` in {`zone-resolved`, `synthesized-fallback`}: re-call `mcp__claude_ai_Lincx__get_template_preview_bundle(templateId=entry.templateId)`, run the resolver script, merge the patch, surface warnings.
2. For entries with `kind` in {`zone`, `synthesized`}: only refresh the CAG via `mcp__claude_ai_Lincx__get_creative_asset_group(id=entry.creativeAssetGroupId)` and replace `cagSchema`. Do not touch `mockAds` or `mockAdsSource`.
3. Dispatch `node ${CLAUDE_PLUGIN_ROOT}/scripts/preview-render.mjs <entryId>` for each affected entry.
