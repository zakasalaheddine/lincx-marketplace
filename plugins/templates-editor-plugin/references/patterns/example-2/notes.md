# example-2 — Best-Overall-Product listing

Ranked product listing where the first item is featured as "Best Overall" with a distinguishing badge; subsequent items render in a compact variant. Used when the brief is a ranked comparison/review placement with rating blocks.

## What this example illustrates

- **Per-rank variant styling** — `listicle-item-{{ _index }}` style hook for differentiating the leader from the rest (see `patterns.md` §6 "Featured + All Benefits").
- **Rating block** with score label mapping and Unicode star rendering — see `patterns.md` §8.
- **Dual CTA (desktop + mobile)** — two CTA links rendered at different breakpoints rather than one responsive CTA.
- Inline `initializeProducts()` helper: injects the "Best Overall" SVG badge on the first item, maps `rating_score` to the label (EXCELLENT / GOOD / AVERAGE per `CHECKLIST.md` §9), renders stars.

## CAG contract (this template)

`adId`, `image`, `href`, `cta_text`, `promo`, `bullet_points_text`, `rating_score`, `rating_stars`.

## When to reach for this over example-4

example-2 emphasises a *ranked* list with a single clear winner; example-4 is a peer product-card layout without a "best overall" distinction. If the brief says "#1 / best / top pick" → example-2. If the brief is "three products side-by-side" → example-4.

## Things to preserve when editing

- Don't move the `initializeProducts()` call to fire before DOM is ready — the badge injection relies on the first `.listicle-item-0` being in the DOM.
- Keep the dual-CTA pattern; if the brief says "one CTA," adjust CSS to hide one at the responsive boundary rather than deleting the markup (the CAG is already wired for both).
