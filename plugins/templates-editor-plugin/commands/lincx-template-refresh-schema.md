---
description: Re-fetch and cache the CAG schema for each active template entry
---

Invoke the `editing-lincx-templates` skill's **refresh-schema** flow:
1. Read `./.lincx-session.json`.
2. For each entry, call `mcp__claude_ai_Lincx__get_creative_asset_group(id=entry.creativeAssetGroupId)` and replace `cagSchema` in session state.
3. Directly invoke `node ${CLAUDE_PLUGIN_ROOT}/scripts/preview-render.mjs <entryId>` for each so the preview regenerates with the fresh schema.
4. Report which entries refreshed successfully and any MCP errors.
