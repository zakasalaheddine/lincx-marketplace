# example-1 — listicle ad template

A numbered-listicle (article-style) advertising template. Multiple ads render as a vertical list; each ad has a headline, author/meta bar, media (image or video), body, and one or more CTA buttons. The wrapper is a responsive container; the footer is a standard legal/disclosure block.

This is our **reference pattern for any "listicle / content-style ad placement"** — the kind that masquerades as an editorial post with ranked offers.

---

## When to use

- Multi-ad placements that present offers as a ranked list or article.
- Placements where the CAG provides: `listical_headline`, `offer_headline`, `offer_text`, `author_name`, `src_author`, `src` or `videoSrc`, `href`, `cta_text`, `cta_list`, `adId`, `groupOffer`.
- Placements on content/editorial zones.

Don't use this pattern for:
- Single-ad banners, interstitials, or sidebar promos.
- Placements without a CAG offering `offer_text` as pre-authored HTML.

---

## Key conventions

### Tokenization (Mustache, not simplified)

Full Mustache is the rule here:
- `{{ field }}` — HTML-escaped value.
- `{{{ field }}}` — **triple-brace**, unescaped. Used for any field that already contains HTML (`listical_headline`, `offer_headline`, `offer_text`).
- `{{#ads}}…{{/ads}}` — section iteration over the ad array. The whole `.listicle` block is repeated per ad.
- `{{#cta_list}}{{.}}{{/cta_list}}` — array iteration, `{{.}}` is the current string value.
- Everything not matched gets rendered as empty (handled by the `[data-content='']` CSS trick below).

### Structural skeleton (top-down)

```
.lincx-wrapper
  .lincx-container
    {{#ads}}
      .listicle[data-heading][data-group][id]
        h2.heading
        h3.subheading > a
        .listicle__info            (author avatar, name, date, category)
        .listicle__thumbnail       (image — shown when src is present)
        .listicle__thumbnail       (video — shown when videoSrc is present)
        .listicle__content         (offer_text, pre-authored HTML)
        .listicle__list__cta       (multi-CTA array)
        .listicle__cta             (single-CTA)
    {{/ads}}
  <script> … </script>             (lazy-load, video, group-order, date)
  footer.footer                    (legal disclosures + dynamic year/location)
  <script> … </script>             (ShareThis, year, location)
  <img>                            (SmartNews pixel)
```

### BEM-ish class naming

- Block: `.listicle`.
- Elements: `.listicle__heading`, `.listicle__info`, `.listicle__author--image`, `.listicle__author--name`, `.listicle__published--date`, `.listicle__category`, `.listicle__thumbnail`, `.listicle__content`, `.listicle__list__cta`, `.listicle__cta`.
- Modifier-ish: `--image`, `--name`, `--date` use double-dash as a BEM modifier separator.
- Utility: `.cta__link` (shared link style), `.lazy-load` (flag for the IntersectionObserver), `.video-thumbnail`, `.video-play-button`, `.lincx-wrapper`, `.lincx-container`, `.footer`, `.heading`, `.subheading`.
- Data attributes used as state: `data-heading`, `data-group`, `data-content`, `data-show`, `data-src`, `data-rank`, `data-lincx-cta` (tracking flag).

### Conditional display via `data-content` / `data-show`

This is the template's signature trick — avoids server-side conditionals:

```css
[data-content=''] { display: none; }
[data-show]:not([data-show='']) { display: none; }
```

- Set `data-content="{{ field }}"` on the wrapper of anything that should disappear when `field` is empty. Mustache renders `data-content=""` when the field is missing, CSS hides it.
- `data-show` is the inverse — hides an element only when the PAIRED data has content. Used to render a "fallback" image or video that appears only when there's no CTA.

**Follow this whenever** a section depends on optional fields. Never use `{{#field}}…{{/field}}` sections for show/hide — use the data-attribute trick so CSS controls visibility and the HTML structure stays consistent for the runtime scripts.

### Responsive breakpoints

Mobile-first. Use these exact thresholds, in this order:
- `576px` — small tablets
- `768px` — tablets (also used for `.lincx-container` max-width)
- `992px` — desktop small
- `1200px` — desktop large

