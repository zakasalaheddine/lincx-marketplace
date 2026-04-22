# Checklist — adjusting an existing template

## Before you edit
- [ ] Pulled latest via `/lincx-template-edit <id>` — working from current server state, not an older cached version.
- [ ] Identified which pattern the template follows (see `patterns/`). If none is an obvious match, call that out before editing.
- [ ] Read that pattern's `notes.md` — especially "Don't" and "Known edge cases".

## Tokens and CAG contract
- [ ] Adjustments don't remove any token the CAG expects. If a field is no longer used, check with the CAG owner before stripping it — the CAG may still populate it.
- [ ] No token renames — casing and spelling stay as-is (including legacy typos like `listical_headline`).
- [ ] If adding a new token, confirm the CAG schema has that field via `get_creative_asset_group(id=…)`; if not, coordinate the CAG update first.

## Show/hide
- [ ] When adding/changing optional sections, use `data-content="{{ field }}"` + the existing CSS rules — not Mustache `{{# }}` conditionals.
- [ ] When pairing an inverse fallback, the `data-show` value matches the positive element's `data-content` source.

## Scripts
- [ ] If you reorder or add listicle nodes, `setupLazyLoad()` runs after the reorder.
- [ ] If you add new `.lazy-load` thumbnails, confirm they're observed (they will be if they share the existing selector).
- [ ] Boot block order preserved: `initGroupOffer` → `renderCurrentDate` → `initVideoPlayback`.

## Structural safety
- [ ] No new intermediate wrappers between `.lincx-container` and `.listicle` (breaks `initGroupOffer`'s direct-child selector).
- [ ] Existing `data-content` / `data-show` bindings on elements you moved are still correct.
- [ ] `data-lincx-cta` is still on every clickable CTA.

## CSS
- [ ] Breakpoint usage matches existing style (layout: 576/768/992/1200; type may use 1024 by legacy).
- [ ] No bare `body`/`html` rules introduced.
- [ ] New selectors follow the BEM-ish convention already in the file.

## Legal / footer
- [ ] No disclosure block removed unless the brief explicitly says so AND legal has approved.
- [ ] Tracking pixel and ShareThis script still present.

## Preview & verification
- [ ] Preview renders cleanly (CSS/layout confirmation — triple-brace and sections won't substitute locally until the renderer is upgraded).
- [ ] For copy changes or iteration-logic changes, verified against the live Lincx render.
- [ ] Zone-sourced preview (`/lincx-template-load-ads <zoneId>`) looks sensible if the change could affect how real ad data renders.

## Diff discipline
- [ ] Diff against the previous version is limited to what the user asked for — no incidental reformatting.
- [ ] Whitespace-only changes avoided unless they're the whole point of the edit.

## Done
- [ ] `/lincx-template-save` has produced the artifact; `dirty` is cleared.
- [ ] Saved diff summary matches expectations (paste-ready for Lincx UI until the MCP write tool ships).
