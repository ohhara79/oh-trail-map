# Look straight ahead in walk mode

## Context

Walk mode and trail playback both open looking down at the ground rather than straight
ahead. The user expects the eye-height camera to start level with the horizon.

Three places set the tilt (`look`, degrees above the horizon, 0 = straight ahead):

- `src/view3d.ts:622` — entering walk from orbit: `{ ..., yaw: map.getBearing(), look: -10 }`.
- `src/view3d.ts:699` — `walkTrail()` seeds playback with `look: -10`.
- `src/firstPerson.ts:49-50` — `PLAYBACK_LOOK = -6`, the tilt playback eases back to once
  you stop looking around (`LOOK_HOLD_MS`, `LOOK_RETURN_TAU`).

So walk starts 10° down and stays there until you drag; playback starts 10° down and
drifts to 6°. All three should be level.

A level view puts MapLibre's pitch at 90, which `walkLimits()` already allows —
`WALK_MAX_PITCH = 179` (`src/view3d.ts:121-122`), set before `eyeCamera()` is called. Nor
is `calculateCameraOptionsFromTo` degenerate there: the near-plane trap the module comment
in `firstPerson.ts` warns about belongs to `calculateCameraOptionsFromCameraLngLatAltRotation`,
which this code deliberately avoids.

## Change

1. **`src/view3d.ts`.** `look: -10` → `look: 0` in the walk entry pose and in
   `walkTrail()`. The flight down into walk reads its pitch from
   `eyeCamera(map, pose, ground + eye, WALK_FOV)`, so it ends level on its own.
2. **`src/firstPerson.ts`.** Drop `PLAYBACK_LOOK` rather than set it to 0 — a constant
   that is always 0 is noise, and its comment ("Playback looks slightly down, as you would
   walking a path") would no longer be true:
   - Delete the constant, the `baseLook = PLAYBACK_LOOK` line in `frame()`'s playback
     branch, and the `this.playback ? PLAYBACK_LOOK : 0` base in `setGyro()`. `baseLook`
     stays 0 unless the gyroscope sets it, so the clamp and offset logic is unchanged.
   - `setPlayback()`: both branches now do `this.lookOffset = look`, so lift it out of the
     `if`/`else` with a line saying the tilt is yours either way.
   - Update `frame()`'s doc comment: the trail sets the yaw, not a tilt, and only the
     phone ever sets a base tilt.

   `lookOffset` still decays to 0 after `LOOK_HOLD_MS`, so playback drifts back to level
   instead of 6° down. `LOOK_MIN`/`LOOK_MAX` (−80/60) are untouched: you can still look at
   your feet or up at the ridge.

`ORBIT_PITCH` and the orbit camera are unchanged — leaving walk still returns to the
tilted overview.

## Verification

1. `npm run build` passes.
2. `npm run dev`, then:
   - Press 3D, then Walk: the flight lands level, the horizon across the middle of the
     screen rather than below it.
   - Walk over a slope: the camera stays level and the ground is not clipped at the
     bottom of the screen.
   - Drag to look down and stop for more than two seconds: free walk keeps the tilt you
     chose, playback drifts back to level.
   - Play a trail from the map: it starts level and facing along the path.
   - Walk → Orbit still returns tilted, facing the way you were walking.
   - Aim at a trail or a point: the crosshair now reads the horizon rather than the
     ground a few metres ahead, so a small downward drag may be needed for something
     close by.
