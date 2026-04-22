# example-8 — Simple CTA with pipe-split multi-CTA

Minimal placement: headline + body + a **list of CTAs** rendered from a pipe-split array (`"Label|URL|color"`). No image, no rating, no video. Used when the CAG exposes `cta_list` and the design is essentially a single block of offers.

## What this example illustrates

- **Pipe-split `cta_list` parsing** — the canonical `handleCtaListSplits()` helper, which:
  1. Reads `data-element` on each rendered CTA.
  2. Splits on `|` into `[label, href, color?]`.
  3. Sets `textContent`, `href`, and optional color override per item.
  4. Writes `data-lincx-cta-name` as `"cta position N"` for attribution.

  See `patterns.md` §3 for the shared snippet. example-8 is the canonical minimal invocation of this helper.
- **CSS custom properties (`--brand`, etc.)** at the top of `styles.css` for button theming — the helper's per-item color override falls back to the custom property.
- Non-standard root wrapper `.container` — same comment as example-7: acceptable for the legacy template, but new work should prefer `.lincx-container` or a `lincx-`-prefixed name (`CHECKLIST.md` §7).

## CAG contract (this template)

`adId`, `offer_headline`, `offer_text`, `cta_list` (array of pipe-delimited strings), `href`, `cta_subtext`.

## When to reach for this

- The placement's value is the *offer list* itself — several CTAs under one headline.
- The CAG passes `cta_list` as the primary field.
- No ranking, no rating, no media — the CTAs are the content.

## Things to preserve when editing

- Don't rewrite `handleCtaListSplits()` — it's the shared pattern. Variants should extend via new `data-*` attributes, not by forking the parser.
- Keep `target="_blank"` and `data-lincx-cta` on every rendered anchor (see `anti-patterns.md` A4, A11). The helper doesn't set `target` — that's in the Mustache template.
- When the CAG dictates pipe-split format (`"Label|URL"` vs `"Label|URL|color"`), don't assume a third segment; guard with `if (parts[2])`.
