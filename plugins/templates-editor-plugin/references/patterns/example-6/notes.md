# example-6 — Listicle with video + featured-vs-all

Listicle variant that adds a video thumbnail branch, an author bio section, and a per-index "featured vs all" card split (first item rendered as a featured card, the rest as compact).

## What this example illustrates

- **Full listicle skeleton** plus video support via `videoSrc` (lazy-loaded like the image branch). See `patterns.md` §11 for lazy-load and §12 for video autoplay.
- **Featured-vs-all per-index** — same idea as `patterns.md` §6, but applied to listicle cards. `listicle-item-{{ _index }}` classes gate featured vs compact rendering.
- **Author bio** — richer than the simple author bar in example-1: avatar + name + date + short bio paragraph.
- "Trending" tag / category badge.

## CAG contract (this template)

`adId`, `listicle_headline`, `offer_headline`, `offer_text`, `imageURL` (alt field for main image), `src`, `src_author`, `author_name`, `href`, `cta_text`, `videoSrc`.

## When to reach for this over example-1

example-6 is the right choice when the CAG provides `videoSrc` and the brief specifies video-capable creative, or when the placement needs a richer author/byline treatment. example-1 is simpler and image-only (video branch is wired but rarely populated).

## Things to preserve when editing

- Keep both `imageURL` and `src` hooked up — some CAGs populate one, some the other; the template tolerates both.
- Don't inline the video autoplay logic per-element — use one `initVideoPlayback()` helper that iterates (see `patterns.md` §12).
