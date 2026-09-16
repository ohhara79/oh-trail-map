# Come back from walking at the zoom you left

## Context

Leaving walk mode, or trail playback, for orbit flew the camera to a hard-coded `zoom: 16`
— `src/view3d.ts:604`, the one tween in `setMode('orbit')` that is the only path back up.
So an orbit view at z11 or z19 was thrown away by a round trip through Walk, and you came
back looking from a height you never chose.

Everything else about that return is deliberate and stays: the centre is the spot you
stood on, `pitch: 0` lands flat (`daf7a83`), `bearing: pose.yaw` keeps the way you walked,
and `orbitLimits()` in the flight's `onDone` puts back the orbit handlers, FOV, sky and
`ORBIT_MAX_ZOOM`.

What was missing is that nothing about the orbit camera you left from was stored.
`stopWalking()` (`src/view3d.ts:561-572`) saves the pose and the ground height, and the two
places that leave orbit dropped the zoom on the floor:

- `setMode('walk')`, the `!walker` branch — the Walk button.
- `walkTrail()`, its `!walker` branch — a trail row, including the 2D "walk this trail"
  that opens 3D and plays straight away (`src/main.ts:221`).

Both are covered: the zoom comes back whichever door you left orbit by.

## Change

1. **Remember the zoom, next to the other 3D state**, beside `mode`, `walker`, `following`
   and `tween`:

   ```ts
   /** The zoom orbit had when you last left it, so the flight back up lands on the view
    *  you left rather than a fixed one. MapLibre's zoom, as map.getZoom() gives it.
    *  Only a floor under the first frame here: both ways out of orbit set it fresh. */
   let orbitZoom = map.getZoom();
   ```

   No clamp is needed on the way back: it is taken under `orbitLimits()`, so it is already
   within `ORBIT_MAX_ZOOM`.

2. **Take it as walking begins.** In `setMode('walk')`'s `!walker` branch, next to the
   `map.getCenter()` that seeds the pose and before `walkLimits()` lifts the ceiling to
   `WALK_MAX_ZOOM`; and in `walkTrail()`'s `!walker` branch, before `startWalking()`. Two
   one-line assignments rather than a helper — each sits with the other reads of the orbit
   camera it belongs to.

   The `walker` arms of both are left alone on purpose: playback → walk and walk →
   playback never pass through orbit, so the remembered zoom has to survive them.

3. **Restore it on the way back.** In `setMode('orbit')`'s tween, `zoom: 16` →
   `zoom: orbitZoom`, with a line saying it is the view you left orbit from, over the spot
   you stood on. Nothing else in that state object moves.

`viewFor2d()`'s `zoom: 17` while walking (`src/view3d.ts:812`) is left out: that is the
3D → 2D handover, not the walk → orbit return, and it has no orbit view to come back to.

## Files

| File | Change |
| --- | --- |
| `src/view3d.ts` | `orbitZoom` state; captured in `setMode('walk')` and `walkTrail()`; read by the `setMode('orbit')` tween in place of `16` |

## Verification

1. `npm run build` passes.
2. `npm run dev`, then press 3D and check each return:
   - Zoom orbit well out, press Walk, walk a while and turn, press Walk again: the flight
     ends at that zoom over the spot you stood on, flat and rotated the way you walked.
     Again zoomed right in — it comes back there, not to 16.
   - Esc out of walk rather than pressing the button: the same zoom.
   - From orbit, play a trail from a row, then Esc (playback → walk) and Esc again
     (walk → orbit): back at the zoom orbit had.
   - From 2D, walk a trail from its row, then Esc twice: orbit lands at the zoom 2D was
     at, that being the zoom 3D opened with.
   - Walk → playback → walk → orbit keeps the one zoom the whole way, and a second round
     trip remembers the zoom the first one landed on.
   - After the return, scroll and pinch still stop at the same ceiling (`orbitLimits()`
     runs in `onDone` as before), and a right-button drag still tilts.
