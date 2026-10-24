# Add the 과천초등학교 자운암 trail

## Context

Today's walk (2026-10-24, 09:43–17:40 KST) was exported from Ramblr as
`ohhara_11272511.gpx`, trip 11272511. Its track name is
`관악산 과천초등학교 온온사주변샛길탐방 과천시청능선 케이블카능선 모정의바위능선 도림천계곡 자운암`:
from 과천초등학교 through the side paths around 온온사, up 과천시청능선 and
케이블카능선, across 모정의바위능선, then down 도림천계곡 to 자운암 on the
서울대 side.

- 3,000 track points, ~9.3 km, ~1,100 m of raw ascent, elevation 64–639 m
- Bounds: lat 37.4301–37.4509, lon 126.9523–126.9942

That box is inside `TILE_BOUNDS` (lat 37.39–37.49, lon 126.90–127.00,
`src/basemaps.ts:27`), so the local OSM, OpenTopoMap and terrain tiles cover it
and no tile refetch is needed.

At almost eight hours this is a long trip, so it hits Ramblr's 3,000-point cap,
like the 2026-10-17 pair. The spacing is still a point every ten seconds or so,
which is enough for the map, the stats and the 3D playback.

It also carries two `<wpt>` stamps from 경기옛길 삼남길 제1길 (과천향교 and
온온사), as 38 of the existing files do. The app reads only the track, so they
are kept as exported and ignored.

Trails are whatever `.gpx` files are in `data/gpx/` (`src/trailFiles.ts`),
bundled at build time and sorted by file name. So adding the file is the whole
change: no code, no list to update.

## Change

1. **Add the file** as `data/gpx/ohhara_11272511.gpx`, byte-for-byte as Ramblr
   exports it. Keep Ramblr's name, as the other 57 files do, and leave the
   track name as is: it follows the usual `관악산 …` followed by the places in
   order, and the panel shows it as the trail's title. It is the longest name
   yet, but the panel already wraps long names (`src/style.css:522`).
2. **Leave `data/meta.json` alone.** `published_time` is the page's publish
   date, not a last-updated date, and a new trail doesn't change it.
3. **Stage only that file** plus this plan, and commit them as "Add the
   과천초등학교 자운암 trail". `backup/` and `log` stay untracked.

## Files

| File | Change |
|---|---|
| `data/gpx/ohhara_11272511.gpx` | New, 3,019 lines, 309 KB |

## Verification

1. Only the new files are staged: `git diff --cached --stat` shows
   `data/gpx/ohhara_11272511.gpx | 3019 +++` and this plan.
2. It is well-formed GPX:
   `python3 -c "import xml.etree.ElementTree as E; E.parse('data/gpx/ohhara_11272511.gpx')"`
   prints nothing, and `grep -c '<trkpt' data/gpx/ohhara_11272511.gpx` → 3000.
3. 58 trails: `ls data/gpx/*.gpx | wc -l` → 58.
4. `npm run build` passes and emits one more GPX chunk under `dist/assets/`.
5. `npm run preview`:
   - The new trail is last in the trail list (it sorts last by file name), with
     its own colour and stats of about 9.3 km and 7 h 57 min.
   - Its long title wraps in the panel rather than overflowing.
   - Selecting it and pressing `C` zooms from 과천 over the ridge to 자운암,
     with OSM and OpenTopoMap tiles drawn under the whole track.
   - Its elevation profile runs ~64–639 m with `ohhara_11272511.gpx` in the
     corner, and ▶ 3D plays it over the terrain.
