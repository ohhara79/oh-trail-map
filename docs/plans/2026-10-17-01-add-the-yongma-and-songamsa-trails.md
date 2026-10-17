# Add the 용마능선 and 송암사능선 trails

## Context

Today's two walks (2026-10-17) were exported from Ramblr as two files, one per
trip:

- **`ohhara_11236002.gpx`**, trip 11236002, 09:00–12:14 KST. Track name
  `관악산 관문체육공원 용마능선주변샛길탐방 용마골`: up from 관문체육공원 in
  과천, along the side paths around 용마능선, and back down through 용마골.
  - 3,000 track points, ~5.6 km, ~570 m of raw ascent, elevation 62–316 m
  - Bounds: lat 37.4401–37.4471, lon 126.9809–126.9939
- **`ohhara_11241108.gpx`**, trip 11241108, 12:50–17:51 KST. Track name
  `관악산 송암사 송암사능선 연주암 학바위능선 서울대건설환경종합연구소`: from
  송암사 up 송암사능선 to 연주암, then down 학바위능선 to the 서울대
  건설환경종합연구소.
  - 3,000 track points, ~7.5 km, ~890 m of raw ascent, elevation 73–612 m
  - Bounds: lat 37.4385–37.4494, lon 126.9495–126.9913

Both boxes are inside `TILE_BOUNDS` (lat 37.39–37.49, lon 126.90–127.00,
`src/basemaps.ts:27`), so the local OSM, OpenTopoMap and terrain tiles cover
them and no tile refetch is needed.

Both files have exactly 3,000 track points, unlike the uneven counts of earlier
exports (2,511 for yesterday's). That looks like Ramblr thinning long trips to a
fixed count on export; the spacing is still a point every few seconds, which is
plenty for the map, the stats and the 3D playback, so the files are taken as
they are.

Trails are whatever `.gpx` files are in `data/gpx/` (`src/trailFiles.ts`),
bundled at build time and sorted by file name. So adding the files is the whole
change: no code, no list to update.

## Change

1. **Add both files** as `data/gpx/ohhara_11236002.gpx` and
   `data/gpx/ohhara_11241108.gpx`, byte-for-byte as Ramblr exported them. Keep
   Ramblr's names, as the other 53 files do, and leave the track names as they
   are: they follow the usual `관악산 …` followed by the places in order, and
   the panel shows them as the trails' titles.
2. **Leave `data/meta.json` alone.** `published_time` is the page's publish
   date, not a last-updated date, and new trails don't change it.
3. **Stage only those two files** plus this plan, and commit them as "Add the
   용마능선 and 송암사능선 trails". `backup/` and `log` stay untracked.

## Files

| File | Change |
|---|---|
| `data/gpx/ohhara_11236002.gpx` | New, 3,017 lines, 309 KB |
| `data/gpx/ohhara_11241108.gpx` | New, 3,018 lines, 310 KB |

## Verification

1. Only the new files are staged: `git diff --cached --stat` shows
   `data/gpx/ohhara_11236002.gpx | 3017 +++`,
   `data/gpx/ohhara_11241108.gpx | 3018 +++` and this plan.
2. Both are well-formed GPX:
   `python3 -c "import xml.etree.ElementTree as E; [E.parse(f) for f in ('data/gpx/ohhara_11236002.gpx','data/gpx/ohhara_11241108.gpx')]"`
   prints nothing, and `grep -c '<trkpt'` on each → 3000.
3. 55 trails: `ls data/gpx/*.gpx | wc -l` → 55.
4. `npm run build` passes and emits two more GPX chunks under `dist/assets/`.
5. `npm run preview`:
   - The two new trails are last in the trail list (11236002, then 11241108),
     each with its own colour. Stats read about 5.6 km / 3 h 14 min and
     7.5 km / 5 h 1 min.
   - Selecting each and pressing `C` zooms to its area — 관문체육공원–용마골
     on the 과천 side, and 송암사–연주암–서울대 on the west — with OSM and
     OpenTopoMap tiles drawn under the whole track.
   - The 송암사능선 trail reaches 연주암 at ~612 m and overlaps the existing
     연주암 trails there; all stay selectable and distinguishable by colour.
   - Elevation profiles run ~62–316 m and ~73–612 m with the file names in the
     corner, and ▶ 3D plays each over the terrain.
