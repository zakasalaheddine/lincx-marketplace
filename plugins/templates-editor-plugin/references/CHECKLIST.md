# Lincx Ad Template Generation Checklist

A deterministic checklist an AI (or human) must follow when generating a new Lincx ad template + stylesheet. Every item is a MUST unless marked OPTIONAL. Work top-down; do not skip steps.

---

## 0. Before writing anything

- [ ] Confirm the **template type** (one of): `listicle`, `sticky-offer-bar`, `product-card`, `ads-box`, `best-overall-product`, `featured-vs-all`, `simple-cta`, or hybrid. If unclear, ask the user.
- [ ] Confirm the **ad fields** in use. Map them to the canonical Mustache variables (see §6). Do **not** invent new field names — propose additions explicitly.
- [ ] Confirm the **client/network** (e.g. Affiliati, Centerfield, Refinance.com) so the visual language matches.
- [ ] Confirm **media type**: image-only, video-only, or both (affects lazy-load JS).
- [ ] Confirm whether the template needs a **footer with legal disclaimer** (listicles: yes; sticky bars/cards: usually no).

---

## 1. File structure

- [ ] Produce exactly two files: `template.html` and `styles.css`.
- [ ] No external JS files. No build step. No React/Vue/Tailwind.
- [ ] All JS lives inline at the bottom of `template.html` (inside `<script>` tags).
- [ ] CSS is one file, no `@import` except Google Fonts at the top.

---

## 2. Required template.html skeleton

Every template MUST have this shape:

```mustache
<div class="lincx-{type}-wrapper">       {{! scoped root, prefix with lincx- }}
  <div class="lincx-{type}-container">   {{! optional inner container }}
    {{#ads}}
    <div class="{component-class}" id="{{ adId }}" data-group="{{ groupOffer }}">
      {{! ... ad content ... }}
    </div>
    {{/ads}}
  </div>
  <script>
    {{! inline JS }}
  </script>
</div>
```

- [ ] Root element has a `lincx-` prefixed class.
- [ ] `{{#ads}}...{{/ads}}` wraps every per-ad block.
- [ ] Root ad element has `id="{{ adId }}"`.
- [ ] If ordering matters, root ad element has `data-group="{{ groupOffer }}"`.

---

## 3. Mustache variable conventions

- [ ] Use `{{{ triple-brace }}}` for fields that may contain HTML: `offer_headline`, `offer_text`, `cta_text`, `listicle_headline`, `cta_subtext`, `offer_disclaimer`, `promo`.
- [ ] Use `{{ double-brace }}` for URLs, IDs, alt text, and plain data: `href`, `src`, `image`, `adId`, `author_name`, `src_author`, `rating_score`, `rating_stars`.
- [ ] For array iteration use `{{#cta_list}}...{{/cta_list}}` with `{{.}}` for current value and `{{_index}}` for position.
- [ ] **Never rename existing fields.** `listicle_headline` (not `listical_headline` — that is a known typo in one legacy template; do not propagate).

---

## 4. CTA tracking attributes (mandatory on every outbound link)

Every `<a href="...">` that leads to a sponsor MUST have:

- [ ] `href="{{href}}"` (or `{{.}}` inside a `cta_list` loop, later overridden by JS split)
- [ ] `target="_blank"`
- [ ] `data-lincx-cta` (presence marker — no value needed)
- [ ] `data-lincx-cta-name="{semantic-name}"` — one of: `headline`, `image`, `video`, `cta`, `cta_list`, `main`, `visit-site`, `cta position {n}` (for list items)
- [ ] `data-lincx-cta-position="{position}"` — usually mirrors name, or adds index for list items
- [ ] OPTIONAL: `data-disclaimer="{{ offer_disclaimer }}"` when the CTA has a legal disclaimer

---

## 5. Conditional display (the `data-content` / `data-show` pattern)

This is Lincx's way of hiding empty Mustache fields at render time.

- [ ] Add `data-content="{{ field }}"` to any element that should disappear when its field is empty.
- [ ] For array fields, concatenate inside the attribute: `data-content="{{#cta_list}}{{.}}{{/cta_list}}"`.
- [ ] Pair with the universal CSS rule (include in every stylesheet):

```css
[data-content=''] { display: none; }
[data-show]:not([data-show='']) { display: none; }
```

- [ ] Use `data-show="{{ field }}"` for inverse logic (show only when field is empty — used for fallback images).

---

## 6. Canonical field catalog

Fields referenced across existing templates. Use these names verbatim:

| Field | Type | Use |
|---|---|---|
| `adId` | string | Required, root `id` |
| `href` | URL | Main click-through |
| `offer_headline` | HTML | Main ad headline |
| `offer_text` | HTML | Body copy |
| `cta_text` | HTML | Button label |
| `cta_ref_text` | HTML | Small text under CTA |
| `cta_subtext` | HTML | Footer-ish small text |
| `cta_list` | array of `"Label\|URL"` or `"Label\|URL\|color"` | Multi-CTA |
| `offer_disclaimer` | HTML | Legal disclaimer |
| `listicle_headline` | HTML | Section/card heading |
| `author_name` | string | Byline |
| `src_author` | URL | Author avatar |
| `src` | URL | Main image |
| `videoSrc` | URL | Main video |
| `image` / `imageURL` | URL | Alt image field |
| `bullet_points_text` | array of strings | Feature bullets |
| `groupOffer` | string | Ordering key: `'high'` or `'default'` |
| `promo` | HTML | Promo/discount text |
| `rating_score` | number (0–10) | Rating number |
| `rating_stars` | number (0–5) | Star count |
| `banner` | boolean | Banner variant flag |

