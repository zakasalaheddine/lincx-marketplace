# example-1 — Listicle (canonical)

The reference listicle: multi-ad article-style placement. Author bar, media thumbnail, body, CTAs, legal footer. This is the template to copy when the brief is "listicle placement on a content/editorial zone."

## What this example illustrates

- `{{#ads}}…{{/ads}}` iteration wrapping a `.listicle` block.
- Triple-brace for HTML-authored fields (`listical_headline`, `offer_headline`, `offer_text`).
- The **`data-content` / `data-show`** show/hide pattern applied consistently across headline, info bar, image thumbnail, video thumbnail, multi-CTA block, primary CTA.
- **Dual thumbnail elements** per ad (image branch + video branch) — each hidden when its source is empty, and each containing a non-anchor fallback triggered by `data-show="{{ cta_text }}"`.
- Inline `<script>` with three core helpers: `setupLazyLoad()`, `initVideoPlayback()`, `initGroupOffer()` — run in the order `initGroupOffer → renderCurrentDate → initVideoPlayback`. `setupLazyLoad()` also runs at the end of `initGroupOffer()` because reordering invalidates previously-bound observers.
- Full footer disclosure block (all paragraphs present).
- Works with the `cta_list` pattern via `{{#cta_list}}{{.}}{{/cta_list}}` — a plain-text list, not pipe-split.

See `patterns.md` §1 (wrapper + ads loop), §2 (numbered subheading), §3 (multi-CTA list — the simpler plain-text form is used here, not pipe-split), §10 (group ordering), §11 (lazy-load), §12 (video autoplay), §14 (disclaimer footer).

## CAG contract (this template)

`adId`, `groupOffer`, `listical_headline` (HTML, triple-brace), `offer_headline` (HTML, triple-brace), `offer_text` (HTML, triple-brace), `author_name`, `src_author`, `src`, `videoSrc`, `href`, `cta_text`, `cta_list` (plain strings).

## Known edge cases / things to preserve when touching this file

- **`listical_headline` is a legacy typo.** `anti-patterns.md` A6 says don't propagate it to new templates. For *this* template, leave it — the CAG field is named `listical_headline`. Renaming here breaks production.
- **Breakpoint inconsistency**: the layout uses 576/768/992/1200 for container widths but 1024 for type scaling (`.heading`, `.subheading`, `.listicle__info`). Tolerate it. Don't refactor wholesale. If you add a new rule, use 992 to match the container breakpoints.
- **`alt="{{ src_author }}"`** on the author avatar reads as a URL to screen readers. Known a11y nit; kept for parity with production. Prefer `alt="{{ author_name }}"` if you write a variant.
- **Counter hack**: `.listicle[data-heading=''] { counter-increment: index; }` means empty headings *still* increment the counter. If you want "skip empty entirely," also hide the `.listicle[data-heading='']` via a separate rule.
- **No intermediate wrapper between `.lincx-container` and `.listicle`** — `initGroupOffer()` relies on the direct-child relationship to reorder correctly.
