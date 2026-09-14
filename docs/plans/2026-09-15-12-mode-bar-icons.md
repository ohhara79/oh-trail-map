# Icons for the 3D mode bar's Orbit, Walk and Gyro buttons

## Context

The 3D mode bar (`#mode3d`, top-centre) spelled its buttons out as
**Orbit · Walk · 1.7 m · Gyro**. On a phone, where Gyro shows and `.hud-bar button` gets
`padding: 8px 12px`, the bar was wide and covered much of the scene. The user wants the
three words turned into icons so the bar takes less space. The eye-height button stays
as text because it shows a value.

There's already a pattern for this: `#locate` uses an inline 24×24 `<svg>` with
`currentColor` strokes. The pressed state
(`.hud-bar button[aria-pressed='true'] { background: accent; color: #fff }`) then turns
the icon white on its own.

`hud3d.ts` and `view3d.ts` only change `aria-pressed` on these buttons, never their
text, so no TypeScript changes are needed.

## Change

1. **`index.html`**: each of the three buttons gets a `hud-icon` class, an inline 18px
   SVG, and a `title` plus `aria-label` so the name is still there:
   - Orbit, "Orbit from above": a planet with a tilted ring. A dot inside an ellipse
     looked like an eye.
   - Walk, "Walk at eye height": a walking figure.
   - Gyro, "Look around by moving your phone": a phone outline with an arc on each side.
2. **`src/style.css`**:
   - `#mode3d .hud-icon { width: 30px; padding: 0; }`, which outranks
     `:is(#mode3d, #selection-bar) button` and the touch padding.
   - `#mode3d .hud-icon svg { display: block; margin: 0 auto; }`. The button already
     centres its content vertically, so centring the SVG this way needs no `display`
     on the button, which would conflict with `.walk-only`'s `inline-block`.
   - In the `pointer: coarse` block, `#mode3d .hud-icon { width: 36px; }` gives a wider
     tap target on touch.

## Verification

- `npm run build` passes.
- The icons were rendered with headless Chrome in both states, default and white on the
  accent. All three read clearly at 18px.
- `npm run dev`, then 3D: Orbit is pressed with two square icon buttons. In Walk, `1.7 m`
  appears and the bar stays 34px tall. With touch emulation, Gyro shows as the phone icon
  and toggles. In playback, Walk still shows as pressed.
