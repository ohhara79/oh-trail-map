# Elevation profile and GPX points for the selected trail

## Context

Selecting a trail (map click in 2D or 3D, or a row) shows `#selection-bar`: name, distance,
▶ 3D. There was no way to read the GPX data behind the line — where a given fix is, how high,
and when it was recorded.

Nothing new has to be parsed. `Trail.segments` already holds every `trkpt` at full resolution
(`Pt = { lat, lon, ele?, time? }`, `src/gpx.ts:3`), about 3000 per trail, one a second or so.

Three ways to show it were considered: an elevation profile with a scrubber (as Strava and
gpx.studio do), a point stepper with no chart, and a full table of points. The **profile** was
chosen. The chart shows the shape of the climb, so you can find a point by where it is on the
hill. A 3000-row table is hard to find your way through and awkward on a phone. The profile
also steps one point at a time, so it can do what the stepper does. Times are shown in the
**browser's time zone**: the GPX stores UTC, but a hike is remembered by local clock time.

## Change

### `src/trailProfile.ts` — new, pure

- `buildProfile(trail)` flattens every segment, in file order, into `Float64Array`s:
  `lat`, `lon`, `ele` and `time` (NaN where missing) and `s` (distance along). It also returns
  `total`, `eleMin`/`eleMax` and `startTime`, and caches the result in a `WeakMap<Trail, Profile>`,
  as `projected` in `selection.ts` does.
  - Point #n is the n-th `trkpt`. `buildPath()` in `trailPlayback.ts` is **not** reused: it
    drops points closer than 0.5 m, which would renumber them.
  - The jump between two segments adds no distance, as in `computeStats`, so the profile ends at
    the distance the selection bar shows. `startTime` is the earliest `<time>`, the same start
    `computeStats` counts the duration from.
- `indexAtDistance(profile, s)` binary-searches for the nearest point (the pattern from `sampleAt`).
- `formatPointTime(ms)` gives `2026-06-13 08:58:43` from one module-level `Intl.DateTimeFormat`.
  The string is built from `formatToParts`, because `format()`'s punctuation varies between
  engines.
- `formatElapsed(sec)` gives `1:13:22`, or `13:22` under an hour.

### `src/profilePanel.ts` — new, `class ProfilePanel`

Like `pointsList.ts`, it only renders and reports. `onCursor(index)` tells `main.ts` the cursor
moved, and `main.ts` calls `setCursor(index)` back. So the panel, the 2D dot and the 3D dot all
get the cursor from one writer.

- **Chart.** An inline SVG, drawn to the chart's pixel size and redrawn on `ResizeObserver`.
  Each pixel column keeps only its lowest and highest point, in order. That cuts ~3000 points
  down to a few hundred vertices, and a one-fix spike still shows. The chart covers at least
  30 m of elevation (`MIN_ELE_SPAN`), so a flat walk doesn't turn barometer noise into peaks.
  With no `<ele>` at all it draws a flat line and says "No elevation". It is labelled with the
  top and bottom elevation and the total distance (top right, since trails usually start and
  end low).
- **Input.**
  - A mouse scrubs by hovering.
  - Touch and pen scrub by dragging, with pointer capture and `touch-action: none`, so the page
    neither scrolls nor zooms.
  - ◀ ▶ step one point; from no cursor they go to the first point.
  - The chart is focusable, with `role="slider"`. ←/→ step 1 (Shift for 10), PgUp/PgDn 100,
    Home/End go to the ends.
  - The keydown stops propagating, because walking listens for the arrow keys on `window`.
- **Readout.** Always three lines, so the panel keeps the same height. The most important
  information comes first, because a narrow screen cuts a line off at its end:
  1. `37.428699, 126.951647`
  2. `248.9 m · 2026-06-13 10:15:51`
  3. `#1,039 / 3,000 · 3.41 km · +1:17:08` (muted)

  The text can be selected, so values can be copied. Each line carries its full text as a
  `title`.

### `index.html`, `src/style.css`

- `#selection-profile` is a square icon button on the bar, before ▶ 3D. Its `aria-pressed`
  uses the existing `.hud-bar button[aria-pressed='true']` style.
- `#profile` is a `.hud-bar` with the same insets as the bar and a 560px cap, 6px above the
  bar (50px up). Its height is fixed at 158px, so other elements can clear it by a fixed
  amount:
  - `#notices` and the scale bar move to 218px while `data-profile` is set.
    `#app[data-selection][data-profile] #notices` has an extra attribute so it beats
    `#app[data-selection] #notices`, which comes later in the file.
  - While walking on a touch screen, the panel rides on the lifted bar at 194px, and the
    notices sit above it at 362px.
  - The panel is hidden during playback, like the bar.
