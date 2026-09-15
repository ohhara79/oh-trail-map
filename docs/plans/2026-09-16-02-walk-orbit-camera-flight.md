# Fly the camera between Walk and Orbit

## Context

Switching 3D modes snapped the camera, so it was easy to lose track of where you were.

- **Walk → Orbit**: one `map.jumpTo` to zoom 16, pitch 60. One frame you were on the
  ground, the next high above it, with nothing connecting the two views.
- **Orbit → Walk**: you did fall from up to 600 m, but pitch, field of view and camera
  position all snapped on the first frame. From a flat orbit, the view went from
  straight down to the horizon, seen from somewhere else.

Now both directions are a short, smooth flight. The spot you stand on stays in the
middle of the screen the whole way, and the orbit crosshair (`#crosshair3d`) marks the
same spot.

MapLibre's `easeTo` can't do this. It ignores `elevation` and always eases the centre
down to the terrain (`_prepareElevation` in maplibre-gl 6.9), and it leaves the field of
view alone. The walk camera's centre floats at eye height and uses its own field of view.
So a small tween calls `jumpTo`, which does take `elevation`, on every frame.

## Change

1. **New `src/cameraTween.ts`**
   - `cameraState(map)` reads the centre, zoom, pitch, bearing, centre elevation and fov.
   - `tweenCamera(map, to, onDone)` animates to `to` with ease-in-out, calling
     `setVerticalFieldOfView` and `jumpTo` each frame.
     - Centre, zoom, elevation and fov move in a straight line. Bearing takes the
       shortest turn (`angleDelta`).
     - Duration is `clamp(500 + 90·|Δzoom|, 700, 1600)` ms.
     - Pitch follows the height. Going down its progress is k², going up 1−(1−k)². It
       stays looking down while the camera is high, so the camera never swings low
       behind a slope.
     - `prefers-reduced-motion: reduce` makes it instant.
     - It always ends on a later frame, never inside the call.
   - `finish()` jumps to the end now and calls `onDone` once.
2. **`src/firstPerson.ts`**
   - The camera maths from `place()` moves out into an exported
     `eyeCamera(map, pose, alt, fov?)`. The optional `fov` adjusts the zoom for a field
     of view other than the current one. The flight down starts at orbit's 36.87° but
     has to end on walking's 50°.
   - New `groundHeight` getter.
   - Removed `orbitCameraHeight`.
3. **`src/view3d.ts`**
   - `walkLimits()` / `orbitLimits()` are split out of `startWalking` / `stopWalking`.
     `stopWalking` now returns the pose and ground, and leaves the walk limits in place.
   - **Orbit → Walk**: lift the walk limits, fly to
     `eyeCamera(pose, ground + eye, WALK_FOV)`, then `startWalking` at eye height, so
     there's no fall.
   - **Walk → Orbit**: stop the walker, fly to the pose at zoom 16, pitch 60, at ground
     elevation, then `orbitLimits()`.
   - `settle()` finishes any flight in progress. It runs at the start of `setMode`,
     `walkTrail`, `viewFor2d` and `destroy`, so a press during a flight never leaves a
     mode half set up.
   - Orbit clicks are ignored during a flight.
   - Removed `MAX_DESCENT`.
   - Play from the map keeps its 150 m fall, since the trail can be far away.

## Verification

1. `npm run build` passes.
2. `npm run dev` → 3D:
   - Orbit → Walk from a flat, a tilted and a far-out view dives onto the crosshair
     spot, with no snap when walking takes over.
   - Walk → Orbit rises and pulls back, and where you stood ends under the crosshair.
   - Mode button or Esc during a flight: it settles, then switches. Orbit pitch still
     stops at 85°.
   - Tapping during a flight selects nothing. With reduced motion on, both switches are
     instant.
