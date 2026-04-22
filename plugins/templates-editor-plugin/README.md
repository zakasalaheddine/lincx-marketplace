# templates-editor-plugin

Build and adjust Lincx ad templates (HTML + CSS) from Claude Code with a live preview loop.

## What's inside

- Skill `editing-lincx-templates` — orchestrator that consults references, pulls via the Lincx MCP, applies edits, and runs the save flow.
- Slash commands: `/lincx-template-new`, `/lincx-template-edit`, `/lincx-template-save`, `/lincx-template-load-ads`, `/lincx-template-preview-toggle`, `/lincx-template-refresh-schema`.
- PostToolUse hook that auto-renders `preview.html` after any edit to a tracked template file.
- Local renderer (`scripts/preview-render.mjs`) that wires CAG-shaped mock ads into the HTML.
- Save seam (`scripts/save-seam.mjs`) that paste-ships today (versioned local artifact) and MCP-writes when a write tool lands.
- References library at `references/` — **populate `patterns/` and `rendering-convention.md` from your own template corpus.**

## Requirements

- Node (stdlib only — no `npm install`).
- `lincx-mcp` connected to your Claude session for the MCP-backed reads.

## Start a session

```
/lincx-template-edit <templateId>   # adjust an existing template
/lincx-template-new <name>          # build from scratch
```

The session lives in `./.lincx-session.json` in whatever directory you run Claude in.

## Save

```
/lincx-template-save
```

Today: writes a versioned single-file artifact at `<htmlDir>/versions/vN.html` (CSS inlined) for you to paste into Lincx. Tomorrow: calls the MCP write tool automatically once it ships — no config change needed.

## Tests

```
cd plugins/templates-editor-plugin
npm test
```

Runs node unit tests, the shell hook fixture, and the structural lint.

## Populating references

The plugin ships with stub references. Before authoring non-trivial templates, drop your real examples under `references/patterns/<name>/{example.html,example.css,notes.md}` and describe your tokenization convention in `references/rendering-convention.md`.
