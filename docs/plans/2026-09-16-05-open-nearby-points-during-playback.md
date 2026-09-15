# Open nearby national points during 3D playback

## Context

During 3D playback (▶ on a trail) a national point's popup only opened when you aimed the
crosshair at it and tapped (`2026-09-15-19-aim-at-points-while-walking`). The user wants
the popup to open on its own as playback walks past a point, as if it had been tapped.

Measured against `data/gpx/*` and the 272 decoded points: trails that visit a point pass
within 15–20 m of it (5 m: 98, 10 m: 142, 20 m: 156, 50 m: 164), and neighbouring points
are 120 m apart at the median, 50 m at the 10th percentile. So 25 m catches the points a
trail really passes without opening ones it only goes near.

Playback only, as asked. Free walking still opens points by crosshair alone.

## Change

1. **`src/view3d.ts`**
   - `NEARBY = 25` m opens a point, and `NEARBY_RELEASE = 40` m lets it open again. The
     gap keeps a point at the edge from opening over and over.
   - `pointsShown()` is the `LAYER_POINTS` visibility check, taken out of `pointAt()`.
   - `opened`, a set of the points playback has opened. A point stays in it until you are
     more than `NEARBY_RELEASE` away, so one closed with a tap, or closed because it is
     behind you, does not open again in the meantime.
   - `openNearby()` runs from the existing `move` handler in playback, after the
     out-of-view close, so it costs nothing while paused:
     1. nothing without a walker, during a camera flight, or with points hidden;
     2. points in `opened` that are now further than `NEARBY_RELEASE` leave it;
     3. the closest point within `NEARBY`, not in `opened`, that `inWalkView()` accepts.
        Beside or behind you, it would close again on the next frame;
     4. its popup opens, replacing any open one, and it joins `opened`.
     A loop over the ~340 points every frame is cheap, so there is no spatial index.
   - `walkTrail()` clears `opened`, so playing a trail again opens its points again.
   - A tap while a popup is open still only closes it, and leaving playback still
     closes the popup.
2. **`README.md`**: the ▶ bullet mentions points opening on their own.

## Verification

1. `npm run build` passes.
2. `npm run dev`, a trail from `data/gpx` that passes K-numbered points, 3D, ▶:
   - Walking up to a point, its popup opens on its own. It closes once the point is
     behind you, and the next point opens when you reach it.
   - Tapping an auto-opened popup closes it, and it does not reopen while you stay near.
   - At 50× popups still open and close as you pass.
   - With national points turned off, nothing opens.
   - Seeking back past a point, or playing the trail again, opens it again.
   - Free walk: walking past a point opens nothing; aiming and tapping still does.
     Orbit is unchanged.
