# Anti-patterns

Things that look right but break. One entry per anti-pattern: what it looks like, why it breaks, what to do instead.

---

## Using Mustache `{{#field}}…{{/field}}` for optional show/hide

**What it looks like:**
```html
{{#src}}<div class="thumbnail"><img src="{{ src }}" /></div>{{/src}}
```

**Why it breaks:**
- The HTML structure changes depending on whether `src` is present. Scripts that bind to `.thumbnail` by selector get inconsistent node lists across ads — lazy-load observers, click handlers, and measurement code get flaky.
- Nested sections make it easy to leave stray whitespace that browsers render.

**Do instead:** use the `data-content` attribute pattern:
```html
<div class="thumbnail" data-content="{{ src }}"><img src="{{ src }}" /></div>
```
```css
[data-content=''] { display: none; }
```
HTML stays consistent, CSS handles visibility, scripts bind to stable selectors.

---

## Using `{{ field }}` (escaped) for a field that's authored as HTML

**What it looks like:**
```html
<h2>{{ listical_headline }}</h2>
```

**Why it breaks:** `listical_headline` is authored HTML (contains `<strong>`, `<em>`, etc.). Single-brace escapes the tags to `&lt;strong&gt;` — readers see literal angle brackets in the rendered page.

**Do instead:** triple-brace for any HTML-bearing field:
```html
<h2>{{{ listical_headline }}}</h2>
```

If you're not sure whether a field is HTML, check the CAG schema or the upstream content workflow. When in doubt, use single-brace (escaped) and view the preview — garbled text is a signal to switch to triple-brace.

---

## Adding an intermediate wrapper between `.lincx-container` and `.listicle`

**What it looks like:**
```html
<div class="lincx-container">
  <div class="listicle-wrapper">    <!-- new grouping wrapper -->
    {{#ads}}
      <div class="listicle">…</div>
    {{/ads}}
  </div>
</div>
```

**Why it breaks:** `initGroupOffer()` uses `document.querySelectorAll('.listicle')` and appends reordered nodes directly to `.lincx-container` via `container.appendChild(listicle)`. An intermediate wrapper means the re-appended nodes land in the wrong parent — visible ads and reordered ads end up in different containers.

**Do instead:** keep `.listicle` as a direct child of `.lincx-container`. If you need grouping, use CSS (e.g. `gap`, `margin`) or a `data-group` attribute on each listicle.

---

## Renaming tokens to "fix" typos or normalize case

**What it looks like:** spotting `listical_headline` in the template and "correcting" it to `listicle_headline`.

**Why it breaks:** token names come from the CAG schema. The runtime substitutes based on exact string match. Renaming in the template without renaming the CAG field means the token renders empty everywhere that field appears.

**Do instead:** leave historical tokens as-is. Renaming is a coordinated CAG + template change, not a one-side cleanup.

---

## Dropping a disclosure block because the page is short

**What it looks like:** "This placement doesn't sell health products, so we can drop the HEALTH DISCLAIMER paragraph."

**Why it breaks:** disclosures are required by legal for the family of placements, not per-ad. Removing one on the grounds of "not relevant to this offer" is not a judgment the template author gets to make.

**Do instead:** keep every disclosure block that exists in the reference pattern unless legal has explicitly approved the change for this template.

---

## Setting `src` instead of `data-src` on lazy-loaded media

**What it looks like:**
```html
<img src="{{ src }}" class="listicle__thumbnail" />
```

**Why it breaks:** the browser starts downloading immediately — defeats the IntersectionObserver-based lazy load, hurts LCP, wastes bandwidth on ads that are below the fold.

**Do instead:**
```html
<img data-src="{{ src }}" alt="…" onerror="this.onerror=null; this.remove();" />
```
The lazy-load script promotes `data-src` → `src` when the parent enters the viewport. Keep the `onerror` so broken images disappear rather than showing a broken-image glyph.

---

## Using the local preview to verify copy correctness

**What it looks like:** reviewing `preview.html` in the browser to confirm headlines, body copy, CTA labels look right.

**Why it breaks:** the local renderer (today) handles only `{{ var }}` tokens. Triple-brace `{{{ var }}}` and Mustache sections (`{{#ads}}…{{/ads}}`) are rendered as literal text. So what you see is NOT what Lincx will render — copy shown in the local preview is incomplete or wrong.

**Do instead:** the local preview is useful for CSS, layout, responsive breakpoints, selector correctness. For **copy**, **iteration**, and **HTML-inside-fields**, verify against a live Lincx render after publishing a version. This constraint lifts when the renderer is upgraded to full Mustache (tracked in `todo.md`).
