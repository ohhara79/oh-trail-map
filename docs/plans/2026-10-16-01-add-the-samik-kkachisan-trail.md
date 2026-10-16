# Add the 삼익그린뷰 까치산공원 trail

## Context

Today's walk (2026-10-16, 19:05–20:22 KST) was exported from Ramblr as
`ohhara_11233194.gpx`, trip 11233194. Its track name is
`관악산 삼익그린뷰아파트 까치산공원 까치산공원주변샛길탐방 관악푸르지오아파트`: a
longer loop over the same low hill as yesterday's 까치산공원 trail, this time
starting from 삼익그린뷰아파트 to the south, through 까치산공원 and its side
paths, and ending at 관악푸르지오아파트.

- 2,511 track points, ~4.2 km, ~400 m of raw ascent, elevation 65–135 m
- Bounds: lat 37.4767–37.4854, lon 126.9611–126.9710

That box is inside `TILE_BOUNDS` (lat 37.39–37.49, lon 126.90–127.00,
`src/basemaps.ts:27`), so the local OSM, OpenTopoMap and terrain tiles cover it
and no tile refetch is needed. Its northern edge (37.4854) is the same spot as
yesterday's trail, well short of 37.49.

Trails are whatever `.gpx` files are in `data/gpx/` (`src/trailFiles.ts`),
bundled at build time and sorted by file name. So adding the file is the whole
change: no code, no list to update.

## Change

1. **Add the file** as `data/gpx/ohhara_11233194.gpx`, byte-for-byte as Ramblr
   exported it. Keep Ramblr's name, as the other 52 files do. The track name is
   left as is. The panel shows it as the trail's title, and it follows the same
   naming as the others (`관악산 …` followed by the places in order), which also
   tells it apart from yesterday's trail (`… 동래정씨사당 까치산공원 …`).
2. **Leave `data/meta.json` alone.** `published_time` is the page's publish
   date, not a last-updated date, and a new trail doesn't change it.
3. **Stage only that file** (`git add data/gpx/ohhara_11233194.gpx`) and commit
   it as "Add the 삼익그린뷰 까치산공원 trail". `backup/` and `log` stay
   untracked.

## Files

| File | Change |
|---|---|
| `data/gpx/ohhara_11233194.gpx` | New, 2,528 lines, 253 KB |

## Verification

1. Only the new file is staged: `git diff --cached --stat` shows just
   `data/gpx/ohhara_11233194.gpx | 2528 +++`.
2. It is well-formed GPX: `python3 -c "import xml.etree.ElementTree as E; E.parse('data/gpx/ohhara_11233194.gpx')"`
   prints nothing, and `grep -c '<trkpt' data/gpx/ohhara_11233194.gpx` → 2511.
3. 53 trails: `ls data/gpx/*.gpx | wc -l` → 53.
4. `npm run build` passes and emits one more GPX chunk under `dist/assets/`.
5. `npm run preview`:
   - The new trail is last in the trail list (it sorts last by file name), with
     its own colour and stats of about 4.2 km and 1 h 17 min.
   - Selecting it and pressing `C` zooms to the 삼익그린뷰–까치산공원 area, with
     OSM and OpenTopoMap tiles drawn under the whole track.
   - It overlaps yesterday's 까치산공원 trail on the hill, and both stay
     selectable and distinguishable by colour.
   - Its elevation profile runs ~65–135 m with `ohhara_11233194.gpx` in the
     corner, and ▶ 3D plays it over the terrain.
