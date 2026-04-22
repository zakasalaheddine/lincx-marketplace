# References — Lincx template patterns

This directory is the **single source of truth** the skill consults before authoring HTML/CSS.

## Layout
- `rendering-convention.md` — how mock ads are wired into HTML. **You populate this.**
- `patterns/<pattern-name>/` — canonical example templates. **You populate these.**
- `anti-patterns.md` — things that look right but break. **You populate this.**
- `checklists/new-template.md` — pre-flight for from-scratch work.
- `checklists/adjust-template.md` — pre-flight for edits.

## How the skill uses this dir
Before proposing any template HTML or CSS, the skill reads this README, then reads the most relevant files under `patterns/`. If the request is covered by a pattern, it follows that pattern. Only when the request isn't covered — or is trivially simple — does it deviate, and it states in one sentence which pattern it's closest to and why it's deviating.
