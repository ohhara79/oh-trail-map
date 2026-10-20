# Widen the description and bump the published time

## Context

`data/meta.json`'s description reads "오태호의 관악산 등산 지도입니다. 관악산에
있는 위치표지판(국가지점번호판)의 위치도 확인할 수 있습니다." It matches "관악산
등산 지도", but people also search for 등산로, 등산 코스, 산행 지도, 산행 코스,
트레일 지도 and 트레일 코스, and none of those words appear anywhere on the
page. The description is the only text crawlers get, because `dableMeta()`
writes it into `<meta name="description">`, `og:description` and the static
`#intro` body. So the description is the place to add them. It also does not
say what makes the map different from a plain trail guide: the tracks are real
GPX recordings, and the map shows them in both 2D and 3D.

`published_time` is still 2026-10-13. Several trails have been added since then
(까치산공원, 삼익그린뷰 까치산공원, 용마능선, 송암사능선, 관악산공원입구 맨발공원).
Dable reads `article:published_time` to decide how fresh the page is, so it
should move forward with the content.

This is a data change only.

## Change

1. **Append one sentence to `description`** in `data/meta.json`:

   > GPX를 기반으로 관악산의 다양한 등산로, 등산 지도, 등산 코스, 산행 지도,
   > 산행 코스, 트레일 지도, 트레일 코스를 정밀하게 2D/3D로 살펴볼 수 있습니다.

   Keep the first two sentences as they are, so the snippet still opens with
   the title's phrase "오태호의 관악산 등산 지도". `dableMeta()` already copies the
   description into `<meta name="description">` (`vite.config.ts:108`),
   `og:description` (`vite.config.ts:96`) and `#intro` (`vite.config.ts:119`),
   so no code changes.

2. **Set `published_time`** to `2026-10-20T00:00:00+09:00`. It is written out
   as `article:published_time` (`vite.config.ts:102`).

3. Save this plan as `docs/plans/2026-10-20-01-longer-description.md`.

## Files

| File | Change |
|---|---|
| `data/meta.json` | `description` gains one sentence; `published_time` → 2026-10-20 |

## Verification

1. Only those two keys changed: `git diff --stat HEAD -- data/meta.json` shows
   `2 insertions(+), 2 deletions(-)`.
2. The file is still valid JSON:
   `node -e "console.log(require('./data/meta.json').published_time)"` prints
   `2026-10-20T00:00:00+09:00`.
3. `npm run build` passes.
4. In `dist/index.html`, `<meta name="description">`, `og:description` and
   `#intro` all carry the new sentence, and `article:published_time` reads
   `2026-10-20T00:00:00+09:00`.
5. After deploying with `d.sh`, `curl -s https://gwanaksan.ohhara.ai/ | grep -E
   'description|published_time'` shows the new values.

## Follow-up

- The new sentence is a list of keywords, which reads a little stiff in
  `#intro`, the first text a visitor sees in the panel. If it feels too much
  like SEO filler, it could be cut down to two or three of the phrases that
  bring the most traffic.
- Search engines usually cut the snippet at about 80–160 characters, so the
  tail of the list may not show in results. It is still indexed as body text
  through `#intro`.
