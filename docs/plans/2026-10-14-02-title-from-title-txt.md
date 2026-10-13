# Use data/title.txt as the whole page title

## Context

The title was `oh-trail-map (관악산)`, whose only search word is the place
name. `data/title.txt` now reads "오태호의 관악산 등산 기록 지도", which matches
searches better, but wrapped as `oh-trail-map (…)` it gets too long, and the
panel heading has no room for it. So title.txt becomes the whole title, with
`oh-trail-map` only as the fallback, and the panel heading is always plain
`oh-trail-map`.

## Change

1. `applyTitle()` in `src/main.ts` sets `document.title` to title.txt, or
   `oh-trail-map` when it is empty. It no longer touches the panel heading:
   `index.html`'s `<h1>oh&#8209;trail&#8209;map</h1>` already shows the name.

2. `dableMeta()` in `vite.config.ts` builds the static `<title>` and `og:title`
   the same way, so crawlers see what the tab shows.

3. `README.md` describes title.txt as the page title and the fallback.

4. Save this plan as `docs/plans/2026-10-14-02-title-from-title-txt.md`.

## Verification

1. `npm run build` passes, and `dist/index.html`'s `<title>` and `og:title` read
   "오태호의 관악산 등산 기록 지도".
2. `npm run dev`: the tab shows the new title; the panel heading reads
   `oh-trail-map`.
3. With `data/title.txt` empty, the tab and `<title>` read `oh-trail-map`.
