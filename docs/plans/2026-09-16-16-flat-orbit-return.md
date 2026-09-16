# Come back from walking looking straight down

## Context

`06f1eca` made 3D open flat and north-up, like 2D and the compass reset, but left the
walk → orbit return tilted: the flight up ended at `ORBIT_PITCH = 60`, on the reasoning
that "leaving walk mode at zoom 16 looking straight down would lose the direction you were
facing". It does not — the bearing carries that on its own, and the user expects orbit to
be orbit whichever door they came in by.

The tilt came from one place, the tween target in `setMode('orbit')`
(`src/view3d.ts:594-618`), the only path back up from walk or playback. Everything else
about orbit is already set by `orbitLimits()` in the flight's `onDone`.

## Change

1. **`src/view3d.ts`, the walk → orbit tween.** `pitch: ORBIT_PITCH` → `pitch: 0`, with a
   comment saying it lands flat like the view 3D opens with, and that the bearing still
   holds the way you walked. `bearing: pose.yaw` is unchanged.
2. **Drop `ORBIT_PITCH`.** That tween was its only use, so the constant and its comment go
   with it. `ORBIT_MAX_PITCH` stays: dragging can still tilt.

`stopWalking()`'s note that the flight starts past the orbit pitch limit still holds —
walking sits at pitch 90 against `ORBIT_MAX_PITCH` 85, which is why `orbitLimits()` waits
for `onDone`. `cameraTween`'s pitch curve is unchanged too: zooming out it uses
`1 - (1 - k) ** 2`, which leaves the high walk pitch early rather than dragging the camera
low behind the centre, and the new target only takes that further.

## Verification

1. `npm run build` passes.
2. `npm run dev`, then press 3D and Walk:
   - Walk a while, turn away from north, look up and down, then press Walk again: the
     flight ends straight down at zoom 16 over the spot you stood on, still rotated to the
     way you were facing. The compass shows the turn and no tilt, and pressing it only
     turns the map back to north.
   - The same from playback: Esc out of a trail and then out of walk.
   - Dragging with the right button or Ctrl, or with two fingers, still tilts.
   - 2D → 3D is unchanged: flat and north-up.
