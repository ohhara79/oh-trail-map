# Face your heading while following in 3D Walk

## Context

The locate button follows your location in 3D Walk (`2026-09-16-08-locate-while-walking.md`):
each fix moves `walker.pose` through `view3d.panTo()`, and the view direction is left alone.
The user wants following to also turn the view to face the way they are facing.

The heading already reaches the 3D view. `startHeading()` (`src/heading.ts:97`) gives the
compass when it is live, and GPS course while moving otherwise. `main.ts` passes it to
`view3d.setHeading()`, which only rotated the location marker. The 3D view didn't know
whether following was on.

Decisions from the user:
- **Looking around** while following drifts back to your heading after 2 s, the same as
  playback does to the trail ahead.
- **No compass**: use the same `Heading` the marker cone uses, so GPS course while moving.
  With no heading at all, the view stays where it is.

## Change

1. **`src/firstPerson.ts`**: your heading becomes a third base for the view direction,
   alongside playback and the gyroscope (see `frame()`'s doc comment).
   - New `heading: number | null` (written by view3d), `steering`, and `headingYaw`, which
     eases towards `heading` with `HEADING_TAU = 0.3` s. Compass readings arrive in 1° steps
     and jitter.
   - `setSteering(on)` rebases through `rebaseYaw()`, which `setPlayback(null)` shares. On:
     `headingYaw = pose.yaw` and `yawOffset = 0`, so the view swings from where it points
     round to your heading. Off: the offset takes the whole direction, so nothing jumps.
   - `frame()`: while steering outside playback, `baseYaw = headingYaw`. With the gyroscope
     on, the phone only tilts the view, because the compass already turns with it. The
     drift back after `LOOK_HOLD_MS` applies to steering as well, but only for yaw. Your tilt
     is kept.
   - `setGyro()` takes `headingYaw` as the base yaw while steering.
2. **`src/view3d.ts`**: `setFollowing(on)` on `View3d`. `syncSteering()` passes `heading` to
   the walker and turns steering on when `following && mode !== 'playback'`. It is called from
   `setFollowing`, `setHeading`, `setMode`, and `walkTrail`. `startWalking()` sets both on the
   new walker.
3. **`src/main.ts`**: `syncLocateButton()` also calls `view3d?.setFollowing(following)`, and
   `open3d()` passes the current state.
4. **`README.md`**: the Walk locate sentence says you face your heading while following.

## Verification

1. `npm run build` passes.
2. `npm run dev`, then open 3D and Walk. Use DevTools → Sensors to fake a location and an
   orientation (alpha).
   - Click locate: you move to your location and the view swings to the faked heading.
     Change alpha, and the view turns with it smoothly.
   - Drag to look around: following stays on, and 2 s after you let go the view eases back
     to your heading. The tilt stays where you left it.
   - Press W, or click locate off: following stops, the view doesn't jump, and alpha no
     longer turns it.
   - With no orientation override, the view doesn't turn until a moving location gives a
     GPS course.
   - Gyro on (phone), while following: turning the phone turns the view by the compass, and
     tilting follows the phone. Toggling the gyroscope doesn't jump the view.
   - ▶ a trail while following: following stops, and playback steers along the trail. Click
     locate during playback: you're back in Walk, facing your heading.
   - Following in orbit only pans, as before.
