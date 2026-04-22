# TODO

Deferred items from the initial build.

## Populate references (blocks non-trivial authoring)

The skill refuses to author non-trivial templates until at least one pattern exists.

- [ ] Drop at least one real example into `plugins/templates-editor-plugin/references/patterns/<name>/` with `example.html`, `example.css`, `notes.md`.
- [ ] Fill in `plugins/templates-editor-plugin/references/rendering-convention.md` from real production templates (token syntax, required fields, any helpers).
- [ ] Add any known gotchas to `plugins/templates-editor-plugin/references/anti-patterns.md`.

## Task 15 — manual smoke test with live Lincx MCP

From the plan (see `docs/superpowers/plans/2026-04-22-templates-editor-plugin.md` Task 15). Requires a live Lincx MCP session — was skipped during the automated build because the MCP was disconnected.

Run `plugins/templates-editor-plugin/tests/smoke.md` top to bottom:

1. `cd` into a scratch project dir, start Claude Code, confirm `/mcp` shows the Lincx MCP connected.
2. `/lincx-template-edit <knownTemplateId>` → pick paths → confirm files appear, session state created, preview opens in browser.
3. Edit the CSS → confirm `preview.html` updates within ~2 s.
4. `/lincx-template-load-ads <knownZoneId>` → confirm preview renders real ad content.
5. `/lincx-template-save` → confirm `ads/versions/v1.html` exists and is self-contained.
6. Edit again, save again → confirm `v2.html` appears with a diff summary.
7. `/lincx-template-preview-toggle` → edit → confirm preview does NOT regenerate. Toggle back on → regenerates.
8. Check `./.lincx-session.log` for clean hook/renderer messages.

### From-scratch path
1. `/lincx-template-new test-banner` → pick a CAG → author a simple banner.
2. Confirm consult-references rule kicks in (skill reads `references/` visibly).
3. Preview renders with synthesized ads.

### Failure-path spot checks
- Corrupt `.lincx-session.json` → skill offers archive + fresh start.
- MCP disconnected mid-session → errors surface inline; cached schema preserved.
- Delete `ads/banner.html` between edit and render → log says "html missing"; no crash.

### On pass
- [ ] `git tag -a templates-editor-plugin-v0.1.0 -m "templates-editor-plugin v0.1.0"`
- [ ] Record any friction/surprises as new items here or as GitHub issues.
