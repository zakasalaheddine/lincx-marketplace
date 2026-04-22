# Templates Editor Plugin — Design

**Repo:** `lincx-marketplace` · **Plugin:** `plugins/templates-editor-plugin` · **Date:** 2026-04-22 · **Status:** approved for planning

## 1. Purpose

Help users build Lincx ad templates from scratch and adjust existing ones, guided by a local pattern library, with a live preview loop and a save step that paste-ships today and MCP-writes when the write tool ships.

## 2. Context

Lincx "templates" are HTML + CSS ad creatives bound to a `creativeAssetGroup` (CAG) that defines the ad data schema. The `lincx-mcp` exposes them read-only today: `list_templates`, `get_template`, `get_template_versions`, `get_template_version`, `render_template`, `get_template_parents`. Writing back to Lincx is out of band today; a write tool is expected to ship later. The plugin must work cleanly in both worlds with no forking.

## 3. Components

Five pieces, each with one job.

### 3.1 Skill — `editing-lincx-templates` (orchestrator)
Triggers on Lincx-template intent ("build/edit/adjust lincx template …"). Owns workflow: auth check, fetch via MCP, consult references, propose edits, delegate preview, invoke save seam. Never renders, never writes versioned artifacts directly — delegates to scripts.

**Consult-references rule (in the skill body):**
> Before proposing any template HTML or CSS, read `references/README.md`, then read the most relevant files under `patterns/`. If the user's request is covered by a pattern, follow it. Only deviate when the request isn't covered by any pattern, or is trivially simple (e.g. "change this color to red"). When deviating, state in one sentence which pattern the work is closest to and why you're not following it exactly.

### 3.2 Commands (thin bootstraps)
- `/lincx-template-edit <id>` — `auth_status` → `get_template(id)` → write `html`/`css` to a user-named path → record in session state.
- `/lincx-template-new <name>` — pick destination paths + a `creativeAssetGroupId` (via `list_creative_asset_groups`) → create empty files → record in session state with `templateId=null`.
- `/lincx-template-save` — run the save seam (§5) on each dirty entry.
- `/lincx-template-load-ads <zoneId>` — `get_zone_ads(zoneId)` → cache into session state as `mockAds`, mark `mockAdsSource = { kind: "zone", zoneId }`.
- `/lincx-template-preview-toggle` — flip `previewDisabled` in session state.
- `/lincx-template-refresh-schema` — re-fetch and cache the CAG schema for active entries (used when the renderer reports missing schema).

### 3.3 Hook — PostToolUse (shell)
Single hook matching `Write | Edit | MultiEdit`. Logic (shell):
1. Read `./.lincx-session.json`. If missing or `previewDisabled: true` → exit 0.
2. If the just-edited path matches no `htmlPath`/`cssPath` in `activeTemplates` → exit 0.
3. Debounce: update `.lincx-session.preview.pending` marker. If a fresh marker (< 2 s) already exists for that entry, exit.
4. `node scripts/preview-render.mjs <entryId>` — runs the local renderer.
5. Never blocks the user. Errors log to `./.lincx-session.log`. A marker older than 30 s is treated as stale.

### 3.4 Local renderer — `scripts/preview-render.mjs`
Pure function from `{html, css, cagSchema, mockAds?}` to `preview.html`. Shell-launched, zero Claude involvement, zero tokens, truly live. Behavior:
- If `mockAds` missing or shape-invalid → synthesize 2 placeholders from `cagSchema`.
- Wires mock ads into HTML using the convention in `references/rendering-convention.md`.
- CSS inlined in a `<style>` tag; one iteration per mock ad.
- Writes `previewPath` (from session state). On first preview of a session, opens it in the default browser using the platform launcher (`open` on macOS, `xdg-open` on Linux, `start` on Windows — detected at runtime). Subsequent previews just rewrite the file; user refreshes the open tab.

### 3.5 References (pattern library)
```
references/
  README.md
  rendering-convention.md       # user-filled — the tokenization convention
  patterns/
    README.md                   # index table
    <pattern-name>/{example.html, example.css, notes.md}
  anti-patterns.md
  checklists/{new-template.md, adjust-template.md}
```
Patterns live inside the plugin. Plugin ships only stubs and structure; user populates real patterns. The skill's rule enforces consultation discipline.

