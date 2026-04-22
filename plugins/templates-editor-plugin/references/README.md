# References — Lincx template authoring

This directory is the **single source of truth** the `editing-lincx-templates` skill consults before authoring any HTML/CSS. An LLM working on a Lincx template must read these docs BEFORE proposing changes.

## Read order (LLM: do this every session)

1. **`CHECKLIST.md`** — the deterministic production checklist. Every item is a MUST unless marked OPTIONAL. This is the spine of any from-scratch or adjust session.
2. **`patterns.md`** — copy-paste-ready snippets for common patterns (wrapper + ads loop, multi-CTA, rating block, lazy-load, disclaimer footer, etc.). Indexed by user intent ("Build a listicle", "Add ratings", …).
3. **`anti-patterns.md`** — things that MUST NOT appear in generated templates, ordered by severity (production-breaking → code smell). Read through once per session; re-check the matching entry when you're about to do something that *could* be an anti-pattern.
4. **The most relevant `patterns/example-N/`** directory — real production templates with a brief `notes.md` calling out what's distinctive. Pick by template type:

   | Brief… | Read… |
   |---|---|
   | Listicle / article / ranked article | `example-1` (canonical), `example-6` (with video + featured/all), `example-7` (simple featured/all) |
   | Best-overall / #1 pick / ranked comparison | `example-2` |
   | Minimal card (no rating, no rank) | `example-3` |
   | Peer product-card comparison | `example-4` |
   | Sticky bottom bar | `example-5` |
   | Simple CTA-list block | `example-8` |

5. **`rendering-convention.md`** — prose reference for the Mustache conventions and the `data-content` / `data-show` CSS show-hide pattern. `CHECKLIST.md` §3 and §5 give the terse version; read this when you need the full explanation or are debugging a substitution edge case.

## When is it OK to deviate from the references?

- **Trivially simple requests** (change a color, fix a typo, adjust padding) — proceed without heavy consultation but still respect `anti-patterns.md`.
- **Uncovered requests** (the brief describes something no pattern covers) — read `patterns.md` fully, pick the closest match, state in one sentence which pattern you're closest to and why you're deviating, then proceed.
- For anything else: follow the references exactly. Do not invent conventions, rename fields, or skip `data-lincx-cta` attributes.

## Structure

```
references/
  README.md                         ← you are here
  CHECKLIST.md                      ← canonical production checklist (MUST follow)
  patterns.md                       ← copy-paste snippets, indexed by intent
  anti-patterns.md                  ← must-not-do list, ordered by severity
  rendering-convention.md           ← prose explanation of Mustache + show/hide
  patterns/
    README.md                       ← per-example index
    example-1/ … example-8/         ← real templates with template.html + styles.css + notes.md
```
