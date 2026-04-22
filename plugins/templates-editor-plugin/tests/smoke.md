# Smoke checklist

Run once per non-trivial plugin change. Takes ~5 minutes.

## Setup
1. `cd` to a scratch project directory.
2. `claude` — Claude Code session.
3. Confirm lincx MCP is connected: `/mcp`.

## Flow
1. `/lincx-template-edit <knownTemplateId>`
   - Pick sensible paths (`ads/banner.html`, `ads/banner.css`).
   - Confirm the files appear, session state exists, preview opens in browser.
2. Make a small edit (change a color in CSS).
   - Confirm `preview.html` updates within ~2 s; refresh the browser tab.
3. `/lincx-template-load-ads <knownZoneId>`
   - Confirm preview now renders real ad content.
4. `/lincx-template-save`
   - Confirm `ads/versions/v1.html` exists and is self-contained (CSS inlined).
5. Make another edit; `/lincx-template-save` again.
   - Confirm `v2.html` appears and the diff summary references `v1 → v2`.
6. `/lincx-template-preview-toggle` → edit → confirm preview does **not** regenerate.
7. Toggle back on → edit → preview regenerates.
8. Open `./.lincx-session.log` — sanity-check hook/renderer messages.

## From-scratch flow
1. `/lincx-template-new test-banner`.
2. Pick a CAG.
3. Ask Claude to author a simple banner.
4. Confirm consult-references rule kicks in (Claude reads the references dir visibly).
5. Preview renders with synthesized ads.

## Failure paths to eyeball
- Corrupt `.lincx-session.json` — confirm Claude offers to archive and start fresh.
- MCP disconnected mid-session — confirm errors surface inline; cached schema preserved.
- Delete `ads/banner.html` between edit and render — confirm the log says `html missing` and nothing crashes.
