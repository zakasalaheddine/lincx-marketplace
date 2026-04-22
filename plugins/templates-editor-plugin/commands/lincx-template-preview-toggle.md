---
description: Toggle automatic preview rendering on/off for this session
---

Invoke the `editing-lincx-templates` skill's **preview-toggle** flow:
1. Read `./.lincx-session.json`.
2. Flip `previewDisabled` (true ↔ false).
3. Write it back.
4. Report the new state.

If session state doesn't exist, say so and suggest starting with `/lincx-template-edit` or `/lincx-template-new`.
