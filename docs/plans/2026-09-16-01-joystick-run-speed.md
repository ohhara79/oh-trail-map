# Run at full joystick push on touch screens

## Context

In 3D walk mode, speed is `MOVE_SPEED` (14 m/s) × (Shift ? 4 : 1) × a height factor
(`src/firstPerson.ts`). On a PC, Shift+W runs at 56 m/s. A phone has no Shift, and the
joystick vector was clamped to 1, so a phone could only ever walk. That is too slow to
cross the mountain. Pushing the joystick all the way should run as fast as Shift does.

## Change

1. **`src/walkControls.ts`**
   - Add `RUN_FACTOR = 4`.
   - `intent()` now gives `forward`/`right` as multiples of walk speed, and the `run`
     field is gone:
     - the keyboard vector × (Shift ? `RUN_FACTOR` : 1)
     - the joystick vector × `RUN_FACTOR × m`, where `m` is the push from 0 to 1. Speed
       grows with the square of the push: a half push is the old walk pace, the rim runs,
       and a light touch still creeps.
     - each axis clamped to `[-RUN_FACTOR, RUN_FACTOR]`
2. **`src/firstPerson.ts`**: the speed no longer applies Shift, because the intent already
   includes it.

Keyboard speeds on PC are unchanged.

## Verification

1. `npm run build` passes.
2. `npm run dev` with touch emulation → 3D → Walk:
   - A joystick push to the rim moves as fast as Shift+W on desktop.
   - A half push is about the old walk pace. A light push is slow.
   - Letting go stops you.
3. Desktop: W and Shift+W move at the same speeds as before.
