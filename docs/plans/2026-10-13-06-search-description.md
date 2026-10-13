# Put 지도 in the description and add a search description tag

## Context

The page should come up in Korean searches for a map of 관악산, but nothing it
serves says "지도". `data/meta.json`'s description reads "오태호의 관악산 등산
기록", and it only reaches crawlers as `og:description` and as the static
`#intro` body text. There is no `<meta name="description">`, which is the tag
search engines take their result snippet from. `og:description` is for link
previews.

## Change

1. In `data/meta.json`, change `description` to "오태호의 관악산 등산 기록
   지도". `dableMeta()` already copies it into `og:description`
   (`vite.config.ts:78`) and into `#intro` (`vite.config.ts:94`), so the visible
   body text, which search engines do index, gains the word too.

2. In `dableMeta()` (`vite.config.ts:85`), put a
   `<meta name="description" content="…">` from the same `meta.description` ahead
   of the `property=` tags. It sits outside the `tags` list because that list is
   written out with `property=`, and search engines read only `name=`. As with the
   other tags, there is none when `data/meta.json` is missing.

3. Mention the new tag in the plugin's doc comment (`vite.config.ts:44`).

4. Save this plan as `docs/plans/2026-10-13-06-search-description.md`, following
   the repo's plan convention.

## Verification

1. `npm run build` passes.
2. `dist/index.html`'s `<head>` has
   `<meta name="description" content="오태호의 관악산 등산 기록 지도" />` right
   after `<title>`, and `og:description` and `#intro` carry the same text.
3. After deploying with `d.sh`, `curl -s https://gwanaksan.ohhara.ai/ | grep
   description` shows both tags.

## Follow-up

- The `<title>` matters more for ranking than the description, and
  `oh-trail-map (관악산)` has no search word besides the place name. Something
  like `관악산 등산 지도 · oh-trail-map` would match better. It is left as is
  because `applyTitle()` in `main.ts` builds the same string, so changing it
  touches both places.
