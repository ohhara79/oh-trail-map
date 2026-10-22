# Add the 까치고개경로당 까치산공원 trail

## Context

Today's walk (2026-10-22, 18:50–20:17 KST) was exported from Ramblr as
`ohhara_11262964.gpx`, trip 11262964. Its track name is
`관악산 까치고개경로당 까치산공원 까치산공원주변샛길탐방 관악푸르지오아파트`:
another loop over the low 까치산공원 hill, this time starting from
까치고개경로당 to the east, through 까치산공원 and its side paths, and ending at
관악푸르지오아파트 like the 2026-10-16 trail.

- 2,500 track points, ~4.2 km, ~390 m of raw ascent, elevation 60–148 m
- Bounds: lat 37.4756–37.4860, lon 126.9610–126.9696

That box is inside `TILE_BOUNDS` (lat 37.39–37.49, lon 126.90–127.00,
`src/basemaps.ts:27`), so the local OSM, OpenTopoMap and terrain tiles cover it
and no tile refetch is needed. Its northern edge (37.4860) is a little further
north than the earlier 까치산공원 trails, but still short of 37.49.

It comes in under Ramblr's 3,000-point cap and keeps its own point count.

Trails are whatever `.gpx` files are in `data/gpx/` (`src/trailFiles.ts`),
bundled at build time and sorted by file name. So adding the file is the whole
change: no code, no list to update.

## Change

1. **Add the file** as `data/gpx/ohhara_11262964.gpx`, byte-for-byte as Ramblr
   exports it. Keep Ramblr's name, as the other 56 files do, and leave the
   track name as is: it follows the usual `관악산 …` followed by the places in
   order, and the panel shows it as the trail's title.
2. **Leave `data/meta.json` alone.** `published_time` is the page's publish
   date, not a last-updated date, and a new trail doesn't change it.
3. **Stage only that file** plus this plan, and commit them as "Add the
   까치고개경로당 까치산공원 trail". `backup/` and `log` stay untracked.

## Files

| File | Change |
|---|---|
| `data/gpx/ohhara_11262964.gpx` | New, 2,517 lines, 257 KB |

## Verification

1. Only the new files are staged: `git diff --cached --stat` shows
   `data/gpx/ohhara_11262964.gpx | 2517 +++` and this plan.
2. It is well-formed GPX:
   `python3 -c "import xml.etree.ElementTree as E; E.parse('data/gpx/ohhara_11262964.gpx')"`
   prints nothing, and `grep -c '<trkpt' data/gpx/ohhara_11262964.gpx` → 2500.
3. 57 trails: `ls data/gpx/*.gpx | wc -l` → 57.
4. `npm run build` passes and emits one more GPX chunk under `dist/assets/`.
5. `npm run preview`:
   - The new trail is last in the trail list (it sorts last by file name), with
     its own colour and stats of about 4.2 km and 1 h 27 min.
   - Selecting it and pressing `C` zooms to the 까치산공원 area, with OSM and
     OpenTopoMap tiles drawn under the whole track.
   - Where it overlaps the earlier 까치산공원 trails, all stay selectable and
     distinguishable by colour.
   - Its elevation profile runs ~60–148 m with `ohhara_11262964.gpx` in the
     corner, and ▶ 3D plays it over the terrain.