For type scaling, the template also uses a `1024px` breakpoint (inside `.heading`, `.subheading`, `.listicle__info`). It's a legacy inconsistency — when adjusting, prefer `992px` to match the container breakpoints unless the existing rule you're touching already uses `1024px`.

### Counter for numbered headings

- `.lincx-wrapper { counter-set: index; counter-reset: index; }` primes the counter.
- `.listicle[data-heading=''] { counter-increment: index; }` — empty headings still count (so the visual numbering skips over entries without a `listical_headline`).
- `.subheading::before { content: counter(index) '.'; }` prepends the number.

Don't remove the counter setup on the wrapper. Don't move numbering into the HTML as a literal — always derive it from this counter.

### Font and reset

- Google Fonts Roboto (100/300/400/500/700/900, upright + italic) via `@import`.
- Universal reset: `*, *::after, *::before { box-sizing: border-box; padding: 0; margin: 0; }`.
- Body text color `#333`, antialiased.

### Brand colors

- Body text: `#333`.
- CTA button bg: `#f53f17` (orange-red). CTA text: `#fff`.
- In-body link: `#3061ff` (blue), bold, no underline until hover.
- Divider: `#edeef0`.
- Footer muted: `#2f2f2f`, 10px.

---

## JavaScript modules (required)

These three IIFEs are part of the pattern. Keep them unless a variant explicitly drops them.

1. **Lazy-load (IntersectionObserver, 0.3 threshold)** — promotes `data-src` → `src` on images and `<video>` when the parent `.listicle__thumbnail.lazy-load` enters the viewport. Must run on DOMContentLoaded and after any reordering.
2. **Video playback keeper** — ensures autoplaying, muted, looping thumbnails don't stall. Listens to `pause` and `ended` and restarts.
3. **Group-ordering (`initGroupOffer`)** — reorders listicles (except the first) so that groups in `groupKeys = ['high']` appear before others, and assigns `data-rank` 1..N. Calls `setupLazyLoad()` again after reordering so new positions get observed.

The boot block at the bottom runs `initGroupOffer()`, `renderCurrentDate('.listicle__published--date')`, and `initVideoPlayback()` in that order. `initGroupOffer` must run before lazy-load binding because it re-inserts nodes.

---

## Footer — required blocks

The footer is load-bearing for compliance. Every listicle template ships with all of these:

1. **Advertising disclosure** — "ADVERTISING DISCLOSURE:" paragraph clarifying this is an advertising marketplace and images are of models.
2. **Health disclaimer** — "HEALTH DISCLAIMER:" paragraph disclaiming medical advice.
3. **Trademarks / methodology** — paragraph about trademarks, in-depth research, compensation-weighted rankings.
4. **Scientific references notice** — one-liner pointing to product sites.
5. **SoFi Relay disclosure** — Plaid/VantageScore boilerplate. Keep verbatim unless legal changes it.
6. **Copyright / links row** — dynamic `#year` and `#location`, plus `/privacy.html`, `/terms.html`, `/disclosure.html`, `/contact.html`.
7. **ShareThis script** — appended to `<head>` by `addShareThisScript()`.
8. **SmartNews tracking pixel** — 1×1 `<img>` just before `</div>` of `.lincx-wrapper`.

If the creative brief doesn't explicitly remove one of these, keep it.

---

## Do

- Use `{{{ field }}}` for any field that's authored as HTML upstream (headlines, offer body).
- Wrap every optional section in `data-content="{{ field }}"` and let CSS handle the hide.
- Keep every link `target="_blank"`.
- Put `data-lincx-cta` on the primary CTA `<a>` and any CTA-list links — it's how Lincx attribution picks up the click.
- Keep the lazy-load observer threshold at `0.3`. Lower values trigger late on slow scrolls; higher values load too much above-the-fold.
- Use `loading="lazy"` on the author avatar — it's always above the fold, but it's cheap insurance.
- Keep `onerror="this.onerror=null; this.remove();"` on the hero image so a broken src doesn't leave a broken-image glyph.

