---
description: Load real ads from a Lincx zone as preview mock ads
argument-hint: <zoneId>
---

Invoke the `editing-lincx-templates` skill's **load-ads** flow with `zoneId={{arg}}`:
1. Ask the user which active-template entry to apply the mock ads to (if more than one).
2. Call `mcp__claude_ai_Lincx__get_zone_ads(id={{arg}})`; validate returned ads against the cached CAG schema via `validateAdsShape` from `scripts/preview-render.mjs` (if any ad fails, warn — the renderer will fall back to synthesized on preview).
3. Update the entry in session state: `mockAds: <returned ads>`, `mockAdsSource: { kind: "zone", zoneId: "{{arg}}" }`.
4. Directly invoke `node ${CLAUDE_PLUGIN_ROOT}/scripts/preview-render.mjs <entryId>` so the preview regenerates with the new ads.
