# The GPX point readout while a trail plays in 3D

## Context

`▶` on a trail row flies you to eye height and walks the trail for you. All the playback bar said
was the trail's name and `2.1 km / 8.6 km` (`Hud.setPlayback`, `src/hud3d.ts:131`). Where you
actually were — latitude, longitude, elevation, the time that point was recorded — was nowhere on
screen.

The profile panel (`#profile` / `ProfilePanel`, from 2026-09-18-01) already reads out exactly those
for the GPX point its cursor is on, and already draws over the 3D canvas while walking. It was
switched off during playback by one rule in `src/style.css`. So this shows it there instead and
lets the playback position drive its cursor, rather than inventing a second readout.

The one thing missing was a way to name the point. `buildPath()` (`src/trailPlayback.ts`) drops
points closer together than `MIN_STEP` and walks the gap between two segments; `buildProfile()`
(`src/trailProfile.ts`) keeps every point and adds nothing across a gap. So `playback.s` and
`Profile.s` are different scales — on `ohhara_10710475.gpx`, with 8 segments, 8408 m against
8263 m — and scaling one into the other would name a point a hundred metres from where you stand.

## Change

1. **`src/trailPlayback.ts`**: `Path` gains `point: Int32Array`, the GPX point each path point came
   from, in `buildProfile`'s numbering. `buildPath` walks the same segments in the same order, so a
   counter incremented over every point, kept or dropped, is exactly that numbering — no distance is
   converted through. `distanceAtPoint(path, point)` is the inverse, for a cursor moved on the chart.
2. **`src/trailProfile.ts`**: `indexAtDistance` takes `{ s, total }` rather than a `Profile`, so the
   `Path` is searched by this code instead of by a second copy of the same binary search.
3. **`src/view3d.ts`**: a new `onPlaybackPoint(trailId, index)` option, called from one
   `syncPlaybackPoint()` — from the frame hook, before its early return, so walking reports no point
   the same way playing reports one, and from the end of `setMode()`, since orbit runs no frames.
   It compares before it fires, the way `Hud.setAttitude` does. `seekToPoint(index)` seeks the
   playback and moves no cursor: the next frame reports the point back.
4. **`src/main.ts`**: `playbackTrail` beside `profileOpen` / `profileTrail`. `syncProfile()` takes
   the playing trail over the selected one — during playback the panel *is* the readout, and the
   selection bar that holds its toggle is hidden there — without touching `profileOpen`, so the
   panel returns to the 2D state when playback ends. A cursor moved on the chart while playing is a
   seek, not a cursor move, so the chart, the scrubber and the camera cannot say three different
   things. `applyCursor()` keeps the 3D dot off during playback: it marks the spot the camera is
   standing on, so it would sit on the lens. `close3d()` clears `playbackTrail` itself — it is the
   one way out that never reaches `setMode`.
5. **`src/hud3d.ts`**: `#profile` joins `CHROME`, so a tap on the scene puts the panel away with the
   playback bar and another brings it back. The three matching lists in `style.css` follow.
6. **`src/style.css`**:
   - `#playback3d` gets a fixed `height: 44px` and stretched buttons. Left to itself the bar was
     three different heights — 42px in Chrome, more where the engine draws a taller
     `input[type=range]`, and 57px at 320px where the distance label wrapped under the name (fixed
     with `white-space: nowrap`) — and the panel stacked on it is placed with a number.
   - The panel is no longer hidden in playback; it sits at `bottom: 60px` (10 + 44 + the same 6px
     gap the selection bar gets), with the notices lifted to 64px, and 228px with it open.
   - `#playback3d` is inside `#stage`, which starts where the map does, and `#profile` hangs off
     `#app`, which the panel is part of. Both are centred in what they hang off, so with the panel
     open they sat 155px apart. The playback rule adds `--sidebar-width` back to the panel's left
     inset, and the drawer query takes it off again where the sidebar overlays the map.
7. **`README.md`** and the `#profile` comment in `index.html`.

## Verification

1. `npm run build`: `tsc --noEmit` and `vite build` pass.
2. **The point mapping, over four real files** (`ohhara_10672068`, `_10681045`, `_10703004`,
   `_10710475`), through the dev server: for every path point, `profile.lat/lon[path.point[i]]`
   equals `path.lat/lon[i]` — 0 mismatches out of ~12,000. Over 201 positions per trail,
   point → `distanceAtPoint` → point round-trips unchanged — 0 failures. `path.point` runs from 0 to
   `n − 1`, so `#1` and `#3,000` are both reachable.
3. **Headless Chrome over CDP against the dev server**, 1280×800:
   - Playing the first trail: the panel appears stacked on the playback bar with
     `ohhara_10672068.gpx` in the chart corner and `37.447204, 126.949935` /
     `239.0 m · 2026-06-13 08:58:54` / `#3 / 3,000 · 3 m · +0:11`.
   - Scrubbing the chart to 40% seeks: `#1,039 / 3,000 · 3.41 km · +1:17:08`, and `#scrub3d` moves
     with it. `▶` steps one point. The camera keeps playing.
   - `data-chrome='hidden'`: the panel goes to `opacity 0 / visibility hidden` with the playback bar.
   - Esc to walk with the profile closed: the panel goes, `data-profile` goes, both dots go. With it
     open: the panel stays on `#2,368`, and the 3D dot appears, marking where you stepped off.
     Closing 3D from there leaves the 2D panel and dot on the same point.
   - During playback the 3D dot is absent (`.profile-cursor-marker` count 0 in `#map3d`) and the 2D
     one is there.
   - Measured: bar 44px at `bottom: 10`, panel 158px at `bottom: 60` (6px gap), notice at 228
     (10px gap). Panel and bar both span x 493–1053 — the same box.
4. 320×700 with touch emulated: the bar is still 44px, the stack still 10/60/228, the joystick is
   off in playback, and all three readout lines fit uncut. With the drawer open the panel and the
   bar both span x 12–264.