## 4. Data flow

### 4.1 Session state — `./.lincx-session.json`
Default location: the user's current working directory (auto-created). Shape:

```json
{
  "previewDisabled": false,
  "activeTemplates": [
    {
      "id": "entry-1",
      "templateId": "abc123",
      "creativeAssetGroupId": "cag_xyz",
      "htmlPath": "ads/banner.html",
      "cssPath": "ads/banner.css",
      "previewPath": "ads/preview.html",
      "version": 7,
      "dirty": true,
      "cagSchema": { "...": "cached on bootstrap" },
      "mockAdsSource": { "kind": "synthesized" },
      "mockAds": []
    }
  ]
}
```

The skill writes this on bootstrap and on save. The hook reads it to decide whether to act. The renderer reads it to locate sources and schema. Per-cwd, no locking.

### 4.2 Adjust flow (`/lincx-template-edit <id>`)
1. `auth_status` (prompt `auth_login` if needed).
2. Ask user for destination `htmlPath` and `cssPath`.
3. `get_template(id)` → write files → record entry with `templateId`, `creativeAssetGroupId`, `version`.
4. `get_creative_asset_group(creativeAssetGroupId)` → cache `cagSchema`.
5. Skill reads `references/`, proposes edits in conversation.
6. Each user-accepted edit → Write/Edit → hook → renderer → `preview.html` updated → browser refresh.
7. User says "save" → Flow C.

### 4.3 From-scratch flow (`/lincx-template-new <name>`)
Same as adjust, except step 3 creates empty files with `templateId=null` and step 2 adds picking a CAG via `list_creative_asset_groups`.

### 4.4 Save flow (`/lincx-template-save`)
Calls save seam (§5) for each dirty entry.

### 4.5 Preview agent path (shared, via renderer)
Mock ads always shaped by the CAG. Values come from one of:
- **Synthesized** (default): placeholders conforming to `cagSchema`.
- **Zone-sourced**: ads cached from `/lincx-template-load-ads <zoneId>`.
No dependence on `render_template`'s auto-generated ads.

## 5. Save seam

One procedure, mode chosen by tool availability:

```
save(entry) → { mode: "local" | "mcp", artifactPath, summary }

if (tool "mcp__claude_ai_Lincx__save_template_version" is available) → "mcp" mode
else                                                                  → "local" mode
```

### 5.1 Local mode (today)
1. Resolve `<htmlPath dir>/versions/vN.html` with monotonic `N` (max existing + 1, `N=1` if none).
2. Write artifact with CSS inlined into a `<style>` block (paste-ready single file).
3. Diff summary against last saved artifact (or original fetched source on first save).
4. Report: artifact path, diff summary, and the `templateId` when known ("paste into template `<id>` in Lincx"). No URL construction.
5. Clear `dirty`.

### 5.2 MCP mode (future)
1. Call `save_template_version(templateId, { html, css })` (exact signature confirmed at implementation).
2. Update `version` from MCP response.
3. Same diff summary reporting.
4. Clear `dirty`.

### 5.3 From-scratch caveat
Local mode with `templateId=null` writes artifact and reports "ready to paste as a new template". MCP mode later may call a `create_template` tool if it ships.

### 5.4 Fallback
If MCP-mode call fails, fall through to local mode for this save and report both to the user so they can retry the MCP path.

## 6. Hook specifics

- **Events:** `PostToolUse` with matcher `Write | Edit | MultiEdit`.
- **No path matcher in manifest** — paths are freeform (user-chosen), so hook decides internally.
- **Dispatches:** `node scripts/preview-render.mjs <entryId>` as a plain subprocess. Background via shell `&` is optional; renderer is fast enough that synchronous usually suffices.
- **Debounce:** 2 s marker window per entry; stale markers (> 30 s) overwritten.
- **Opt-out:** `previewDisabled: true` in session state, toggled by `/lincx-template-preview-toggle`.
- **Logging:** everything goes to `./.lincx-session.log`. Hook never prints to chat.

## 7. File layout

