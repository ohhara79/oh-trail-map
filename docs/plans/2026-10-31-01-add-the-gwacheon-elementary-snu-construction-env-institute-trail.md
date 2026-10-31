# Add the 과천초등학교 서울대건설환경종합연구소 trail

## Context

Today's walk (2026-10-31, 09:46–17:20 KST) was exported from Ramblr as
`ohhara_11306459.gpx`, trip 11306459. Its track name is
`관악산 과천초등학교 용마능선 용마능선주변샛길탐방 자하동천계곡 케이블카능선 케이블카능선주변샛길탐방 마당바위능선 연주암 평안의터 도림천계곡 서울대건설환경종합연구소`:
from 과천초등학교 up 용마능선 and its side paths, across 자하동천계곡 to
케이블카능선 and its side paths, over 마당바위능선 to 연주암 and 평안의터, then
down 도림천계곡 to 서울대건설환경종합연구소 on the 서울대 side.

- 3,000 track points, ~8.5 km, ~1,290 m of raw ascent, elevation 65–618 m
- Bounds: lat 37.4345–37.4473, lon 126.9499–126.9940

That box is inside `TILE_BOUNDS` (lat 37.39–37.49, lon 126.90–127.00,
`src/basemaps.ts:27`), so the local OSM, OpenTopoMap and terrain tiles cover it
and no tile refetch is needed.

At about seven and a half hours this is a long trip, so it hits Ramblr's
3,000-point cap, like the 2026-10-24 trail. The spacing is still a point every
nine seconds or so, which is enough for the map, the stats and the 3D playback.
It has no `<wpt>` stamps.

Trails are whatever `.gpx` files are in `data/gpx/` (`src/trailFiles.ts`),
bundled at build time and sorted by file name. So adding the file is the whole
change: no code, no list to update.

## Change

1. **Add the file** as `data/gpx/ohhara_11306459.gpx`, byte-for-byte as Ramblr
   exports it. Keep Ramblr's name, as the other 60 files do, and leave the
   track name as is: it follows the usual `관악산 …` followed by the places in
   order, and the panel shows it as the trail's title. It is the longest name
   yet, but the panel already wraps long names (`src/style.css:522`).
2. **Leave `data/meta.json` alone.** `published_time` is the page's publish
   date, not a last-updated date, and a new trail doesn't change it.
3. **Stage only that file** plus this plan, and commit them as "Add the
   과천초등학교 서울대건설환경종합연구소 trail". `backup/` and `log` stay
   untracked.

## Files

| File | Change |
|---|---|
| `data/gpx/ohhara_11306459.gpx` | New, 3,017 lines, 303 KB |

## Verification

1. Only the new files are staged: `git diff --cached --stat` shows
   `data/gpx/ohhara_11306459.gpx | 3017 +++` and this plan.
2. It is well-formed GPX:
   `python3 -c "import xml.etree.ElementTree as E; E.parse('data/gpx/ohhara_11306459.gpx')"`
   prints nothing, and `grep -c '<trkpt' data/gpx/ohhara_11306459.gpx` → 3000.
3. 61 trails: `ls data/gpx/*.gpx | wc -l` → 61.
4. `npm run build` passes and emits one more GPX chunk under `dist/assets/`.
5. `npm run preview`:
   - The new trail is last in the trail list (it sorts last by file name), with
     its own colour and stats of about 8.5 km and 7 h 34 min.
   - Its long title wraps in the panel rather than overflowing.
   - Selecting it and pressing `C` zooms to the ridges between 과천 and
     서울대, with OSM and OpenTopoMap tiles drawn under the whole track.
   - Its elevation profile runs ~65–618 m with `ohhara_11306459.gpx` in the
     corner, and ▶ 3D plays it over the terrain.
