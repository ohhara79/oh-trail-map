# Travel section and a new publish date

## Context

`data/meta.json` from `2026-10-12-01-dable-meta-tags.md` feeds the
`article:section` and `article:published_time` tags that the `dableMeta()` plugin
writes into the served `<head>` (`vite.config.ts:80-81`). Dable groups items by
section, and `등산` is narrower than the sections it groups pages under. A hiking
record belongs in the broader `여행` section.

`published_time` still says 2026-10-12, the day the meta tags went in. The page
went live with the Dable script (`2026-10-13-01-dable-script.md`) today, so the
date should match that.

## Change

1. `data/meta.json`:
   - `section`: `"등산"` → `"여행"`.
   - `published_time`: `"2026-10-12T00:00:00+09:00"` →
     `"2026-10-13T00:00:00+09:00"`, keeping the ISO 8601 form with the `+09:00`
     offset that Dable asks for.
2. Nothing else. `dableMeta()` reads both fields as they are, and in dev it
   already reloads the page when `meta.json` changes.

## Verification

1. `npm run build` passes.
2. `dist/index.html` has
   `<meta property="article:section" content="여행">` and
   `<meta property="article:published_time" content="2026-10-13T00:00:00+09:00">`.
3. After deploying, `admin.dable.io/tools/meta_test.html` against
   `https://gwanaksan.ohhara.ai/` shows the new section and date.

## Follow-up

- Dable may cache the crawled meta tags; if the old section still shows, ask
  Dable to recrawl the page.