## Don't

- Don't use Mustache conditionals (`{{#field}}…{{/field}}`) for show/hide within a listicle — it fights the lazy-load observer and the CSS hide. Use `data-content`.
- Don't inline CSS on structural elements (wrapper, container, listicle, subheading, footer). Exceptions: `style="display:none"` on the video-play button, `style="color:grey"` on footer links, `style="text-decoration:none; color:#000000"` on the subheading link — those exist in the template for specific reasons and are load-bearing.
- Don't drop the footer disclosure blocks. Legal.
- Don't change the token casing — `listical_headline` (yes, with the typo), `offer_headline`, `src_author`, `cta_text` match the CAG fields exactly. Renaming breaks production.
- Don't add new top-level wrappers inside `.lincx-container` — the `initGroupOffer` script selects by `.listicle` and `.lincx-container > .listicle`. Adding an intermediate element breaks the reorder.
- Don't set explicit `width`/`height` on thumbnails in HTML; the CSS handles fluid sizing.

---

## Known edge cases / subtleties

- **The `src_author` alt text is a URL.** Lines 26/29 of `template.html` set `alt="{{ src_author }}"` — reads as a URL to screen readers. This is a known accessibility nit; keeping it for parity with production, but if you're making a new pattern variant, prefer `alt="{{ author_name }}"`.
- **Counter hack on empty headings.** `.listicle[data-heading=''] { counter-increment: index; }` means empty headings DO increment the counter. If you want "skip empty headings entirely" behavior, you also need to hide the whole `.listicle[data-heading='']`.
- **Dual thumbnail elements.** The template renders two `.listicle__thumbnail` blocks per ad — one for image (anchor-wrapped), one for video. The `data-content="{{ src }}"` / `data-content="{{ videoSrc }}"` hides whichever is empty. A second non-anchor element with `data-show="{{ cta_text }}"` exists inside each — it's the "no CTA" fallback. Don't collapse these into one element without understanding the show/hide pairing.
- **The 1024px vs 992px breakpoint inconsistency** is tolerated, not intentional. Document it if you touch it; don't refactor wholesale.
- **Legacy `data-content` / `data-show` logic applies to many fields.** Search the CSS for `[data-content='']` and `[data-show]:not([data-show=''])` before adding new conditional sections.

---

## Data fields expected on each ad (CAG contract)

| Field | Type | Usage |
|---|---|---|
| `adId` | string | `<div class="listicle" id>` |
| `groupOffer` | string | `data-group` used by `initGroupOffer`; priority keys (e.g. `"high"`) bubble up |
| `listical_headline` | html | `<h2>` headline + `data-heading`; triple-brace |
| `offer_headline` | html | `<h3>` link text; triple-brace |
| `offer_text` | html | `.listicle__content` body; triple-brace |
| `author_name` | string | author byline |
| `src_author` | url | author avatar `<img src>` |
| `src` | url | hero image `data-src` |
| `videoSrc` | url | hero video `data-src` |
| `href` | url | click target on every CTA/anchor |
| `cta_text` | string | primary CTA label |
| `cta_list` | string[] | optional array of extra CTA labels (also use `href` for each) |

Wrapping-level `{{#ads}}` iterates an `ads` array — each item has the fields above.

---

## How the renderer sees this

**Heads up:** the built-in preview renderer (`scripts/preview-render.mjs`) handles a simplified token set (`{{ var }}` / `{{&var}}`) and does NOT parse Mustache sections or triple-brace. When previewing this pattern:

- `{{ var }}` tokens render (escaped) correctly.
- `{{{ var }}}` triple-brace tokens are not substituted — they'll show as literal text in the preview. (Real Lincx runtime DOES handle them.)
- `{{#ads}}…{{/ads}}` section tags render as-is (literal). The preview won't iterate — you'll see one "ad frame" with the section markers visible.

This is tracked as a renderer-upgrade item in `todo.md`. Until it's upgraded, preview is degraded for this pattern — still useful for CSS tweaks and visual checks, but the copy/content path has to be verified against the live Lincx render.
