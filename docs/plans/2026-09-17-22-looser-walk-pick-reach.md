# Points you can see, and trails much further off, can be picked while walking

## Context

When walking, the crosshair can only pick things within `REACH = [50, 100, 200]` m, one value per eye height (`src/view3d.ts:146`, `inReach()` at `:477`). That limit went in when trails were thin lines and points were fixed-size dots. Now trails are 3 m wide on the ground and points are 1 m balls, so the user wants the limit much looser or gone. We chose to split it:

- **Balls: no distance limit.** A ball is a real object, so if you can see it you can aim at it. Removing the limit exposes a hole, though: `pick()` in `src/pointBalls.ts` doesn't check terrain, so a ball hidden behind a ridge could still be picked. We add a line-of-sight check.
- **Trails: a much looser limit that grows with eye height, 150 m / 1 km / 5 km.** A 3 m trail crossing your view is still under a pixel tall once it is far off at standing height. What makes it pickable is the ±12 px tolerance around the crosshair. From 1.7 m, that box reaches the horizon for any aim beyond about 120 m, so a tap on bare ground could pick a trail across the valley. From 20 m that only happens beyond about 1.4 km, and from 80 m beyond about 5.7 km. The limits roughly follow these distances.

## Change

### `src/view3d.ts`

1. **`REACH` → `TRAIL_REACH = [150, 1000, 5000]`.** Rewrite the comment: the crosshair's 12 px tolerance spans kilometres of ground once its top edge is past the horizon, which from eye height `h` happens about `70·h` metres out. Only trails need a reach. A ball is picked by the ray itself, so a ball needs line of sight instead (step 3).
2. **`inReach()` → `inTrailReach()`** reads `TRAIL_REACH[eyeIndex]`. `aimedTrail()` passes it as before.
3. **`aimedPoint()`** passes a new `inSight(lat, lon, alt)` instead of `inReach`. It returns true when the ball's centre can be seen:
   - Project the centre with `balls.project(lon, lat, alt)`. If that returns null, return true, because `pick()` has already required the ball to be in front of you.
   - Cast a terrain ray through that pixel with `map._camera.transform.screenTerrainPointToMercatorCoordinate(p, map.terrain)`. It is in the typings and returns null when the ray meets only sky. Use the same `map._camera` access as the `maxPitchScaleFactor` patch.
   - Null means nothing is in the way: return true. Otherwise compare the ground hit's `haversine` from `walker.pose` with the ball's. The ball is hidden when the ground is nearer than the ball by more than `BALL_RADIUS`. The slack is fixed rather than a share of the distance, so a ridge that hides a ball far off still blocks it. No extra slack is needed for coarse DEM tiles: the ray is cast against the same terrain tiles that are drawn, which are what hide the ball on screen.
   - The ray aims at the centre, which floats 2 m up, so on open ground it passes over the ball's own spot and hits terrain behind it. Only a ridge or a slope in front stops it short.
4. **README** Walk bullet (`README.md:60`): "within reach (50 m standing, 100 m at 20 m, 200 m at 80 m)" → "Aim the crosshair at a point you can see, or a trail within reach (150 m standing, 1 km at 20 m, 5 km at 80 m), …".

### `src/pointBalls.ts`

5. **`pick(from, yaw, look, pad, keep)`:** `keep` becomes `(lat, lon, alt) => boolean`, where `alt` is the ball centre's height above sea level (`grounds[i] + BALL_HEIGHT`). It is called **after** the ray test and the `t < bestT` check, not before. That way the terrain ray only runs for the few balls the crosshair actually hits, not for hundreds each tap. A nearer ball that is hidden is skipped, and a farther visible one can still win.
6. Update the doc comment on `pick` and the "the reach is a few hundred metres at most" comment. The local flat metres stay accurate at kilometres: MapLibre's terrain is itself flat in mercator, and `cos(lat)` barely changes over a few km.

### Repo plan doc

7. Save this plan as `docs/plans/2026-09-17-22-looser-walk-pick-reach.md`.

## Verification

1. `npm run build`: typecheck and bundle pass.
2. `npm run dev`, then 3D → **Walk** at 1.7 m:
   - Aim at a ball a few hundred metres away in open view and tap: its popup opens. Before this change it didn't.
   - Stand where a ridge hides a ball, aim at where it would be, and tap: nothing opens. Try this both close (under 50 m, behind a small hump) and far (hundreds of metres). Walk over the ridge until the ball shows, then tap again: it opens.
   - A ball whose top just peeks over a crest, with its centre still hidden, can't be picked. That's the intended strict side.
   - A trail about 100 m ahead can be picked. A trail 300 m off can't, and a tap near the horizon doesn't select one across the valley.
   - A trail right in front of you and one 10–15 m ahead can still be picked (the `maxPitchScaleFactor` fix still holds).
   - At 20 m and 80 m, trails up to about 1 km and 5 km can be picked.
3. Orbit and 2D behave as before, with no reach.
