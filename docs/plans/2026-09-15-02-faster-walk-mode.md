# Faster movement in 3D walk mode

## Context

Walk mode moves at real walking pace: `src/firstPerson.ts:220` uses
`WALK_PACE (1.4 m/s) × (Shift ? 4 : 1) × max(1, eye / 5)`. On the ground that is 1.4 m/s
walking and 5.6 m/s running — crossing a mountain several km wide takes many minutes, so it
feels far too slow. The user wants it much faster.

`WALK_PACE` is also the 1× unit for trail playback (`src/trailPlayback.ts:93`, presets
1×–50×), so it stays as is; walk mode gets its own speed constant instead.

## Change

1. **`src/firstPerson.ts`** — add a constant next to the other tuning constants:
   ```ts
   /** Free-walk speed in m/s, before Shift and height. Ten times a real walk: the
    *  mountain is kilometres across, and real pace makes crossing it a chore. */
   const MOVE_SPEED = 14;
   ```
   and change line 220 to
   ```ts
   const speed = MOVE_SPEED * (intent.run ? 4 : 1) * Math.max(1, this.eye / 20);
   ```
   Drop `WALK_PACE` from the import if nothing else in the file uses it.

   Resulting speeds (walk / Shift):

   | Eye | Before | After |
   |---|---|---|
   | 1.7 m | 1.4 / 5.6 m/s | 14 / 56 m/s |
   | 20 m | 5.6 / 22.4 m/s | 14 / 56 m/s |
   | 80 m | 22.4 / 89.6 m/s | 56 / 224 m/s |

   The height divisor moves from 5 to 20 so the 80 m drone does not reach ~900 m/s with
   Shift, which would outrun terrain/basemap tile loading. Ground-level speed is 10× faster;
   heights still scale up.
2. **`README.md:33-35`** — no wording change needed ("Shift to run" still true); leave as is.
3. **Plan doc** — save this plan as `docs/plans/2026-09-15-02-faster-walk-mode.md`.

Trail playback speed is untouched.

## Verification

- `npx tsc --noEmit` (or the project's build script in `package.json`) passes.
- Run the dev server, open 3D → Walk, hold W: ground moves visibly fast (~50 km/h),
  Shift much faster; cycle eye height to 20 m / 80 m and confirm speed stays sensible and
  tiles keep up. Start ▶ playback on a trail and confirm its speed presets are unchanged.
