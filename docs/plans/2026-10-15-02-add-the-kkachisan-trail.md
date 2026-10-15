# Add the 까치산공원 trail

## Context

Today's walk (2026-10-15, 20:11–20:36 KST) was exported from Ramblr as
`ohhara_11228987.gpx`, trip 11228987. Its track name is
`관악산 동래정씨사당 까치산공원 까치산공원주변샛길탐방 관악푸르지오아파트`: a short
loop on the low hill north of the mountain, from 동래정씨사당 through
까치산공원 and its side paths to 관악푸르지오아파트.

- 778 track points, ~1.3 km, ~150 m of raw ascent, elevation 52–114 m
- Bounds: lat 37.4837–37.4859, lon 126.9616–126.9672

That box is inside `TILE_BOUNDS` (lat 37.39–37.49, lon 126.90–127.00,
`src/basemaps.ts`), so the local OSM, OpenTopoMap and terrain tiles cover it
and no tile refetch is needed. Being near the northern edge (37.49), it should
be checked on the map, not just assumed.

Trails are whatever `.gpx` files are in `data/gpx/` (`src/trailFiles.ts`),
bundled at build time and sorted by file name. So adding the file is the whole
change: no code, no list to update.

## Change

1. **Add the file** as `data/gpx/ohhara_11228987.gpx`, byte-for-byte as Ramblr
   exported it. Keep Ramblr's name, as the other 51 files do. The track name is
   left as is. The panel shows it as the trail's title, and it already uses the
   same naming as the others (`관악산 …` followed by the places in order).
2. **Leave `data/meta.json` alone.** `published_time` is the page's publish
   date, not a last-updated date, and a new trail doesn't change it.
3. **Stage only that file** (`git add data/gpx/ohhara_11228987.gpx`) and commit
   it as "Add the 까치산공원 trail". `backup/` and `log` stay untracked.

## Files

| File | Change |
|---|---|
| `data/gpx/ohhara_11228987.gpx` | New, 795 lines, 80 KB |

## Verification

1. Only the new file is staged: `git diff --cached --stat` shows just
   `data/gpx/ohhara_11228987.gpx | 795 +++`.
2. It is well-formed GPX: `python3 -c "import xml.etree.ElementTree as E; E.parse('data/gpx/ohhara_11228987.gpx')"`
   prints nothing, and `grep -c '<trkpt' data/gpx/ohhara_11228987.gpx` → 778.
3. 52 trails: `ls data/gpx/*.gpx | wc -l` → 52.
4. `npm run build` passes and emits one more GPX chunk under `dist/assets/`.
5. `npm run preview`:
   - The new trail is last in the trail list (it sorts last by file name), with
     its own colour and stats of about 1.3 km and 25 min.
   - Selecting it and pressing `C` zooms to the 까치산공원 area, with OSM and
     OpenTopoMap tiles drawn under the whole track (no blank edge near 37.49).
   - Its elevation profile runs ~52–114 m with `ohhara_11228987.gpx` in the
     corner, and ▶ 3D plays it over the terrain.
