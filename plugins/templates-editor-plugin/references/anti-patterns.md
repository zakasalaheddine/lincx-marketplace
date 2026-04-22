# Lincx Template Anti-Patterns

Things an AI (or developer) MUST NOT do when generating Lincx ad templates. Each entry explains what's wrong and shows the correct alternative. Ordered from most-severe (breaks production) to least-severe (code smell).

---

## 🔴 Production-breaking

### A1. Using `localStorage`, `sessionStorage`, or cookies

Lincx ads run in ad slots and iframes where storage is blocked or isolated. The code will throw in production.

❌ **Don't:**
```js
localStorage.setItem('dismissed', 'true')
```

✅ **Do:** Use in-memory state only. If persistence is required, push it up to the server/Mustache data layer.

---

### A2. Loading external JS libraries

External CDN calls are blocked in most ad environments and create render delays. The templates must ship fully self-contained.

❌ **Don't:**
```html
<script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper.js"></script>
<script src="https://unpkg.com/alpinejs"></script>
```

✅ **Do:** Vanilla JS only. The one permitted exception is the ShareThis script in listicles (added via `document.createElement('script')` and only when sharing is explicitly requested).

---

### A3. Using React, Vue, or any framework

Lincx renders Mustache server-side. Client-side frameworks would require a build step that the ad platform cannot run.

❌ **Don't:** Return `.jsx`, `.vue`, or `.tsx` files. Don't use JSX syntax.

✅ **Do:** Plain HTML + vanilla JS + CSS.

---

### A4. Forgetting `data-lincx-cta` on outbound links

This is how Lincx tracks clicks. A CTA without it produces zero revenue data.

❌ **Don't:**
```html
<a href="{{href}}" target="_blank">{{cta_text}}</a>
```

✅ **Do:**
```html
<a href="{{href}}" target="_blank"
   data-lincx-cta
   data-lincx-cta-name="cta"
   data-lincx-cta-position="cta">
  {{{ cta_text }}}
</a>
```

---

### A5. Missing `id="{{ adId }}"` on the ad root

The platform relies on `adId` for per-ad tracking, A/B testing, and DOM targeting.

❌ **Don't:**
```html
{{#ads}}
<div class="listicle">
{{/ads}}
```

✅ **Do:**
```html
{{#ads}}
<div class="listicle" id="{{ adId }}" data-group="{{ groupOffer }}">
{{/ads}}
```

---

### A6. Using a field the CAG doesn't define, or renaming a CAG field

Every template is bound to its own `creativeAssetGroup` (CAG). The CAG is the **only** source of truth for which fields exist on this template — field names vary per CAG. A field name from a different template (or from an example under `patterns/`) does NOT imply the same field exists here. Inventing or renaming produces empty output in production.

❌ **Don't:**
- Guess at field names.
- Copy a field name from a different template's CAG (including the examples).
- Abbreviate (`cta` instead of `cta_text`). Don't pluralize / depluralize.
- "Correct" a legacy typo in the CAG (e.g. `listical_headline`) — if the CAG uses it, use it verbatim.

✅ **Do:** Load the CAG for the template you're working on via `mcp__claude_ai_Lincx__get_creative_asset_group(id=…)`; use exactly the field names it returns, and nothing else. If the brief needs a field that isn't in the CAG, stop and coordinate a CAG update before writing the template. See `CHECKLIST.md` §6.

---

### A7. Inline Mustache inside `<script>` bodies

Mustache renders before the browser sees the template. Inside a `<script>`, unescaped `{{ }}` interpolation works but is fragile — any JS context that happens to contain `{{ }}` (regex, template literals, strings) breaks the render.

❌ **Avoid:**
```html
<script>
  const adId = "{{ adId }}";  // breaks if adId contains quotes or newlines
  const cfg = {{{ raw_json }}};  // HTML escaping rules don't match JS
</script>
```

✅ **Do:** Put Mustache data on DOM attributes and read them in JS:
```html
<div id="{{ adId }}" data-config='{"score": {{ rating_score }}}'></div>
<script>
  const el = document.currentScript.previousElementSibling
  const cfg = JSON.parse(el.dataset.config)
</script>
```

---

## 🟠 Breaks layout / tracking

### A8. Omitting the `data-content` hide pattern

Without it, empty Mustache fields produce empty headings, broken layouts, or stray `undefined` alt text.

❌ **Don't:**
```html
<h2>{{ offer_headline }}</h2>
```

✅ **Do:**
```html
<h2 data-content="{{ offer_headline }}">{{{ offer_headline }}}</h2>
```

And in CSS:
```css
[data-content=''] { display: none; }
```

---

### A9. Using `max-width` media queries

The codebase is mobile-first. Mixing `max-width` queries breaks the cascade and produces conflicts at boundary widths.

❌ **Don't:**
```css
@media (max-width: 768px) { .foo { font-size: 14px; } }
```

✅ **Do:**
```css
.foo { font-size: 14px; }
@media (min-width: 768px) { .foo { font-size: 16px; } }
```

---

### A10. Generic, unscoped class names

Ads render on publisher sites where `.container`, `.card`, `.btn` already exist. Unscoped names will be overridden or will override publisher styles.

