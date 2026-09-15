# Make Walk a toggle and remove the Orbit button

## Context

The 3D mode bar (`#mode3d`, top-centre) showed **Orbit · Walk** as a two-button
segmented control, followed by `1.7 m` and Gyro while walking. Orbit and Walk are always
each other's opposite, so the Orbit button added nothing: Walk pressed means walking,
Walk not pressed means orbit. The user suggested dropping Orbit. This also matches the
other toggles over the map, **3D** (`#view3d`) and locate (`#locate`), which are both
single `aria-pressed` buttons. In orbit the bar is now a single 30px icon, so it covers
less of the scene.

Behaviour:
- **Walk pressed during playback**, where it already shows pressed, goes to **orbit**. A
  pressed toggle turns off when you press it. The playback bar's × still returns to
  walking.
- Esc still steps back one level at a time: playback → walk → orbit.
- A press during a camera flight works as before, because `setMode` calls `settle()`
  first.

## Change

1. **`index.html`**: the `data-mode="orbit"` button is gone. The Walk button becomes
   `#walk3d` with no `data-mode`, and keeps its title, label and `aria-pressed`.
2. **`src/hud3d.ts`**
   - `modeButtons` becomes one `walk` button.
   - The `onMode(mode)` callback becomes `onWalk()`.
   - `setMode` presses Walk in any mode except orbit.
3. **`src/view3d.ts`**: `onWalk: () => setMode(mode === 'orbit' ? 'walk' : 'orbit')`.
4. **`src/style.css`**: a comment update only. `.hud-icon`, the pressed style and
   `.walk-only` already handle a single button.
5. **`README.md`**: 3D opens in orbit, and **Walk** is described as a toggle.

## Verification

- `npm run build` passes.
- `npm run dev`, then 3D:
  - In orbit the bar shows only Walk, not pressed.
  - Press Walk: the camera flies down, Walk is pressed, and `1.7 m` appears.
  - Press it again: the camera flies back up to orbit.
  - Play a trail: Walk is pressed. Pressing it goes to orbit, and × returns to walking.
  - Esc still steps playback → walk → orbit.
