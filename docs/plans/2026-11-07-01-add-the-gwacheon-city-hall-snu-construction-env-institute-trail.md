# Add the 과천시청 서울대건설환경종합연구소 trail

## Context

Today's hike (2026-11-07, 08:54–17:25 KST) was exported from Ramblr as
`ohhara_11337899.gpx`, trip 11337899. Its track name is
`관악산 과천시청 과천시청능선주변샛길탐방 거북정계곡 자하동천계곡주변샛길탐방 케이블카능선주변샛길탐방 연주암 도림천계곡 서울대건설환경종합연구소`:
a long day from 과천시청, through the side paths around the 과천시청 ridge,
거북정계곡 and 자하동천계곡, up the 케이블카 ridge to 연주암, and down
도림천계곡 to 서울대건설환경종합연구소.

- 3,000 track points, ~10.0 km, ~1,385 m of raw ascent, elevation 73–606 m
- Bounds: lat 37.4288–37.4472, lon 126.9499–126.9877

That box is inside `TILE_BOUNDS` (lat 37.39–37.49, lon 126.90–127.00,
`src/basemaps.ts:27`), so the local OSM, OpenTopoMap and terrain tiles cover it
and no tile refetch is needed.

At about 8.5 hours it hits Ramblr's 3,000-point cap, like the other long trips
(see `2026-10-17-01-add-the-yongma-and-songamsa-trails.md`). The spacing is
still a point every ten seconds or so, which is plenty for the map, the stats
and the 3D playback, so the file is taken as it is. It has no `<wpt>` stamps.

Trails are whatever `.gpx` files are in `data/gpx/` (`src/trailFiles.ts`),
bundled at build time and sorted by file name. So adding the file is the whole
change: no code, no list to update.

## Change

1. **Add the file** as `data/gpx/ohhara_11337899.gpx`, byte-for-byte as Ramblr
   exports it. Keep Ramblr's name, as the other 63 files do, and leave the
   track name as is: it follows the usual `관악산 …` followed by the places in
   order, and the panel shows it as the trail's title.
2. **Leave `data/meta.json` alone.** `published_time` is the page's publish
   date, not a last-updated date, and a new trail doesn't change it.
3. **Stage only that file** plus this plan, and commit them as "Add the
   과천시청 서울대건설환경종합연구소 trail". `backup/` and `log` stay untracked.

## Files

| File | Change |
|---|---|
| `data/gpx/ohhara_11337899.gpx` | New, 3,017 lines, 310 KB |

## Verification

1. Only the new files are staged: `git diff --cached --stat` shows
   `data/gpx/ohhara_11337899.gpx | 3017 +++` and this plan.
2. It is well-formed GPX:
   `python3 -c "import xml.etree.ElementTree as E; E.parse('data/gpx/ohhara_11337899.gpx')"`
   prints nothing, and `grep -c '<trkpt' data/gpx/ohhara_11337899.gpx` → 3000.
3. 64 trails: `ls data/gpx/*.gpx | wc -l` → 64.
4. `npm run build` passes and emits one more GPX chunk under `dist/assets/`.
5. `npm run preview`:
   - The new trail is last in the trail list (it sorts last by file name), with
     its own colour and stats of about 10.0 km and 8 h 31 min.
   - Selecting it and pressing `C` zooms to the stretch from 과천시청 over
     연주암 to the 서울대 campus, with OSM and OpenTopoMap tiles drawn under the
     whole track.
   - Its elevation profile runs ~73–606 m with `ohhara_11337899.gpx` in the
     corner, and ▶ 3D plays it over the terrain.