```
plugins/templates-editor-plugin/
  .claude-plugin/plugin.json
  skills/editing-lincx-templates/SKILL.md
  commands/
    lincx-template-new.md
    lincx-template-edit.md
    lincx-template-save.md
    lincx-template-load-ads.md
    lincx-template-preview-toggle.md
    lincx-template-refresh-schema.md
  hooks/
    hooks.json
    post-edit-preview.sh
  scripts/
    preview-render.mjs
    save-seam.mjs
    session-state.mjs
    check-plugin.mjs
  references/
    README.md
    rendering-convention.md
    patterns/README.md
    anti-patterns.md
    checklists/new-template.md
    checklists/adjust-template.md
  tests/
    session-state.test.mjs
    preview-render.test.mjs
    save-seam.test.mjs
    hook.test.sh
    smoke.md
  README.md
```

Runtime: Node (`.mjs`, stdlib only) for scripts; bash for the hook entry script. No npm install needed.

## 8. Error handling

- **Auth failure** at bootstrap → skill stops, asks user to `auth_login`; no session state created.
- **MCP call fails mid-session** → reported inline; existing cached schema preserved so preview keeps working.
- **Session state missing** for a command needing it → offer to start a new session.
- **Corrupt session state** → offer to archive as `.lincx-session.json.bak` and start fresh. Never silent overwrite.
- **Node missing** → shell hook logs to `.lincx-session.log` and exits 0. User notices when preview stops updating.
- **Deleted source file between edit and render** → renderer logs and exits 0.
- **Invalid `mockAds` shape** → renderer falls back to synthesizing, logs a warning, leaves cache alone.
- **Missing `cagSchema` in cache** → renderer logs and points user at `/lincx-template-refresh-schema`.
- **Stuck debounce marker** → cleared in renderer `finally`; markers > 30 s old are overwritten.
- **Save with nothing dirty** → reports "nothing to save" and exits.
- **Local write fails** → surfaces error; `dirty` stays true.
- **MCP save fails** → falls back to local mode for this save; user informed of both.
- **References stub still present** (`rendering-convention.md` empty) when skill tries to author → skill refuses and asks for at least one example or explicit deviation authorization.

### 8.1 Explicit non-goals
- Multi-user concurrency on the same template.
- Diffing against remote template state between sessions.
- Auto-recovery of lost session state from disk scans.

## 9. Testing

### 9.1 Automated (`node:test`, stdlib)
- `session-state.mjs`: read/write round-trip, corrupt JSON, missing file, CRUD on entries.
- `preview-render.mjs`: fixture → `preview.html` snapshot; fallback synthesis on invalid `mockAds`; exit 0 when source missing.
- `save-seam.mjs`: local mode `vN.html` numbering across saves, CSS inlining, diff summary; MCP mode with a stubbed write tool — correct payload and `dirty` cleared.

### 9.2 Shell fixture (`tests/hook.test.sh`)
- Missing session state → exit 0, no output.
- Session state present, untouched path → nothing dispatched.
- Matching path → marker appears, `preview.html` produced from fixtures.
- Two rapid fires → one renderer invocation.

### 9.3 Structural lint (`scripts/check-plugin.mjs`)
- `plugin.json` parses and has required fields.
- Every command referenced in the skill exists in `commands/`.
- `references/rendering-convention.md` exists.
- `hooks/hooks.json` points at an executable `post-edit-preview.sh`.

### 9.4 Manual smoke (`tests/smoke.md`)
End-to-end checklist run once per non-trivial change: bootstrap a session, edit, save, load ads from a real zone, confirm live preview.

### 9.5 Developer workflow
`npm test` runs node tests + shell fixture + structural lint. No install.

## 10. Boundaries & invariants

- Skill never renders; renderer never edits user files; hook never decides *what* to do, only *when* to render; commands do no workflow logic.
- Session state is the only shared contract between the skill, the hook, the renderer, and the save seam.
- MCP is touched only from the skill and commands — never from the hook or the renderer.
- The CAG is the single source of truth for mock-ad shape, regardless of whether values are synthesized or zone-sourced.
- The save seam is the only path that produces a pasteable or MCP-pushed artifact. Mode selection is internal; callers don't know which world they're in.

## 11. Out of scope (v1)

- A written-back MCP write tool (designed for, not delivered).
- Creating new templates server-side from scratch (local artifact only).
- Pattern-correctness auto-review (taste judgment lives with references + human review).
- Any Lincx dashboard URL construction.
- Multi-session locking.
