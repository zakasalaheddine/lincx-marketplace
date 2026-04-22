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
- Fields the CAG defines as HTML-bearing — typically authored upstream with `<strong>`, `<em>`, `<a>`, `<br>` markup. Which fields are HTML-bearing depends on the CAG; common examples across the library (not a contract): `offer_headline`, `offer_text`, `cta_text`, `listicle_headline`, `cta_subtext`, `offer_disclaimer`, `promo`. Always verify against the CAG for your template.

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

## Fields come from the CAG, not a universal catalog

There is **no universal field contract** across Lincx templates. Every template is bound to its own `creativeAssetGroup` (CAG), and the CAG defines exactly which fields exist for that template. Two templates of the same visual type routinely have different field names and types.

Implications for substitution:
- Load the CAG via `mcp__claude_ai_Lincx__get_creative_asset_group(id=…)` and use only the fields it returns.
- Whichever fields the CAG defines as HTML-bearing — use `{{{ triple-brace }}}` for those. The HTML-bearing fields vary per CAG.
- Don't port field names between templates. If a CAG uses a legacy typo (e.g. `listical_headline` in one older CAG), keep the typo for *that* template. Don't carry the typo into a different CAG's template.

See `CHECKLIST.md` §6 for more, and the "common fields seen across the library" table it contains — presented for *familiarity*, not as a contract.

## Renderer support status (local preview)

The local preview renderer (`scripts/preview-render.mjs`) handles only `{{ var }}` with HTML escape and a custom `{{& var }}` unescape marker. It does NOT parse triple-brace `{{{ var }}}`, sections `{{# }}…{{/ }}`, `{{.}}`, or `{{_index}}`.

Practical impact when previewing a real template locally:
- Escaped fields substitute correctly → CSS/layout previews are accurate.
- Triple-brace tokens and section tags render as literal text.
- Iteration doesn't happen — you see one "ad frame" with `{{#ads}}…{{/ads}}` markers visible.

Use the local preview for **CSS, layout, responsive behaviour, selector correctness**. Verify **content, iteration, and HTML-bearing fields** against a live Lincx render. The renderer upgrade to full Mustache is tracked in `/todo.md`.
