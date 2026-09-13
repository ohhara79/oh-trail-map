# Stop naming 관악산 / 삼성산 in the source

## Context

The app has no functional tie to 관악산 / 삼성산 — the map starts at the world view or
your location, trails come from `data/gpx/`, and the 국가지점번호 layer draws whatever
rows `data/national_points_w_name.tsv` holds. But the panel hint, README and code
comments still described it as a 관악산 / 삼성산 map, so swapping in another area's TSV
would leave wrong text behind. The source now describes the point layer generically.

Left alone on purpose: `data/national_points_w_name.tsv` (the data itself — 관악구 is a
real 시군구 column value) and `docs/plans/2026-09-13-0[1-4]*.md` (dated history).

## Change

1. **`index.html`** — the points hint reads `Emergency location markers.`
2. **`README.md`** — the feature bullet says the points come from
   `data/national_points_w_name.tsv` instead of "337 … around 관악산 / 삼성산". The count
   went too: it is tied to the dataset and was already stale (273 rows since the
   off-mountain drop).
3. **`src/nationalPoint.ts`** — the grid-origin comment keeps its two check decodes
   (`다사52414090`, `다사49013778`) but no longer names the places they land on.
4. **`src/points.ts`** — the marker comments say "hundreds" / "the popup DOM trees"
   instead of 337, and "where the points are dense" / "crowd together" instead of the
   관악산 ridge.

## Verification

1. `git grep -nE '관악산|삼성산' -- src index.html README.md` — no output.
2. `npm run build` — typecheck and build pass.
3. `npm run dev`, open the panel: the points hint reads "Emergency location markers.";
   toggling points still draws the pins and popups open.
