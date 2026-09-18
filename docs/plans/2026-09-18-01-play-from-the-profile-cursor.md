# Start 3D playback from the point the profile cursor is on

## Context

The elevation profile panel lets you put a cursor on a GPX point (the lat/lon/ele
readout, `cursorIndex` in `src/main.ts`). Pressing ▶ 3D then always starts the walk
from the trail's first point, and the first playback frame reports index 0 back
through `onPlaybackPoint`, so the point you picked is thrown away. If you picked a
point on the trail you are about to play, that is almost certainly where you want to
start — e.g. to look at a climb halfway along without scrubbing to it.

Rule: if the profile is showing the trail being played and its cursor is on a point,
playback starts there (standing on it, facing along the trail). Otherwise it starts at
the beginning as now. A cursor on the very last point starts from the beginning
instead (starting at the end would play nothing).

## Change

1. **`src/main.ts` — `onWalkTrail`** (~line 292): before `selectTrail(id)` could
   change anything, capture
   `const from = profileTrail?.id === id ? cursorIndex : null;`
   and call `view?.walkTrail(id, from ?? undefined)`.
   (`selectTrail` of the already-selected trail keeps `profileTrail`, but capture
   first so the rule doesn't depend on that.)

2. **`src/view3d.ts`**
   - Interface (line 129): `walkTrail(id: string, fromPoint?: number): void;`
   - `walkTrail` (line 970): after `buildPath`, compute
     `let s0 = fromPoint === undefined ? 0 : distanceAtPoint(path, fromPoint);`
     and `if (s0 >= path.total) s0 = 0;`
     Use `sampleAt(path, s0)` for `start` instead of `sampleAt(path, 0)`.
     Ground elevation for the jump: the GPX point's own `ele` (flatten
     `trail.segments` and index `fromPoint`), falling back to the first point's as now.
   - Create the `Playback`, call `playback.seek(s0)` **before**
     `walker.setPlayback(playback)`, so `setPlayback` (`src/firstPerson.ts:150`) takes
     `tangentBearing(path, playback.s)` at the start point and faces along the trail
     from there.
   - `distanceAtPoint` is already imported (used by `seekToPoint`).

3. Nothing else: the first frame then reports the chosen index through
   `onPlaybackPoint`, so the cursor, readout and scrubber stay on the point you picked.

## Verification

- `npm run build` / type-check passes.
- In the browser: select a trail, open the profile, click a point mid-trail, press
  ▶ 3D → camera lands on that point facing along the trail, readout shows the same
  point, scrubber is partway along.
- Profile closed, or cursor on a different trail → starts at the beginning.
- Cursor on the last point → starts at the beginning.
- Drawer row ▶ for the same trail behaves the same (same `onWalkTrail` path).
