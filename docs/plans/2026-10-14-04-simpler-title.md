# Drop 기록 from the title and description

## Context

`data/title.txt` reads "오태호의 관악산 등산 기록 지도", and `data/meta.json`'s
description opens with the same words. People search for "관악산 등산 지도", but
기록 splits that phrase in two, so the title never contains it as an unbroken
match. Few people search for "등산 기록 지도". A shorter title also spreads less
weight over words that bring no traffic. The description already says the map is
오태호's, so readers can still tell it is a personal map, not an official trail
guide.

## Change

1. `data/title.txt` becomes "오태호의 관악산 등산 지도". `applyTitle()` in
   `src/main.ts` and `dableMeta()` in `vite.config.ts` already use it as the
   whole `<title>` and `og:title`, so no code changes.

2. `data/meta.json`'s `description` becomes "오태호의 관악산 등산 지도입니다.
   관악산에 있는 위치표지판(국가지점번호판)의 위치도 확인할 수 있습니다.", so
   the result snippet repeats the title's phrase. `dableMeta()` copies it into
   `<meta name="description">`, `og:description` and `#intro`.

3. Update the title.txt example in `README.md` to match.

4. Save this plan as `docs/plans/2026-10-14-04-simpler-title.md`.

## Verification

1. `npm run build` passes.
2. In `dist/index.html`, `<title>` and `og:title` read "오태호의 관악산 등산
   지도", and `<meta name="description">`, `og:description` and `#intro` carry the
   new description.
3. After deploying with `d.sh`, `curl -s https://gwanaksan.ohhara.ai/ | grep -E
   '<title>|description'` shows the new text.

## Follow-up

- Search engines give more weight to the start of a title, and "오태호의" is not
  a search word. `관악산 등산 지도 - 오태호` would put the keywords first. Also,
  "국가지점번호" is a query with little competition that this page answers, and
  it could go in the title. Both are left for now. This change only removes the
  word that breaks up the phrase.
