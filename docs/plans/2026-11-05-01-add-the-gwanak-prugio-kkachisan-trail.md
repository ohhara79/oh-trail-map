# Add the 관악푸르지오아파트 까치산공원 trail

## Context

Today's walk (2026-11-05, 19:22–20:01 KST) was exported from Ramblr as
`ohhara_11327522.gpx`, trip 11327522. Its track name is
`관악산 관악푸르지오아파트 까치산공원 관악푸르지오아파트`: a short evening walk
from 관악푸르지오아파트 over the low 까치산공원 hill and back to the apartments.

- 1,017 track points, ~1.7 km, ~234 m of raw ascent, elevation 64–142 m
- Bounds: lat 37.4831–37.4876, lon 126.9611–126.9646

That box is inside `TILE_BOUNDS` (lat 37.39–37.49, lon 126.90–127.00,
`src/basemaps.ts:27`), so the local OSM, OpenTopoMap and terrain tiles cover it
and no tile refetch is needed.

At about 39 minutes it comes in well under Ramblr's 3,000-point cap and keeps
its own point count. It has no `<wpt>` stamps.

Trails are whatever `.gpx` files are in `data/gpx/` (`src/trailFiles.ts`),
bundled at build time and sorted by file name. So adding the file is the whole
change: no code, no list to update.

## Change

1. **Add the file** as `data/gpx/ohhara_11327522.gpx`, byte-for-byte as Ramblr
   exports it. Keep Ramblr's name, as the other 62 files do, and leave the
   track name as is: it follows the usual `관악산 …` followed by the places in
   order, and the panel shows it as the trail's title.
2. **Leave `data/meta.json` alone.** `published_time` is the page's publish
   date, not a last-updated date, and a new trail doesn't change it.
3. **Stage only that file** plus this plan, and commit them as "Add the
   관악푸르지오아파트 까치산공원 trail". `backup/` and `log` stay untracked.

## Files

| File | Change |
|---|---|
| `data/gpx/ohhara_11327522.gpx` | New, 1,034 lines, 105 KB |

## Verification

1. Only the new files are staged: `git diff --cached --stat` shows
   `data/gpx/ohhara_11327522.gpx | 1034 +++` and this plan.
2. It is well-formed GPX:
   `python3 -c "import xml.etree.ElementTree as E; E.parse('data/gpx/ohhara_11327522.gpx')"`
   prints nothing, and `grep -c '<trkpt' data/gpx/ohhara_11327522.gpx` → 1017.
3. 63 trails: `ls data/gpx/*.gpx | wc -l` → 63.
4. `npm run build` passes and emits one more GPX chunk under `dist/assets/`.
5. `npm run preview`:
   - The new trail is last in the trail list (it sorts last by file name), with
     its own colour and stats of about 1.7 km and 39 min.
   - Selecting it and pressing `C` zooms to 까치산공원 and the apartments beside
     it, with OSM and OpenTopoMap tiles drawn under the whole track.
   - Its elevation profile runs ~64–142 m with `ohhara_11327522.gpx` in the
     corner, and ▶ 3D plays it over the terrain.
