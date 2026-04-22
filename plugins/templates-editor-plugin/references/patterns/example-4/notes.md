# example-4 — Product-card with rank + rating stats

Peer product cards with rank badges, side-mounted rating stats, price + promo, bullets, and a "Read Review" style CTA. Several cards render in sequence; each is self-contained.

## What this example illustrates

- **Card header with rank + image + stats** — rank number on the left, product image middle, rating stats box on the right. See `patterns.md` §5 for the baseline structure.
- **Price + promo alongside rating** — the stats section carries both the rating and the promotional price, not just the score.
- **Index-based accent styling** — line/underline decorations switch per ad index (top 3 styled differently from the rest).
- No inline script — rating label and stars are set at author time, not computed live. (Contrast with example-2 which computes them in JS.)

## CAG contract (this template)

`adId`, `image`, `offer_headline`, `rating_score`, `rating_stars`, `promo`, `price`, `bullet_points_text`, `offer_text`, `href`, `cta_text`, `cta_ref_text`.

## When to reach for this over example-2

example-4 is a **peer comparison** — multiple cards, similar weight, the reader scans laterally. example-2 is **ranked** — leader + followers, the reader is told who's best. If the brief mentions "#1 / top pick / featured" → example-2. If the brief is "here are our top N picks, all strong" → example-4.

## Things to preserve when editing

- Keep the static rating output. If the brief asks for dynamic label/star logic, reach for example-2's `initializeProducts()` helper (or `patterns.md` §8) rather than inventing new code.
- The index-based accent styling is pure CSS — don't move it into JS.
