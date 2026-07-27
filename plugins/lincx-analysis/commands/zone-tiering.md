---
description: Run a Lincx zone tier analysis — which creatives belong in which tier (or which offer belongs in which rank slot) over a date range
argument-hint: "[zoneId] [dateStart] [dateEnd] [tiering|ranked]"
---

Invoke the `lincx-zone-tiering` skill with arguments `{{args}}`.

Argument parsing:
- A token matching `^[a-z0-9]{6}$` is the **zoneId**.
- Tokens matching `^\d{4}-\d{2}-\d{2}$` are **dateStart** then **dateEnd**, in that order.
- A token that is exactly `tiering` or `ranked` selects the analysis type
  (`offerTiering` / `rankedOfferOptimization`, default `offerTiering`).
- Missing zoneId → ask for it. Missing date range → ask for it. Never default a range.

Then follow the skill's flow exactly.
