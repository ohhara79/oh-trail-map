# Preview a nearby national point's name from farther away

## Context

Commit 8dd6857 (`2026-09-22-01-preview-nearby-points-while-walking`) shows a
national point's name beside its ball in 3D Walk and playback once you're within
`NEARBY = 25` m of it. The user wants to see it earlier, and chose **100 m**.
That's roughly a minute of walking before you reach the point.

At 100 m a ridge or a hump can hide the ball. Today the only check is
`inWalkView`, which tests whether the point is on screen, so the label could name
a ball you can't see. Points are rarely closer than 50 m to each other, so more
than one point can now be within range. The label still names only the closest
one.

## Change

1. **`src/view3d.ts`**
   - `NEARBY = 100`. Update its comment: this is how far ahead the name shows,
     about a minute of walking.
   - In `nearbyPoint()`'s loop, after the distance, hidden and `inWalkView`
     checks, skip a point whose ball the ground hides. Use the existing
     `inSight(lat, lon, alt)` with
     `alt = map.queryTerrainElevation([lon, lat]) + BALL_HEIGHT`, and skip the
     point if that ground hasn't loaded yet. `inSight` is the same terrain ray
     the crosshair pick uses, so the label and the tap agree on what is visible.
     It runs only for the few points that pass the cheap tests, so walking stays
     smooth.
2. **`README.md`** (Walk bullet): "within 25 m" → "within 100 m", and add "that
   you can see".
3. Save this plan as
   `docs/plans/2026-09-22-02-preview-points-from-farther.md`.

## Verification

1. `npm run build`: typecheck and bundle pass.
2. `npm run dev`, 3D, then Walk towards a K-numbered point:
   - Its name shows from about 100 m away and stays until you pass it or turn
     away.
   - With two points ahead, the closer one is named.
   - A ball behind a ridge gets no label until it comes into sight.
   - Playback stays smooth, and tapping still opens only what the crosshair aims
     at.
3. Commit with the plan doc.
