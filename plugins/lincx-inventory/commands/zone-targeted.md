---
description: List every ad group directly targeted to a Lincx zone and whether it is fully live (campaign+adgroup+ad enabled with a viable creative), or where it is off
argument-hint: "[zoneId] [all|live|off]"
---

Invoke the `zone-targeted` skill with arguments `{{args}}`.

Argument parsing:
- A token matching `^[a-z0-9]{6}$` (or any non-mode token) is the **zoneId**.
- A token that is exactly `all`, `live`, or `off` is the **mode** (default `all`).
- If no zoneId is given, reuse the last remembered zone: run
  `node ${CLAUDE_PLUGIN_ROOT}/scripts/session-state.mjs get` — it prints the
  remembered zoneId (empty if none). If empty, ask the user for a zoneId.
- When a zoneId is given, remember it before running:
  `node ${CLAUDE_PLUGIN_ROOT}/scripts/session-state.mjs set <zoneId>`.

Then follow the skill's flow exactly.
