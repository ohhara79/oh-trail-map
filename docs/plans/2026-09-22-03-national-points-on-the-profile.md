# Show the national points a trail passes on its elevation profile

## Context

The elevation profile (`src/profilePanel.ts`) shows a trail's elevation over
distance, with a cursor and a readout. It doesn't show where the national points
are. So you can't tell from the chart that K3 is on top of the steep climb, or how
far away the next sign is. The user wants an indicator on the profile.

I measured all 38 trails in `data/gpx/`. The number of points within 10, 20, 30
and 50 m of a track levels off at about **30 m**: most trails pass 10 to 30
points, and a few pass none. Points further out are on other paths.

User's choice: markers on the chart, plus the point's name in the readout. No
snapping, no point-to-point jumping, and unnamed points are included.

## Change

1. **`src/trailProfile.ts`**: add `PointPass = { index: number; point: NationalPoint }`
   and `pointPasses(profile, points): PointPass[]`, cached per profile in a
   WeakMap like `buildProfile`.
   - For each point, first reject it with a cheap lat/lon box test around the
     trail's bounds. Then walk the trail's points with `haversine` (from
     `src/gpx.ts`). Each run of consecutive trail points within
     `PASS_DISTANCE = 30` m of the point counts as one pass. Keep the trail point
     in that run that is closest to the national point. An out-and-back trail
     therefore marks the same point twice, once each way.
   - Return the passes sorted by `index`. Hidden points are not filtered here, so
     the cache stays valid when you toggle points.
2. **`index.html`**: add a `<g class="profile-points"></g>` to `#profile-svg`,
   after `.profile-line` and before `.profile-cursor-line`. The markers then draw
   on the line and under the cursor.
3. **`src/profilePanel.ts`**
   - `show(profile, fileName, passes)` takes the passes.
   - Add `setHiddenPoints(hidden: ReadonlySet<string>)`, which redraws the
     markers and the readout.
   - In `draw()`, add `drawPoints()`. It draws one `<circle r=3.5>` per pass
     whose point is not hidden, at `(x(s[i]), y(ele[i]))`. Where the trail has no
     elevation data, the circle goes on the baseline. Fill it with
     `PIN_COLOR_NAMED` or `PIN_COLOR_UNNAMED` from `src/points.ts`, and give it a
     white ring, so it matches the map pins. The circles take no pointer, so
     scrubbing works over them, which is also why they carry no hover title.
   - In `syncCursor()`, find the visible pass whose point is within
     `PASS_DISTANCE` of the cursor's trail point. If there is one, line 3 shows
     the point's name, or its code if it has no name, in place of
     `#n / N · distance`. It uses the pin colour through a `.profile-point-name`
     class. The name is also added to `aria-valuetext`. Playback moves this
     cursor, so the name also shows while a trail plays.
4. **`src/main.ts`**
   - `syncProfile()` passes `pointPasses(profile, points)`.
   - `syncPoints()` calls `profilePanel.setHiddenPoints(hiddenPoints)`.
   - Call it once at startup, after `hiddenPoints` is built.
5. **`src/style.css`**
   - `.profile-points circle { stroke: #fff; stroke-width: 1.5; }`, with
     `pointer-events: none` so scrubbing still works over the markers.
   - `.profile-point-name`: the pin colour, weight 500.
6. **`README.md`**: in the profile bullet, mention the point markers and the name
   in the readout.
7. Save this plan as
   `docs/plans/2026-09-22-03-national-points-on-the-profile.md`.

## Verification

1. `npm run build`: typecheck and bundle pass.
2. `npm run dev`, then select a trail such as `ohhara_10959058.gpx` (32 points)
   and open the profile. It shows 38 markers for 32 points, because an
   out-and-back section passes some points twice:
   - Amber and grey dots sit on the line where the trail passes points. They line
     up with the pins when you drag the cursor over them on the map.
   - With the cursor on a dot, line 3 shows `K… name`, or the code for a grey
     dot. Moving past the dot brings back `#n / N · distance`.
   - Hide a point in the National Points list: its dot and its name go away.
     Show it again: they come back.
   - Resize the window: the dots redraw in place.
   - In 3D playback, the readout names each point as you pass it.
   - A trail that passes no points (`ohhara_10945237.gpx`) looks unchanged.
3. Commit with the plan doc.