Need a new field? Document it with a comment and flag it to the user before using.

---

## 7. CSS conventions (mandatory)

- [ ] Start file with Google Fonts `@import` (Roboto / Inter / Faustina / Poppins as needed).
- [ ] Universal reset:

```css
*, *::after, *::before {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}
```

- [ ] Use `-webkit-font-smoothing: antialiased` on the root wrapper or body.
- [ ] Mobile-first. Use `@media (min-width: N)` only (never max-width).
- [ ] Canonical breakpoints: **576, 768, 850, 992, 1024, 1200** px.
- [ ] Scope every class with `lincx-` or a unique component prefix (e.g. `best-overall-product-`, `listicle__`). **Never** use generic names like `.card`, `.btn`, `.wrapper` without a prefix.
- [ ] Use BEM (`block__element--modifier`) for component internals (`listicle__thumbnail`, `listicle__author--image`).
- [ ] Include the `[data-content='']` + `[data-show]` rules from §5.
- [ ] CSS custom properties at top of file when the template has a brand palette (`--brand`, `--ink`, `--ring`).

---

## 8. JavaScript conventions

- [ ] Wrap initialization in an IIFE `(() => { ... })()` OR a `DOMContentLoaded` check.
- [ ] Standard boilerplate at top:

```js
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  init()
} else {
  document.addEventListener('DOMContentLoaded', init)
}
```

- [ ] **Never** use `localStorage`, `sessionStorage`, or cookies — ads run in iframes where this fails.
- [ ] No external libraries except ShareThis (only when explicitly requested).
- [ ] For CTAs in `cta_list`, implement `handleCtaListSplits()`:

```js
function handleCtaListSplits() {
  document.querySelectorAll('.listicle__list__cta a, .actions .btn').forEach((cta, index) => {
    const parts = (cta.dataset.element || '').split('|')
    cta.textContent = parts[0]
    cta.href = parts[1]
    cta.dataset.lincxCtaName = `cta position ${index + 1}`
    if (parts[2]) cta.style.color = parts[2].trim()
  })
}
```

- [ ] For videos, implement `initVideoPlayback()` with pause/ended listeners to guarantee autoplay.
- [ ] For lazy-load media, use `IntersectionObserver` with `threshold: 0.3` and swap `data-src` → `src`.
- [ ] For GIF/WebP inside `<video>` tags, replace the element with `<img>` at lazy-load time.
- [ ] For listicles with ordering, implement `initGroupOffer()` that:
  1. Keeps the first `.listicle` in place
  2. Groups the rest by `data-group`
  3. Reorders by `groupKeys = ['high']` priority
  4. Assigns sequential `data-rank` attributes

---

## 9. Rating rendering (when applicable)

- [ ] Store raw score on a `data-*` attribute (`data-rating-score`, `data-rating-stars`).
- [ ] Label thresholds: `>= 9.0` → EXCELLENT, `>= 7.0` → GOOD, else AVERAGE.
- [ ] Clamp stars to `[0, 5]` and render full/half/empty with Unicode `★`.
- [ ] Half-star logic: `rating % 1 >= 0.5`.

---

## 10. Date rendering (when applicable)

- [ ] Format with `toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' })`.
- [ ] Optionally subtract a few days (1–7) to make dates look "recently published" without being today's date.
- [ ] For month-only placeholders, use a `.dynamic_month` class populated with `new Date().toLocaleString('en-US', { month: 'long' })`.

---

## 11. Footer (listicles and long-form only)

- [ ] Place outside the `{{#ads}}` loop, inside the wrapper.
- [ ] Include advertising disclosure, trademark disclaimer, and (for health offers) health disclaimer.
- [ ] Dynamic year: `document.getElementById('year').textContent = new Date().getFullYear()`.
- [ ] Dynamic hostname: `document.getElementById('location').textContent = window.location.hostname`.
- [ ] Guard with `if (element)` checks — do not assume the element exists.

---

## 12. Accessibility baseline

- [ ] Every `<img>` has an `alt` (can be `alt="{{ offer_headline }}"` or `"listicle image"`).
- [ ] Every `<img>` uses `loading="lazy"` when not inside a JS lazy-load block.
- [ ] Videos include `<source>` fallbacks for both `video/mp4` and `video/webm`, plus text fallback.
- [ ] Interactive buttons have `aria-label` when icon-only (e.g. close button on sticky bar).
- [ ] Do not rely on color alone to convey meaning.

---

## 13. Final review before handing off

- [ ] All `{{...}}` placeholders actually appear somewhere in the template.
- [ ] No `{{...}}` leaks inside `<script>` bodies — Mustache renders server-side, JS sees the output.
- [ ] Every CTA has `data-lincx-cta` + `target="_blank"` + `href`.
- [ ] `data-content=""` pairs with a CSS rule that hides empty fields.
- [ ] Class names are scoped (no collisions with publisher CSS).
- [ ] Mobile-first CSS renders correctly at 360px, 768px, and 1200px widths.
- [ ] No `localStorage`, no external JS (except ShareThis if requested).
- [ ] File lints clean: no unclosed tags, no trailing Mustache sections.
