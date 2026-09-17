# Only nearby trails and points can be picked while walking

## Context

In 3D Walk and playback, the crosshair picks whatever is drawn within a few pixels of the screen centre: a point within 8 px (`aimedPoint`, `src/view3d.ts:413`) and a trail within 12 px (`aimedTrail`, `:421`). There is no distance limit. At eye height, near the horizon, those few pixels can cover kilometres of ground, and 3D points are drawn at a fixed size however far away they are. So the preview and a tap often land on a trail or point far away, when you meant the one in front of you.

**Recommendation:** give the crosshair a reach, the way a game's "use" key works. Anything farther than the reach gets no preview and can't be tapped. The reach grows with the eye-height button, because from 20 m or 80 m up you look down at ground that is farther away. The chosen reach is **300 m / 600 m / 1.2 km** for eye heights 1.7 m / 20 m / 80 m. Orbit and 2D stay as they are, because there the pointer can go right onto the thing you want.

The preview and the tap already share `walkPickAt()`, so filtering there keeps them in agreement.

## Change

1. **`src/view3d.ts`: constants.** Next to `EYE_HEIGHTS` (`:136`), add `REACH = [300, 600, 1200]`, one entry per eye height, with a comment explaining why the reach scales with height.

2. **`src/view3d.ts`: `inReach(lat, lon)`.** Returns `haversine(walker.pose, { lat, lon }) <= REACH[eyeIndex]`, or `true` when there is no walker. Measure from the ground position (`pose`), so a jump's descent doesn't change the reach.

3. **`pointAt(x, y, r, keep?)`** (`:292`): take an optional filter. Use the first hit whose point passes it, instead of always `hits[0]`. Orbit callers pass no filter and behave as before.

4. **`trailIn(x, y, r, keep?)`** (`:377`): take an optional `(lat, lon) => boolean`.
   - With a filter, skip the `hits.length <= 1` shortcut, so a single far trail is still checked.
   - Count a segment only if at least one of its ends passes the filter. GPX vertices are a few metres apart, so the error at the edge of the reach is negligible.
   - If no vertex passes the filter, the trail is not picked.

5. **`aimedPoint()` / `aimedTrail()`**: pass `inReach`. `walkPickAt()`, `onSceneTap()` and `syncHover()` need no change: the preview, the accent crosshair and the tap all follow the new rule.

6. **Re-check when the eye height changes.** In the `onEye` handler (`:238`), call `scheduleHover()` so the preview updates right away while you stand still.

7. **`README.md`** (Walk bullet, ~line 61): "Aim the crosshair at a point or a trail within reach (300 m standing, 600 m at 20 m, 1.2 km at 80 m) and click or tap to open or select it."

## Verification

1. `npm run build`: typecheck and bundle pass.
2. `npm run dev`, then 3D → **Walk** at 1.7 m:
   - Aim at a trail you are standing on or next to: casing, name and accent crosshair show, and a tap selects it.
   - Aim at a trail or K-point far off near the horizon (over 300 m away): no preview, a plain crosshair, and a click captures the mouse or toggles the controls as it does for empty ground.
   - Walk towards that far point: the preview appears once you are within about 300 m.
   - Where a near and a far trail overlap at the crosshair, the near one is picked.
   - Switch the eye height to 20 m and 80 m: farther trails become pickable right away, without moving.
3. Playback: crossing trails and points ahead preview only once they are in reach.
4. Orbit and 2D: hover and click behave as before, with no distance limit.
