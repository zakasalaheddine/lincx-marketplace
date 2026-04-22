# Rendering convention (prose reference)

`CHECKLIST.md` §3 and §5 give the terse rules. This doc is the fuller explanation — read when you need the *why*, or when you hit an edge case.

## Mustache, full spec

Lincx renders templates server-side with Mustache. Every form is in play:

| Form | Meaning |
|---|---|
| `{{ field }}` | Value, HTML-escaped. |
| `{{{ field }}}` | Value, raw (no escaping). Use when the field is pre-authored HTML. |
| `{{#section}}…{{/section}}` | Iteration section. Repeats the block once per array item. |
| `{{.}}` | Current item inside an array section when items are scalars. |
| `{{_index}}` | Zero-based position inside an array section. |
| `{{^section}}…{{/section}}` | Inverted section — renders only when `section` is empty/falsy. Rare; prefer the `data-content` CSS trick for show/hide. |

Whitespace inside `{{ … }}` is ignored — `{{ field }}` and `{{field}}` are equivalent. We typically write the spaced form for readability.

## Escaped vs raw — when to use which

**Escaped (`{{ field }}`):**
- URLs: `href="{{ href }}"` — prevents breaking out of the attribute.
- IDs and selectors: `id="{{ adId }}"`.
- Alt text, plain strings.
- Any value coming from a non-trusted source.

**Raw (`{{{ field }}}`):**
- Fields authored as HTML upstream, where the authoring workflow produces `<strong>`, `<em>`, `<a>`, `<br>` etc. The standard set: `offer_headline`, `offer_text`, `cta_text`, `listicle_headline`, `cta_subtext`, `offer_disclaimer`, `promo`.

When in doubt, use escaped. Rendered `&lt;strong&gt;` in the preview is an unambiguous signal to switch to raw.

## Show/hide is done in CSS, not Mustache

We use data-attribute conditionals rather than Mustache sections for visibility. The canonical snippet:

```html
<div class="thumbnail" data-content="{{ src }}">
  <img data-src="{{ src }}" alt="..." />
</div>
```

```css
[data-content=''] { display: none; }
[data-show]:not([data-show='']) { display: none; }
```

When `src` is empty, Mustache expands to `data-content=""` and CSS hides the block. Why not a Mustache `{{#src}}…{{/src}}` section?

- **HTML structure stays constant.** Script selectors that bind to `.thumbnail` always find the same nodes across ads — lazy-load observers, click handlers, measurement code aren't thrown off by optional branches.
- **Fallback UI is trivial.** Add an element with `data-show="{{ src }}"` to render *only* when `src` is empty. Useful for placeholder images, default headlines.
- **One rule covers every optional field.** The CSS is universal; add `data-content` to any element and it participates.

Use Mustache sections (`{{#…}}`) for **iteration over lists**. Don't use them for show/hide.

## Fields that don't exist

When Mustache encounters `{{ missing_field }}`, it renders an empty string. Combined with the `data-content` trick, this is the safety net — optional fields disappear without error. Don't add `{{^missing_field}}` guards; they're redundant.

## Partials and lambdas

We don't use Mustache partials (`{{> partial }}`) or lambda sections. Every template is self-contained.

## Typos and legacy field names

The canonical field catalog is in `CHECKLIST.md` §6. Use those names verbatim. One known legacy: `listical_headline` is a typo preserved in a single older template (see `example-1`). Do **not** propagate it to new work — use `listicle_headline`.

## Renderer support status (local preview)

The local preview renderer (`scripts/preview-render.mjs`) handles only `{{ var }}` with HTML escape and a custom `{{& var }}` unescape marker. It does NOT parse triple-brace `{{{ var }}}`, sections `{{# }}…{{/ }}`, `{{.}}`, or `{{_index}}`.

Practical impact when previewing a real template locally:
- Escaped fields substitute correctly → CSS/layout previews are accurate.
- Triple-brace tokens and section tags render as literal text.
- Iteration doesn't happen — you see one "ad frame" with `{{#ads}}…{{/ads}}` markers visible.

Use the local preview for **CSS, layout, responsive behaviour, selector correctness**. Verify **content, iteration, and HTML-bearing fields** against a live Lincx render. The renderer upgrade to full Mustache is tracked in `/todo.md`.
