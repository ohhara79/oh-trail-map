# Add the 관악산공원입구 맨발공원 trail

## Context

Today's walk (2026-10-18, 13:16–14:45 KST) was exported from Ramblr as
`ohhara_11246729.gpx`, trip 11246729. Its track name is
`관악산 관악산공원입구 관악산맨발공원 대학동동네숲`: from the 관악산공원 entrance,
through 관악산맨발공원, and on to the 대학동 neighbourhood woods.

- 2,053 track points, ~3.8 km, ~290 m of raw ascent, elevation 111–200 m
- Bounds: lat 37.4636–37.4684, lon 126.9396–126.9480

That box is inside `TILE_BOUNDS` (lat 37.39–37.49, lon 126.90–127.00,
`src/basemaps.ts:27`), so the local OSM, OpenTopoMap and terrain tiles cover it
and no tile refetch is needed.

This is a shorter trip than yesterday's two, so it comes in under Ramblr's
3,000-point cap and keeps its own point count.

Trails are whatever `.gpx` files are in `data/gpx/` (`src/trailFiles.ts`),
bundled at build time and sorted by file name. So adding the file is the whole
change: no code, no list to update.

## Change

1. **Add the file** as `data/gpx/ohhara_11246729.gpx`, byte-for-byte as Ramblr
   exported it. Keep Ramblr's name, as the other 55 files do, and leave the
   track name as is: it follows the usual `관악산 …` followed by the places in
   order, and the panel shows it as the trail's title.
2. **Leave `data/meta.json` alone.** `published_time` is the page's publish
   date, not a last-updated date, and a new trail doesn't change it.
3. **Stage only that file** plus this plan, and commit them as "Add the
   관악산공원입구 맨발공원 trail". `backup/` and `log` stay untracked.

## Files

| File | Change |
|---|---|
| `data/gpx/ohhara_11246729.gpx` | New, 2,071 lines, 212 KB |

## Verification

1. Only the new files are staged: `git diff --cached --stat` shows
   `data/gpx/ohhara_11246729.gpx | 2071 +++` and this plan.
2. It is well-formed GPX:
   `python3 -c "import xml.etree.ElementTree as E; E.parse('data/gpx/ohhara_11246729.gpx')"`
   prints nothing, and `grep -c '<trkpt' data/gpx/ohhara_11246729.gpx` → 2053.
3. 56 trails: `ls data/gpx/*.gpx | wc -l` → 56.
4. `npm run build` passes and emits one more GPX chunk under `dist/assets/`.
5. `npm run preview`:
   - The new trail is last in the trail list (it sorts last by file name), with
     its own colour and stats of about 3.8 km and 1 h 29 min.
   - Selecting it and pressing `C` zooms to the 관악산공원입구–대학동 area, with
     OSM and OpenTopoMap tiles drawn under the whole track.
   - Where it overlaps the existing trails from the 관악산공원 entrance, all stay
     selectable and distinguishable by colour.
   - Its elevation profile runs ~111–200 m with `ohhara_11246729.gpx` in the
     corner, and ▶ 3D plays it over the terrain.
