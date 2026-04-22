# Rendering convention

Lincx templates use **full Mustache syntax** at runtime. This is the authoritative reference. If a pattern under `patterns/` deviates, the pattern's `notes.md` must flag it.

## Token forms

| Form | Meaning | When to use |
|---|---|---|
| `{{ field }}` | HTML-escaped value | Plain text, attribute values, anything that must not inject HTML |
| `{{{ field }}}` | Unescaped value | Fields that contain pre-authored HTML (e.g. `listical_headline`, `offer_headline`, `offer_text`) |
| `{{#section}}…{{/section}}` | Section / iteration | Repeat the enclosed block once per item in the array (e.g. `{{#ads}}…{{/ads}}`) |
| `{{.}}` | Current item | Inside an array section where items are scalars (e.g. `{{#cta_list}}{{.}}{{/cta_list}}`) |
| `{{^section}}…{{/section}}` | Inverted section | Render when `section` is falsy/empty — rare in our templates; prefer the data-attribute CSS trick below |

Whitespace inside `{{ … }}` is allowed and ignored — `{{ field }}` and `{{field}}` mean the same thing.

## Show/hide is done in CSS, not Mustache

Our templates prefer **data-attribute-driven** conditional rendering over Mustache sections for visibility:

```html
<div class="thumbnail" data-content="{{ src }}">
  <img src="{{ src }}" />
</div>
```

```css
[data-content=''] { display: none; }
[data-show]:not([data-show='']) { display: none; }
```

When `src` is empty, Mustache renders `data-content=""` and CSS hides the block. The JS-side event handlers don't need to know about the conditional. This is preferred over `{{#src}}…{{/src}}` because:
- HTML structure stays consistent, so scripts (lazy-load observers, etc.) can bind selectors reliably.
- Fallback elements can be toggled with the inverse `data-show` pattern.

Use Mustache sections (`{{#…}}…{{/…}}`) for **iteration over lists**, not for show/hide.

## Fields that are always expected (typical CAG contract)

Patterns will vary, but across our current templates the ad-level fields you'll see include:
- `adId`, `groupOffer`
- `listical_headline`, `offer_headline`, `offer_text` (all HTML, triple-brace)
- `author_name`, `src_author`
- `src`, `videoSrc`, `href`
- `cta_text`, `cta_list`

The exact contract is defined per template by the `creativeAssetGroup` it's bound to. Check the CAG schema via `get_creative_asset_group(id=…)`.

## Helpers / partials

We do not use Mustache partials (`{{> partial }}`) or lambdas in templates. Every template is self-contained.

## Renderer support status (important)

The local preview renderer (`scripts/preview-render.mjs`) currently supports **only** `{{ var }}` with HTML escape and a custom `{{& var }}` unescape marker — it does NOT handle triple-brace `{{{ var }}}` or sections `{{# }}…{{/ }}`. For templates that use full Mustache (that's all our real templates), preview is **degraded**: escaped fields render fine, triple-brace tokens and sections render as literal text.

Until the renderer is upgraded to full Mustache (tracked in `todo.md`), previewing real templates shows correct CSS/layout but incorrect content iteration and HTML-inside-fields. For layout work this is fine. For copy work, verify against the live Lincx render.
