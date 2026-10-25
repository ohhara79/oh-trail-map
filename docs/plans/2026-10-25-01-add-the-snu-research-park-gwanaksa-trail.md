# Add the 서울대연구공원 서울대관악사운동장 trail

## Context

Today's walk (2026-10-25, 11:13–17:21 KST) was exported from Ramblr as
`ohhara_11278736.gpx`, trip 11278736. Its track name is
`관악산 서울대연구공원 서울대연구공원주변샛길탐방 암반천계곡 전차바위능선 수영장능선 암반천계곡 사당능선 마당바위능선 서울대관악사운동장`:
from 서울대연구공원 through the side paths around it, up 암반천계곡 to
전차바위능선 and 수영장능선, back down 암반천계곡, then over 사당능선 and
마당바위능선 to finish at the 서울대 관악사 playing field.

- 3,000 track points, ~7.1 km, ~880 m of raw ascent, elevation 115–594 m
- Bounds: lat 37.4459–37.4653, lon 126.9568–126.9670

That box is inside `TILE_BOUNDS` (lat 37.39–37.49, lon 126.90–127.00,
`src/basemaps.ts:27`), so the local OSM, OpenTopoMap and terrain tiles cover it
and no tile refetch is needed.

At about six hours it also hits Ramblr's 3,000-point cap, like yesterday's
trip. The spacing is still a point every seven seconds or so, which is enough
for the map, the stats and the 3D playback. It has no `<wpt>` stamps.

Trails are whatever `.gpx` files are in `data/gpx/` (`src/trailFiles.ts`),
bundled at build time and sorted by file name. So adding the file is the whole
change: no code, no list to update.

## Change

1. **Add the file** as `data/gpx/ohhara_11278736.gpx`, byte-for-byte as Ramblr
   exports it. Keep Ramblr's name, as the other 58 files do, and leave the
   track name as is: it follows the usual `관악산 …` followed by the places in
   order (암반천계곡 appears twice because the route goes down it again), and
   the panel shows it as the trail's title, wrapping it as needed
   (`src/style.css:522`).
2. **Leave `data/meta.json` alone.** `published_time` is the page's publish
   date, not a last-updated date, and a new trail doesn't change it.
3. **Stage only that file** plus this plan, and commit them as "Add the
   서울대연구공원 서울대관악사운동장 trail". `backup/` and `log` stay untracked.

## Files

| File | Change |
|---|---|
| `data/gpx/ohhara_11278736.gpx` | New, 3,017 lines, 310 KB |

## Verification

1. Only the new files are staged: `git diff --cached --stat` shows
   `data/gpx/ohhara_11278736.gpx | 3017 +++` and this plan.
2. It is well-formed GPX:
   `python3 -c "import xml.etree.ElementTree as E; E.parse('data/gpx/ohhara_11278736.gpx')"`
   prints nothing, and `grep -c '<trkpt' data/gpx/ohhara_11278736.gpx` → 3000.
3. 59 trails: `ls data/gpx/*.gpx | wc -l` → 59.
4. `npm run build` passes and emits one more GPX chunk under `dist/assets/`.
5. `npm run preview`:
   - The new trail is last in the trail list (it sorts last by file name), with
     its own colour and stats of about 7.1 km and 6 h 8 min.
   - Its long title wraps in the panel rather than overflowing.
   - Selecting it and pressing `C` zooms to the ridges above 서울대, with OSM
     and OpenTopoMap tiles drawn under the whole track.
   - Its elevation profile runs ~115–594 m with `ohhara_11278736.gpx` in the
     corner, and ▶ 3D plays it over the terrain.
