# Patterns — canonical examples

Real production templates, one per directory. Each example ships as:
- `template.html` — the Mustache template
- `styles.css` — the canonical stylesheet
- `notes.md` — when to reach for this example, what it illustrates, what to preserve when editing

Read the matching `notes.md` first. Then `template.html` + `styles.css` are the source of truth for structure, naming, and idioms. For rule-of-thumb conventions across all templates, read `../CHECKLIST.md`, `../patterns.md`, and `../anti-patterns.md` — the files in this subdir are concrete illustrations of those rules.

## Index

| Example | Type | Distinctive | Scripts |
|---|---|---|---|
| [`example-1`](./example-1/notes.md) | Listicle (canonical) | Dual thumbnail (image/video), plain-text `cta_list`, full disclosure footer, `initGroupOffer` reordering | lazy-load, video keeper, group-order |
| [`example-2`](./example-2/notes.md) | Best-overall-product | Per-rank variant, Best-Overall badge, dynamic rating label + stars, dual CTA (desktop + mobile) | `initializeProducts` |
| [`example-3`](./example-3/notes.md) | Ads-box (minimal card) | No-JS declarative card; ad-badge popup via hidden checkbox | — |
| [`example-4`](./example-4/notes.md) | Product-card | Rank + image + rating stats + price + promo + bullets; static rating (author-set) | — |
| [`example-5`](./example-5/notes.md) | Sticky offer bar | Fixed bottom; image/promo/CTA grid; mobile close button; rating | `initializeOffers` |
| [`example-6`](./example-6/notes.md) | Listicle + video + featured/all | Full listicle, video branch, author bio, per-index featured vs compact | lazy-load, video keeper |
| [`example-7`](./example-7/notes.md) | Listicle featured/all (simple) | Per-index featured/compact variant, dual image sources; legacy `.wrap` root | — |
| [`example-8`](./example-8/notes.md) | Simple CTA with pipe-split `cta_list` | Pipe-delimited `"Label\|URL\|color"` parsing; no image/rating/video | `handleCtaListSplits` |

## Choosing an example for a new brief

- Start with the brief type → pick the example that matches.
- Skim its `notes.md` — "When to reach for this" and "Things to preserve when editing."
- Copy the `template.html` + `styles.css` as a scaffold, then adapt per the brief.
- Re-read the matching `CHECKLIST.md` sections and `patterns.md` snippets for anything the scaffold doesn't cover.
- Verify against `anti-patterns.md` before declaring done.
