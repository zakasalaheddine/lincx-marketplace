# example-3 — Ads-box (minimal card)

Minimal card layout: image, headline, body, CTA, small subtext. No rating block, no ranking, no dual variants. The smallest reasonable listicle-adjacent placement.

## What this example illustrates

- A **stripped-down card** with just the essentials — when the CAG doesn't provide rating/bullets/multi-CTA fields, use this shape.
- **Ad-badge popup** (label + hidden checkbox + CSS transitions) for disclosure UI without JS — see `patterns.md` §7.
- `cta_ref_text` small-text pattern below the CTA (mini-footer attribution like "as seen in…").
- No inline script — everything is declarative HTML + CSS.

## CAG contract (this template)

`adId`, `image`, `offer_headline`, `offer_text`, `href`, `cta_text`, `cta_ref_text`.

## When to reach for this

- The placement is small (sidebar, native unit) and needs to render fast without JS.
- The CAG schema is minimal.
- A single-offer card is enough; no comparison or ranking.

## Things to preserve when editing

- Keep the no-JS ad-badge popup; don't rewrite it as a click handler. The checkbox pattern is deliberately accessible and works in restricted ad environments.
- Keep the layout declarative — if someone asks for animation or reveal behaviour, verify it can be done in CSS before adding a `<script>`.
