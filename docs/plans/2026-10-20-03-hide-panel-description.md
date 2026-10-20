# Hide the description from the panel

## Context

`data/meta.json`'s description now runs to three long sentences, and
`dableMeta()` (`vite.config.ts:119`) writes it into `#intro`, the first block of
the hamburger panel (`index.html:36`). It pushes Basemap and Trails down, which
costs a lot on a phone.

`#intro` is not only decoration: it carries `itemprop="articleBody"`, which
Dable needs (`docs/plans/2026-10-12-01-dable-meta-tags.md`), and its crawler
runs no script. So the paragraph stays in the served HTML and is only hidden
from view, the usual visually-hidden way (not `display: none`, so crawlers and
screen readers still treat it as page text).

## Change

1. **`src/style.css`** (`.intro`, line 96): replace the muted 12px styling with
   a visually-hidden rule — `position: absolute; width: 1px; height: 1px;
   margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0);
   white-space: nowrap; border: 0;` — and update the comment above it to say
   why it is hidden but kept (Dable's `articleBody`). Keep `.intro:empty
   { display: none; }`. Also drop the `block` class from `#intro` in
   `index.html` so it gets no block border/padding; check `.block` rules in
   `style.css` and that `#panel-body` (or a parent) is positioned so the
   absolute element doesn't escape oddly.
2. **`index.html:34`**: update the comment to say the paragraph is hidden from
   view and kept for Dable.
3. **`README.md:37`**: "The description also shows at the top of the panel as
   the page body" → it is in the page, hidden from view, as the page body.
4. Save this plan as `docs/plans/2026-10-20-03-hide-panel-description.md`.

No change to `data/meta.json` or `vite.config.ts`.

## Verification

1. `npm run build` passes.
2. `dist/index.html` still has `<p id="intro" … itemprop="articleBody">` with the
   description text.
3. `npm run dev`, open the panel on desktop and in a narrow (phone) window: the
   panel starts with Basemap, no gap or stray line where the intro was.
