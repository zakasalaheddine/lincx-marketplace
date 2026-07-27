# lincx-marketplace

A [Claude Code](https://claude.com/claude-code) plugin marketplace for Lincx. Install these plugins in any Claude Code surface — the CLI (`claude`), the Claude desktop app, the VS Code / JetBrains extensions, or the web app — and get Lincx-specific workflows on top of your everyday coding session.

## What's in this marketplace

| Plugin | What it does |
|---|---|
| **`templates-editor-plugin`** | Build and adjust Lincx ad templates (HTML + Mustache + CSS) from Claude Code. Pulls templates via the Lincx MCP, gives you a live preview loop, and ships a save path that paste-drops a versioned artifact today and will push via a Lincx write tool once one lands. Ships with a reference library (production checklist, pattern snippets, anti-patterns, and 8 canonical example templates) that guides the LLM to write on-pattern code. |
| **`lincx-reports`** | Manager-friendly reports over the Lincx MCP — campaign performance, revenue summary, creative anomalies. Read-only, with a fixed four-part output contract so every answer is auditable. |
| **`lincx-inventory`** | Inventory queries over Lincx config — exhaustive zone-targeting rollups with a live/off breakdown per ad group. |
| **`lincx-analysis`** | Zone tier analysis. The platform's deterministic engine computes the tiers, ranks and risk flags; Claude writes the rationale, justifications and next actions on top. Skips the server-side LLM pass entirely, so the analysis prompt is a markdown file you can edit instead of a deploy. |

More plugins will land here — this is the single place to install every Lincx-specific Claude Code plugin we ship.

---

## Requirements

- **Claude Code** installed (CLI, desktop, or IDE extension). Get it at <https://claude.com/claude-code>.
- **Node** on your `PATH` (stdlib only — no `npm install` needed).
- **Lincx MCP** connected to your Claude session — this is what the plugins talk to for reads (`get_template`, `get_creative_asset_group`, `get_zone_ads`, etc.). Run `/mcp` inside Claude Code to confirm it's up.
- `git` on your machine (for the local-install flows below).

---

## Install — for end users (published version)

Once this repo is published, install the marketplace and a plugin from any Claude Code session:

```
/plugin marketplace add zakasalaheddine/lincx-marketplace
/plugin install templates-editor-plugin@lincx-marketplace
/reload-plugins
```

Replace `zakasalaheddine/lincx-marketplace` with the actual GitHub slug once published. Same commands work in the CLI, the desktop apps, the IDE extensions, and the web app — anywhere Claude Code runs.

**Updating:** to pull the latest version of an installed plugin:

```
/plugin update templates-editor-plugin@lincx-marketplace
/reload-plugins
```

**Uninstalling:**

```
/plugin uninstall templates-editor-plugin@lincx-marketplace
/reload-plugins
```

---

## Install — for development (from this repo, locally)

Use this when you're working on the marketplace or want to try the plugin before publishing.

### Option A — local marketplace path (recommended for dev)

```
/plugin marketplace add /absolute/path/to/lincx-marketplace
/plugin install templates-editor-plugin@lincx-marketplace
/reload-plugins
```

This reads the marketplace manifest at `.claude-plugin/marketplace.json` and installs the plugin from the `plugins/` dir. Edits to the plugin dir are picked up after `/reload-plugins`.

### Option B — direct symlink

Even faster iteration — skip the marketplace and symlink the plugin dir straight into Claude Code's plugin path:

```bash
mkdir -p ~/.claude/plugins/
ln -s /absolute/path/to/lincx-marketplace/plugins/templates-editor-plugin \
      ~/.claude/plugins/templates-editor-plugin
```

Then in any Claude Code session:

```
/reload-plugins
```

Changes to the linked dir are live after each `/reload-plugins`. Useful when you're editing the plugin itself.

### Option C — clone + add as marketplace

If you want to keep a local clone but share it across machines:

```bash
git clone https://github.com/zakasalaheddine/lincx-marketplace.git ~/code/lincx-marketplace
```

Then in Claude Code:

```
/plugin marketplace add ~/code/lincx-marketplace
/plugin install templates-editor-plugin@lincx-marketplace
/reload-plugins
```

Pull updates with `git pull` in the clone, then `/reload-plugins`.

---

## Using `templates-editor-plugin`

Once installed, you'll have these slash commands available in any Claude Code session where the Lincx MCP is connected:

| Command | What it does |
|---|---|
| `/lincx-template-edit <templateId>` | Pull an existing template from Lincx, set up a working copy in your current project, open the live preview |
| `/lincx-template-new <name>` | Start a new template from scratch; pick a CAG; author with Claude using the reference library |
| `/lincx-template-save` | Save the current session. Today: writes a versioned single-file artifact (`<htmlDir>/versions/vN.html`, CSS inlined) for pasting into Lincx. Tomorrow: pushes via the Lincx MCP write tool automatically once it ships — no config change on your side |
| `/lincx-template-load-ads <zoneId>` | Load real ads from a Lincx zone to use as preview mock data instead of synthesized placeholders |
| `/lincx-template-preview-toggle` | Pause / resume automatic preview rendering for the current session |
| `/lincx-template-refresh-schema` | Re-fetch and cache the CAG schema for each active template (use after CAG changes) |

### Typical workflow

1. `cd` to any project where you want the template files to live.
2. Start Claude Code (CLI, desktop, or editor extension).
3. Confirm the Lincx MCP is connected: `/mcp`.
4. `/lincx-template-edit <templateId>` (adjust existing) or `/lincx-template-new <name>` (from scratch).
5. Claude asks where to put `html` / `css` files — pick sensible paths under the current project.
6. Chat with Claude to make changes. Every edit triggers the hook, which regenerates `preview.html` next to your files. The browser opens on the first preview of the session; refresh the tab after each change.
7. `/lincx-template-save` when done. Paste the artifact into Lincx (today) or the save will push via MCP (when that tool ships).

Session state lives in `./.lincx-session.json` in the directory you ran Claude Code from. Safe to commit or gitignore — your call.

### Before you use it on real work

The plugin's LLM behavior is shaped by the files under `plugins/templates-editor-plugin/references/`:

- `CHECKLIST.md` — the production checklist every template must follow
- `patterns.md` — copy-paste-ready pattern snippets
- `anti-patterns.md` — severity-ordered list of things the LLM must not do
- `patterns/example-1/` … `patterns/example-8/` — real production templates the LLM consults as concrete illustrations

If you fork this marketplace for your own team, swap the examples under `patterns/` for your own production templates and adjust the top-level docs to match your conventions. The skill refuses to author non-trivial templates when `patterns/` is empty, so there's no risk of it freelancing without reference material.

---

## Development

If you want to contribute to a plugin or run its tests:

```
cd plugins/templates-editor-plugin
npm test
```

This runs the Node unit tests, a shell fixture for the PostToolUse hook, and a structural lint of the plugin layout. No install needed — stdlib only.

Plugin architecture docs, the full design spec, and the implementation plan live under `docs/superpowers/`. The `todo.md` at the root tracks deferred items (most notable: upgrading the local preview renderer to full Mustache).

---

## Publishing

When ready to publish the marketplace for others to install:

```bash
gh repo create lincx-marketplace --public --source=. --push
```

Replace `--public` with `--private` if you want to restrict access (users will need repo access to install). Once pushed, the `/plugin marketplace add <owner>/lincx-marketplace` flow in the "for end users" section works from any Claude Code session.

---

## Feedback

Issues and PRs welcome. For Lincx-specific context or questions about the templates domain, contact the template team directly.