- At ≤360px the readout drops to 11px and ◀ ▶ get narrower, so on a 320px phone lines 1 and 2
  fit whole. Only the elapsed time at the end of line 3 is cut.
- `.profile-cursor-marker` styles both map dots. Each is filled with the trail's colour, with a
  white ring and a drop shadow.

### `src/selection.ts`

- `nearestPointIndex(map, containerPoint, trail)` returns the flat index of the nearest point,
  or null beyond `tolerance()`. It reuses `projectedSegments()`, so hovering costs no
  re-projection. It measures to the line and then takes the nearer end, so a long stretch
  between two sparse fixes still responds.
- `class ProfileCursor` draws the 2D dot: an `L.circleMarker` with `interactive: false`, in its
  own pane at z-index 590. That is above the pins (580) and below your own location
  (markerPane, 600).

### `src/view3d.ts`

`setProfileCursor(at | null)` shows or hides a MapLibre `Marker` with a DOM dot, as for your
location. It is removed in `destroy()`.

### `src/ui.ts`

The `onToggleProfile` callback, and `setProfileShown(shown)`, which sets the button's
`aria-pressed` and `data-profile` on `#app`.

### `src/main.ts`

- State:
  - `profileOpen` is whether you asked for the panel. It is not persisted and survives a change
    of selection.
  - `profileTrail` is the trail the panel is actually showing.
  - `cursorIndex` is the point the cursor is on.
- `syncProfile()` runs from `refresh()`. Every change of selection ends in a refresh, including
  `setVisible` clearing it without going through `selectTrail`. On a new trail it resets the
  cursor, since a point number means nothing on another trail.
- `setCursor()` is the only writer of `cursorIndex`. `applyCursor()` updates the panel, the 2D
  dot and `view3d?.setProfileCursor`. `open3d()` passes the current cursor on to a new view.
- In 2D, `syncHover()` also moves the cursor when the mouse is near the selected trail and the
  panel is open. It follows the preview's own guards: no 3D, no map moving, a real hover
  pointer, no popup open. **Clicks are unchanged**: a click while something is selected still
  only clears it.

## Verification

1. `npm run build`: `tsc --noEmit` and `vite build` pass.
2. **`buildProfile` under Node against all 36 files in `data/gpx/`** (bundled with esbuild,
   `trkpt`s read by regex, run with `TZ=Asia/Seoul`):
   - The point count equals `computeStats().points` for every file.
   - `total` equals `stats.distance` within 1e-6.
   - The last time minus `startTime` equals `stats.duration`.
   - `indexAtDistance(0)` is 0 and `indexAtDistance(total)` is n−1.
   - A second call returns the cached object.
   - `ohhara_10672068.gpx`: 3000 points, 8534.0 m. The first fix is `37.44718233, 126.94992612`,
     225.32 m, `2026-06-12T23:58:43Z`, shown as `2026-06-13 08:58:43`. The last is +5:27:21.
     Elevation runs 150.33–564.81 m.
3. **Headless Chrome over CDP against `npm run dev`, 1280×800:**
   - Select the first row and press the profile button. The panel shows, `data-profile` is set,
     `aria-pressed` is true, and the readout says "3,000 GPX points".
   - Hover at 40% of the chart gives #1,039 (`37.428699, 126.951647 · 248.9 m ·
     2026-06-13 10:15:51`), and a 2D dot appears on the trail.
   - Focus the chart and press → to go from 1039 to 1040; ◀ goes back to 1039.
   - Move the chart cursor to #2,845, then hover the map on the dot's old spot: it goes back to
     1039, then 1045 and 1078 a few pixels along. (`canHover()` had to be forced true: headless
     Chrome reports no hover pointer.)
   - Open 3D: the marker is at the same screen spot (742,358) as the 2D dot and filled with the
     trail's magenta. Scrubbing moves it.
   - × hides the panel, removes the 3D marker and clears `data-profile`. Back in 2D, the dot and
     the readout are still there.
4. **Phone, 390×844 and 320×844 with touch emulation:**
   - Dragging a finger across the chart scrubs, and the Leaflet map pane's transform doesn't
     change (the map doesn't pan).
   - At 390px all three lines fit.
   - At 320px lines 1 and 2 measure 176/176px and fit. Line 3 is cut after the distance.
5. To check by hand:
   - While walking on a phone, the panel sits above the lifted bar and the joystick is still
     free.
   - Playback hides the panel.
   - A notice raised with the panel open appears above it.

## Follow-up

- Hovering the trail in the **3D** scene doesn't move the cursor. The dot shows there, but you
  scrub from the chart. 3D hover and aim run on their own rules for orbit and walking
  (`syncHover` and `onSceneTap` in `view3d.ts`).
- No export or copy-all of the points.
