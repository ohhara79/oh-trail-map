# National points as floating balls while walking

## Context

[2026-09-17-13](2026-09-17-13-ground-trails-and-points-while-walking.md) painted each
national point as a 7.5 m disc on the ground in walk and playback. The user wants a
**floating 3D ball** there instead: a **1 m** radius ball with its centre **2 m** above
the ground, close to standing eye height (1.7 m), so you aim straight at it. A **ground
shadow** under it marks the spot. Orbit keeps its 5 px dots.

MapLibre has no layer that draws a sphere. A `circle` or `symbol` is a flat billboard, and
a `fill-extrusion` only stacks slabs. So the ball is a custom WebGL2 layer. 3D already
requires WebGL2, so this adds no dependency. With `renderingMode: '3d'`, `drawCustom`
uses `getDepthModeFor3D`, which shares the terrain's depth buffer, so a ridge in front of
a ball hides it.

## Change

### New `src/pointBalls.ts`

1. **`createPointBalls(map, points, hidden)`** returns a custom layer, `point-balls`.
   - **Geometry:** one unit UV sphere (16 × 24), drawn with `drawElementsInstanced`. Each
     instance has a centre and a colour (`PIN_COLOR_NAMED` / `PIN_COLOR_UNNAMED`).
   - **Precision:** mercator runs 0..1, where a float32 is only good to metres. So each
     centre is stored in roughly metres from an origin at the first point, and the
     uniform is `mainMatrix × translate(origin) × scale(meterInMercatorCoordinateUnits)`,
     computed in JS doubles.
   - **Each frame:** each point that isn't hidden sits at `queryTerrainElevation` +
     `BALL_HEIGHT`. A point is skipped while its terrain has not loaded. Redoing this
     every frame picks up finer terrain tiles as they arrive.
   - **Shading:** ambient plus Lambert, lit from a high south-west sun, with a small
     highlight.
2. **`pick(from, yaw, look, pad, keep)`** tests the view ray against the balls, at the
   ground heights they were last drawn at. It works in local east/north/up metres. A ball
   is hit when the ray passes within `BALL_RADIUS + t·tan(pad)` of its centre, and the
   nearest hit wins.

### `src/scene3d.ts`

3. `BALL_RADIUS = 1` and `BALL_HEIGHT = 2` live here, next to the trail metres.
4. The two disc sources and layers are replaced by `point-shadows`, which is
   `pointDiscsGeoJson(points, BALL_RADIUS)`. It is drawn by one draped fill layer,
   `point-shadow`: black at 0.25 opacity, and hidden until walking.

### `src/firstPerson.ts`

5. **`altitude`:** the eye's altitude above sea level, as `place()` last set it. It starts
   at the ground guess plus the start height. This is where the pick ray starts.

### `src/view3d.ts`

6. The ball layer is added on top after `style.load`, starting hidden.
7. **`syncGround()`** swaps the balls and the shadow against the dots.
8. **`syncPoints()`** filters the shadow along with the dots, then calls
   `triggerRepaint()`. The balls read the hidden set as they draw.
9. **`aimedPoint()`** calls `balls.pick` with the walker's pose and altitude, an 8 px
   pad converted to an angle through `WALK_FOV`, and `inReach`.

## Files

| File | Change |
|---|---|
| `src/pointBalls.ts` | new: instanced sphere layer and the ray pick |
| `src/scene3d.ts` | ball constants; the disc layers replaced by a shadow |
| `src/firstPerson.ts` | `altitude` getter |
| `src/view3d.ts` | adds the ball layer; syncGround, syncPoints and aimedPoint |

## Verification

1. `npm run build` passes.
2. `npm run dev`, with National Points on, open **3D**:
   - **Orbit:** unchanged. 5 px dots, and no balls or shadows.
   - **Walk:** each point is a shaded ball floating over a dark disc, with its centre
     just above standing eye level. A ball behind a ridge is hidden.
   - Aim the crosshair at a ball within reach and tap: its popup opens. Hiding the point
     in the panel list removes its ball and shadow.
   - **Playback** looks the same as walk. Esc back to orbit brings back the dots.
