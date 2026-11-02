# Add the 구세군과천교회 서울대건설환경종합연구소 trail

## Context

Today's walk (2026-11-02, 12:36–17:14 KST) was exported from Ramblr as
`ohhara_11316416.gpx`, trip 11316416. Its track name is
`관악산 구세군과천교회 케이블카계곡 잣골계곡 마당바위능선 연주암 도림천계곡 서울대건설환경종합연구소`:
from 구세군과천교회 up 케이블카계곡 and 잣골계곡, over 마당바위능선 to 연주암,
then down 도림천계곡 to 서울대건설환경종합연구소 on the 서울대 side.

- 3,000 track points, ~6.1 km, ~860 m of raw ascent, elevation 87–597 m
- Bounds: lat 37.4314–37.4473, lon 126.9499–126.9876

That box is inside `TILE_BOUNDS` (lat 37.39–37.49, lon 126.90–127.00,
`src/basemaps.ts:27`), so the local OSM, OpenTopoMap and terrain tiles cover it
and no tile refetch is needed.

At about four and a half hours it again hits Ramblr's 3,000-point cap, like the
2026-10-24 and 2026-10-31 trails. The spacing is still a point every five or six
seconds, which is plenty for the map, the stats and the 3D playback. It has no
`<wpt>` stamps.

Trails are whatever `.gpx` files are in `data/gpx/` (`src/trailFiles.ts`),
bundled at build time and sorted by file name. So adding the file is the whole
change: no code, no list to update.

## Change

1. **Add the file** as `data/gpx/ohhara_11316416.gpx`, byte-for-byte as Ramblr
   exports it. Keep Ramblr's name, as the other 61 files do, and leave the
   track name as is: it follows the usual `관악산 …` followed by the places in
   order, and the panel shows it as the trail's title.
2. **Leave `data/meta.json` alone.** `published_time` is the page's publish
   date, not a last-updated date, and a new trail doesn't change it.
3. **Stage only that file** plus this plan, and commit them as "Add the
   구세군과천교회 서울대건설환경종합연구소 trail". `backup/` and `log` stay
   untracked.

## Files

| File | Change |
|---|---|
| `data/gpx/ohhara_11316416.gpx` | New, 3,017 lines, 310 KB |

## Verification

1. Only the new files are staged: `git diff --cached --stat` shows
   `data/gpx/ohhara_11316416.gpx | 3017 +++` and this plan.
2. It is well-formed GPX:
   `python3 -c "import xml.etree.ElementTree as E; E.parse('data/gpx/ohhara_11316416.gpx')"`
   prints nothing, and `grep -c '<trkpt' data/gpx/ohhara_11316416.gpx` → 3000.
3. 62 trails: `ls data/gpx/*.gpx | wc -l` → 62.
4. `npm run build` passes and emits one more GPX chunk under `dist/assets/`.
5. `npm run preview`:
   - The new trail is last in the trail list (it sorts last by file name), with
     its own colour and stats of about 6.1 km and 4 h 38 min.
   - Selecting it and pressing `C` zooms to the valleys and ridge between
     과천 and 서울대, with OSM and OpenTopoMap tiles drawn under the whole track.
   - Its elevation profile runs ~87–597 m with `ohhara_11316416.gpx` in the
     corner, and ▶ 3D plays it over the terrain.
