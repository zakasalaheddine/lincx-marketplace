# Checklist — new template from scratch

## Before you start
- [ ] CAG (`creativeAssetGroupId`) chosen — confirm all ad fields the template needs are in the schema.
- [ ] Closest existing pattern identified (name it, even if it's a partial match). If it's a variant of an existing pattern, consider editing that pattern instead of building new.
- [ ] `rendering-convention.md` re-read; the convention matches what you're about to write.
- [ ] `anti-patterns.md` re-read.

## Tokenization
- [ ] Escaped-by-default: plain text and attribute values use `{{ field }}`.
- [ ] HTML-bearing fields (headlines, body copy that includes markup) use triple-brace `{{{ field }}}`.
- [ ] Iteration is done with Mustache sections (`{{#ads}}…{{/ads}}`, `{{#cta_list}}{{.}}{{/cta_list}}`).
- [ ] Token casing exactly matches the CAG field names — no renames, no punctuation changes.

## Show/hide
- [ ] Optional sections use `data-content="{{ field }}"` + CSS `[data-content=''] { display: none; }` rather than Mustache `{{#field}}…{{/field}}` sections.
- [ ] Inverse-show pairings (`data-show`) only used when there's a deliberate fallback element.

## Structure
- [ ] Outer wrapper is a single `.lincx-wrapper`; the iterating container (e.g. `.lincx-container`) lives inside it.
- [ ] The ad-loop block (`{{#ads}}…{{/ads}}`) wraps exactly one repeated unit; no intermediate elements between `.lincx-container` and each repeated block (breaks reorder scripts).
- [ ] Class naming follows BEM-ish conventions already in use (block, `__element`, `--modifier`).
- [ ] No inline styles on structural elements. If a style is load-bearing and inline in the reference pattern, copy the reason into a code comment.

## Links and tracking
- [ ] Every `<a>` target that goes to an ad URL is `target="_blank"`.
- [ ] Primary CTA anchors have `data-lincx-cta` (attribution).
- [ ] Images that can 404 have `onerror="this.onerror=null; this.remove();"`.
- [ ] Lazy-load images/videos use `data-src` (not `src`), inside a `.lazy-load` parent observed by the IntersectionObserver script.

## CSS and responsiveness
- [ ] Universal reset present: `*, *::after, *::before { box-sizing: border-box; padding: 0; margin: 0; }`.
- [ ] Font import at the top of the stylesheet (Google Fonts Roboto for listicle-family patterns).
- [ ] Mobile-first breakpoints: `576 / 768 / 992 / 1200` for layout; type may use `1024` by legacy convention.
- [ ] No bare `body`/`html` rules — everything scoped under the wrapper class or a shared utility class.
- [ ] Brand colors match the pattern (e.g. `#f53f17` CTA for listicle family).

## Scripts
- [ ] Lazy-load observer (threshold 0.3) present if any `.lazy-load` thumbnails exist.
- [ ] Video keeper (`initVideoPlayback`) present if any `<video class="video-thumbnail">` exist.
- [ ] Group-ordering (`initGroupOffer`) present if the CAG provides `groupOffer` and the pattern uses `data-group` priority.
- [ ] Boot order: ordering → date rendering → video playback → lazy-load binding. If you reorder nodes after lazy-load, rebind.

## Legal / compliance
- [ ] Footer carries every disclosure block from the reference pattern (advertising disclosure, health disclaimer, trademarks/methodology, scientific references, SoFi Relay, copyright row).
- [ ] ShareThis load script present.
- [ ] Tracking pixel (`i.smartnews-ads.com/p?id=…`) present as a 1×1 hidden `<img>` just inside the wrapper's closing tag.
- [ ] Footer links point to `/privacy.html`, `/terms.html`, `/disclosure.html`, `/contact.html`.

## Preview & verification
- [ ] Preview renders with 2 synthesized ads without visual breakage (CSS/layout only — triple-brace and sections won't substitute locally until the renderer is upgraded).
- [ ] Live Lincx render verified for any copy or iteration-dependent change (the local preview is degraded for full-Mustache templates).

## Done
- [ ] `/lincx-template-save` has produced the artifact; `dirty` is cleared.
