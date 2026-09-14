# Stop the ground clipping away in 3D walk mode

## Context

While walking in 3D, the ground right in front of the camera sometimes gets cut away
(you see through the terrain near the bottom of the screen). It gets worse since walk
mode became 10× faster (`b24a08c`).

Two things in `src/firstPerson.ts` cause it:

1. **The near clipping plane is ~0.75 m out.** MapLibre sets it to `D·tan(fov/2)/25`,
   where D is the camera-to-centre distance. The walk camera uses `LOOK_DISTANCE = 40`
   and `WALK_FOV = 50`, so anything closer than about 0.75 m (up to ~1 m at the screen
   corners) is not drawn.
2. **The camera can get as low as 0.3 m above the ground.** `place()` smooths the ground
   height with `GROUND_TAU = 0.15 s`. Going uphill, that smoothed height falls behind
   by about `speed × 0.15 × slope`: 1.2 m at 14 m/s on a 30° slope, 4.8 m with Shift.
   So the eye sinks from 1.7 m until it hits the `MIN_CLEARANCE = 0.3` floor. That
   floor is below the near plane, so the slope ahead gets clipped.

(MapLibre's `queryTerrainElevation` already samples the rendered terrain surface, so the
difference between the queried height and the drawn mesh is not the cause.)

**Your question, 1.7 m → 3.0 m?** No. A higher eye only hides the problem at walking
speed. With Shift on a steep climb, the lag (~5 m) still pulls the camera down to the
0.3 m floor. The fix is to move the near plane closer and raise the floor above it.
The 1.7 m eye height stays.

## Change — `src/firstPerson.ts` only

1. **`LOOK_DISTANCE` 40 → 15.** The near plane moves to ~0.28 m (~0.4 m at the corners).
   The camera zoom goes from ~z20.8 to ~z22.2 at a 1080 px tall window, and ~z23.2 at
   2160 px. That is still under `WALK_MAX_ZOOM = 24` (`src/view3d.ts:110`). Trail
   widths in `src/scene3d.ts:151` stay constant on the ground up to z24, so trails look
   the same. Update the module comment's last sentence ("A fixed D of 40 m keeps it
   under a metre") and the `LOOK_DISTANCE` doc comment to match: 15 m gives ~0.3 m, and
   the lower bound is still `maxZoom`.
2. **`MIN_CLEARANCE` 0.3 → 1.0.** This keeps the eye well above the near plane
   (≥ ~2.5× the corner distance), even on steep slopes where the gap between eye and
   slope is only `clearance·cos(slope)`. Walking uphill fast, the camera may still dip
   from 1.7 m toward 1.0 m, but the ground no longer gets cut. Extend its doc comment:
   it has to stay clear of the near plane (see the module comment).
3. **Plan doc** — save this plan as `docs/plans/2026-09-15-06-walk-near-clipping.md`.

The eye heights (`EYE_HEIGHTS`, `index.html` label), `GROUND_TAU`, speed and playback
stay as they are.

## Verification

- `npm run build` passes (type check + bundle).
- `npm run preview`, open 3D → Walk at 1.7 m on a steep part of the mountain:
  - hold W and then Shift+W straight up a steep slope, and across a side slope — the
    ground in front and at the lower corners no longer disappears;
  - look fully down (−80°) while standing and while moving — no hole under your feet;
  - check that trails, point markers and the location marker still draw correctly and
    at the same size, and that nothing flickers (depth precision) at the horizon;
  - cycle to 20 m / 80 m and play a trail with ▶ to confirm nothing else changed.
