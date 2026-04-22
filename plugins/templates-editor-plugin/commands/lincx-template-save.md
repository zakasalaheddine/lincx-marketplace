---
description: Save the current Lincx template session(s) — local artifact today, MCP write when available
---

Invoke the `editing-lincx-templates` skill's **save** flow:
1. Read `./.lincx-session.json`.
2. For each entry where `dirty:true`:
   - Detect whether `mcp__claude_ai_Lincx__save_template_version` is available this session.
   - If yes and `templateId` is set: call `saveAsync(entry, { mcpWriteAvailable: true, mcpWrite })` from `scripts/save-seam.mjs`, passing a small wrapper around the MCP call.
   - Else: call `save(entry, { mcpWriteAvailable: false })`.
3. Clear `dirty` on success.
4. Report: mode (`local` | `mcp`), artifact path or new version number, and the diff summary.

If nothing is dirty, say "nothing to save" and stop.
