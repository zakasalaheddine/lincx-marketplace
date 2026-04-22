# example-7 — Listicle featured-vs-all (simple)

Simpler featured-vs-all listicle than example-6. No video branch, no author bio. Just index-based dual-card rendering (featured for the first item, compact for the rest) with mirrored image treatments.

## What this example illustrates

- **Per-index featured rendering** with minimal markup — see `patterns.md` §6.
- **Dual image sources per card** (`imageURL` and `src`) rendered at different positions in the featured vs compact variants.
- Non-standard root wrapper `.wrap` rather than `.lincx-wrapper` — a legacy choice. If writing a new template in this family, use `.lincx-wrapper` instead (per `CHECKLIST.md` §7, every root class should be `lincx-`-prefixed).

## CAG contract (this template)

`adId`, `listicle_headline`, `offer_text`, `offer_headline`, `imageURL`, `src`, `href`, `cta_text`, `groupOffer`.

## When to reach for this over example-6

example-7 when the brief wants the featured-vs-all structure but doesn't need video, author bio, or lazy-load complexity. example-6 when either of those is present.

## Things to preserve when editing

- If you touch the root wrapper, rename `.wrap` to `.lincx-wrapper` on BOTH files — it's a template-scoped change, not a convention one. Test the preview to verify no CSS cascade regressions.
- Keep the listicle index classes (`listicle-item-0`, `listicle-item-1`, etc.) — downstream CSS relies on them.
