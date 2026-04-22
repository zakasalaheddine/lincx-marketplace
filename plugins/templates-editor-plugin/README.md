# templates-editor-plugin

Part of the [**lincx-marketplace**](../../README.md). See the marketplace README for install, usage, and development instructions — everything a user or contributor needs lives there.

## What this plugin is

Build and adjust Lincx ad templates (HTML + Mustache + CSS) from Claude Code with a live preview loop. Pulls via the Lincx MCP, renders a local preview after every edit, and produces a versioned save artifact (will push via MCP once the Lincx write tool ships).

## Commands, flow, and workflow

All covered in the [marketplace README](../../README.md#using-templates-editor-plugin).

## Reference library

The LLM's authoring behavior is shaped by `references/`:
- `CHECKLIST.md` — production checklist
- `patterns.md` — copy-paste pattern snippets
- `anti-patterns.md` — severity-ordered don'ts
- `patterns/example-1/` … `patterns/example-8/` — real production templates with brief notes

Read `references/README.md` for the intended read order and the example-picker table.

## Tests

```
cd plugins/templates-editor-plugin
npm test
```

Runs unit tests (`node:test`), the hook shell-fixture, and the structural lint. No `npm install` needed — everything uses stdlib.
