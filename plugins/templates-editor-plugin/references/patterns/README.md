# Patterns

Each subdirectory here is one pattern. Required files inside:
- `template.html` — the canonical template HTML (Mustache).
- `styles.css` — the canonical stylesheet.
- `notes.md` — when to use, do/don't, known edge cases, data-field contract.

The skill reads `notes.md` first, then `template.html` and `styles.css` as the source of truth for structure and conventions. If a request matches one of these patterns, follow the pattern exactly and respect the rules in `notes.md`. Deviate only for trivially simple changes or when the request isn't covered — per the consult-references rule in the skill.

## Index

| Pattern | Description | Status |
|---|---|---|
| [`example-1`](./example-1/notes.md) | Listicle / article-style multi-ad placement with author bar, media thumbnail, body, CTAs, legal footer, and ShareThis/tracking pixel. | Canonical |
