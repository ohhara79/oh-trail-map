# Korean page language, a longer description, canonical, sitemap and social tags

## Context

The page is meant to come up in Korean searches for 관악산 and to give good link
previews. A few gaps remain:

- `<html lang="en">` (`index.html:2`) tells search engines the page is English,
  but its title, description, intro and point names are Korean.
- `data/meta.json`'s description is the title word for word, so the search snippet
  adds nothing.
- There is no `<link rel="canonical">`, though `map.ohhara.io` is also an allowed
  host for the same page.
- There is no sitemap, and `robots.txt` doesn't point to one.
- Link previews are missing `og:type`, `og:site_name`, `og:locale`, the image size
  and `twitter:card`.

## Change

1. **Page language.** Change `index.html:2` to `<html lang="ko">`. Move the font
   reason from `popupContent()` (`src/points.ts:150-153`) into a comment there:
   without `ko`, a browser whose default font stack has no Korean face falls back
   to a CJK font and draws Hangul with Japanese glyph shapes. The whole document
   now inherits `ko`, so remove the now-redundant `lang="ko"` from `#intro`
   (`index.html:33`), `#point-list` (`index.html:60-61`, and its comment), and
   `root.lang = 'ko'` in `popupContent()`. The 3D view's popups are in the same
   document, so they inherit it too.

2. **Description.** In `data/meta.json`, set `description` to
   "오태호의 관악산 등산 기록 지도입니다. 관악산에 있는 위치표지판(국가지점번호판)의 위치도 확인할 수 있습니다."
   `dableMeta()` already copies it into `<meta name="description">`,
   `og:description` and `#intro`.

3. **Canonical.** In `dableMeta()`'s `transformIndexHtml` (`vite.config.ts:69`),
   add `<link rel="canonical" href="${meta.url}" />` to the head block.

4. **Social tags.** In the same function:
   - Add `og:type` = `website`, `og:site_name` = the `title` value already
     read from `data/title.txt` (currently "오태호의 관악산 등산 기록 지도"), the
     same value as `og:title`; and `og:locale` = `ko_KR` to the `property=` list.
   - Add `og:image:width` and `og:image:height`, read from the PNG header of
     `public/og.png` (`readUInt32BE(16)` and `readUInt32BE(20)`) so they stay correct
     if the screenshot changes. Leave them out if the file is missing.
   - Add `<meta name="twitter:card" content="summary_large_image" />` next to
     `name="description"`, since `twitter:` tags use `name=`. X falls back to the
     `og:` tags for the title, description and image.

5. **Sitemap and robots.** Move `public/robots.txt` out of `public/` and have
   `dableMeta()` write both files at build time, from a `generateBundle` hook using
   `this.emitFile`:
   - `robots.txt` is always written: `User-agent: *` and `Allow: /`. When
     `meta.json` exists, it also gets `Sitemap: <meta.url>sitemap.xml` (resolved
     with `new URL('sitemap.xml', meta.url)`, as `og:image` already is).
   - `sitemap.xml` is written only when `meta.json` exists. It has one `<url>`
     with `<loc>` = `meta.url` and `<lastmod>` = the build date (YYYY-MM-DD),
     since every deploy replaces `index.html`.

   Both are generated from `meta.url` so the domain lives in one place.

6. **Deploy.** In `d.sh`, upload `dist/sitemap.xml` with
   `--content-type "application/xml" --cache-control "public,max-age=86400"`, next to
   the `robots.txt` line.

7. **Docs.** Update `dableMeta()`'s doc comment (`vite.config.ts:44`) and the
   `meta.json` bullet in `README.md:32-38` to mention the canonical link, the
   social tags, and the generated `robots.txt`/`sitemap.xml`.

8. Save this plan as `docs/plans/2026-10-14-03-seo-lang-canonical-sitemap.md`.

## Files

| File | Change |
|---|---|
| `index.html` | `lang="ko"` on `<html>`; drop the two inner `lang="ko"` |
| `src/points.ts` | drop `root.lang = 'ko'` and its comment |
| `data/meta.json` | new description |
| `vite.config.ts` | canonical, og/twitter tags, emit robots.txt + sitemap.xml |
| `public/robots.txt` | removed (now generated) |
| `d.sh` | upload sitemap.xml |
| `README.md` | describe the new output |

## Verification

1. `npm run build` passes.
2. `dist/index.html` starts with `<html lang="ko">`. Its head has the new
   description, `<link rel="canonical" href="https://gwanaksan.ohhara.ai/" />`,
   `og:type`, `og:site_name`, `og:locale`, `og:image:width` = 1200,
   `og:image:height` = 630 and `twitter:card`.
3. `dist/robots.txt` ends with `Sitemap: https://gwanaksan.ohhara.ai/sitemap.xml`.
   `dist/sitemap.xml` is well-formed XML and has the one URL.
4. Moving `data/meta.json` aside and rebuilding gives a plain `robots.txt`, no
   sitemap and no tags. Then put it back.
5. With `./r.sh`, a national point's popup still renders Hangul in a Korean font
   (it inherits `lang="ko"`).
6. After deploying with `d.sh`, the Facebook Sharing Debugger or a KakaoTalk link
   preview shows the large image. Submit the sitemap in Google Search Console and
   Naver Search Advisor.