❌ **Don't:**
```css
.container { ... }
.card { ... }
.btn { ... }
```

✅ **Do:**
```css
.lincx-container { ... }
.lincx-ad-box { ... }
.best-overall-product-btn-visit-site { ... }
.listicle__thumbnail { ... }
```

---

### A11. Missing `target="_blank"` on CTAs

Clicks navigate the user away from the publisher site, which violates most publisher contracts and hurts tracking.

❌ **Don't:**
```html
<a href="{{href}}" data-lincx-cta>Click</a>
```

✅ **Do:** Always include `target="_blank"` on ad CTAs.

---

### A12. Using `{{ }}` (escaped) for fields that contain HTML

`offer_text`, `offer_headline`, `cta_text`, and `offer_disclaimer` routinely contain `<strong>`, `<em>`, `<a>`, and `<br>`. Using `{{ }}` will display `&lt;strong&gt;` as literal text.

❌ **Don't:**
```html
<div class="listicle__content">{{ offer_text }}</div>
```

✅ **Do:**
```html
<div class="listicle__content">{{{ offer_text }}}</div>
```

Conversely: **do** use `{{ }}` (escaped) for URLs, IDs, and alt text to prevent XSS.

---

### A13. Setting `src` directly when lazy loading is expected

Kills the IntersectionObserver lazy-load pipeline and forces every image to load on first paint.

❌ **Don't:**
```html
<img src="{{ src }}" alt="image" />
```
(inside a `.lazy-load` block)

✅ **Do:**
```html
<img data-src="{{ src }}" alt="image" />
```

---

### A14. Hardcoded absolute dates or year values

Templates live in production for months. A hardcoded `© 2024` date tells users the page is stale.

❌ **Don't:**
```html
<p>© 2024 BrandName</p>
```

✅ **Do:**
```html
<p>© <span id="year"></span> BrandName</p>
<script>
  var yearEl = document.getElementById('year')
  if (yearEl) yearEl.textContent = new Date().getFullYear()
</script>
```

---

## 🟡 Code smell / maintenance risk

### A15. Duplicating the `handleCtaListSplits` logic

Multiple copies drift over time. Keep one implementation per template and reuse §3 in `patterns.md` verbatim.

---

### A16. Non-standard breakpoints

Sticking to the canonical set (576 / 768 / 850 / 992 / 1024 / 1200) keeps templates visually consistent across the network. One-off breakpoints like `@media (min-width: 733px)` are a smell.

❌ **Don't:** Invent breakpoints. **Do:** Use the canonical list from `CHECKLIST.md` §7.

---

### A17. Heavy inline `style="..."` attributes

Small overrides (text-decoration on Mustache-wrapped links) are acceptable. Anything beyond 2–3 declarations belongs in CSS.

❌ **Don't:**
```html
<div style="display: flex; align-items: center; gap: 10px; padding: 20px; background: #fff; border-radius: 8px;">
```

✅ **Do:** Move to a scoped class in `styles.css`.

---

### A18. Using `em` where `rem` is expected (or vice versa)

The existing templates mix both, but converging on `rem` for component-level sizing and `em` only inside elements that need to scale with their parent prevents subtle cascade bugs.

Prefer `rem` for padding/margin/gap. Reserve `em` for line-relative tweaks within a text block.

---

### A19. Skipping `alt` on images

A missing or empty `alt` hurts accessibility and SEO on publisher sites.

❌ **Don't:**
```html
<img src="{{src}}" />
```

✅ **Do:** Tie it to the ad content:
```html
<img src="{{src}}" alt="{{ offer_headline }}" />
```

---

### A20. Forgetting the universal CSS reset

Without `* { box-sizing: border-box; margin: 0; padding: 0; }`, default user-agent styles creep in and break visual parity across browsers.

✅ **Always include** the block from `patterns.md` §15.

---

### A21. `console.log` / debug code left in templates

Ads ship to millions of page views. Leftover `console.log('DOM is ready!')` (present in one existing template) floods publisher console. Remove before committing.

---

### A22. Adding features the user didn't ask for

"Should I add a newsletter signup? A cookie banner? Dark mode?" — **no.** Lincx templates are single-purpose conversion surfaces. Extra features hurt CVR and create surface area for bugs.

If uncertain, ask the user; don't assume.

---

### A23. Using `<form>` tags

Ads are not forms. Submitting a form in an ad iframe usually fails silently and the user thinks the click didn't register.

❌ **Don't:** Wrap CTAs in `<form>`.

✅ **Do:** Use plain `<a>` tags with `href` and `target="_blank"`.

---

### A24. Introducing animation libraries or heavy CSS animations

CPU-heavy animations in ads cause jank on mobile and tank viewability. Keep transitions to `opacity`, `background-color`, and simple `transform` with `transition: 0.2s ease` ceiling.

---

### A25. Using `!important` to fight publisher CSS

`!important` is a signal that specificity is unscoped. Prefix classes correctly (§A10) and you won't need it.

The one legitimate use is the universal hide pattern:
```css
[data-content=''] { display: none !important; }
```
because publisher styles can override `display: none`. Outside this case, avoid it.
