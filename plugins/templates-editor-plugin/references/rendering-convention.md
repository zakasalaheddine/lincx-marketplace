# Rendering convention

> **Stub.** Fill this in from your real templates.

The default renderer uses Mustache-style tokens: `{{field.path}}` (HTML-escaped) and `{{&field.path}}` (unescaped — use for URLs). If your templates use a different tokenization, document it here and drop a `rendering.json` next to this file to override (see `rendering.json.example`).

Populate below with:
- The exact token syntax(es) used in production templates.
- Any loops, conditionals, or helpers the templates rely on.
- Fields that are always expected, and defaults if they're missing.
- Common ad-data fields that map to specific HTML semantics (e.g. `imageUrl` → `<img src>`).
