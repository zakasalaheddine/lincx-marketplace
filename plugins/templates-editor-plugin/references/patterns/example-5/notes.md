# example-5 — Sticky offer bar

Fixed-to-bottom horizontal bar with image + promo + rating + CTA. The placement stays on screen as the reader scrolls the host page. One offer, not a list.

## What this example illustrates

- **`position: fixed; bottom: 0; z-index: 999`** wrapper — see `patterns.md` §4 for the skeleton.
- **Three-column grid layout** inside the bar (image-col / promo-col / cta-col) with mobile collapse.
- **Close button** that's visible on mobile only (`display: none` above 768px) — users on desktop don't need dismiss, the bar is less intrusive there.
- Rating block inline with the promo — same label/star logic as example-2 via `initializeOffers()`.

## CAG contract (this template)

`adId`, `image`, `offer_headline`, `promo`, `rating_score`, `rating_stars`, `href`, `cta_text`.

## When to reach for this

- Persistent offer presence (e.g. "exclusive discount, claim before leaving").
- Content zones where a sticky bar is permitted by publisher contract.
- Single-offer placements, not comparisons.

## Things to preserve when editing

- Keep `z-index: 999` (or higher); lower z-index values conflict with common publisher overlays.
- Don't drop the mobile close button — ads without dismiss on mobile get complaints and violate some ad-network policies.
- Keep the fixed positioning scoped to `.lincx-sticky-offer-bar` so it doesn't leak if the markup lands inside an unexpected parent.
