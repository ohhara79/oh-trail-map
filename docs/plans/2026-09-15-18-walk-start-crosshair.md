# Show where walking will start in 3D

## Context

In 3D orbit mode, pressing Walk drops you somewhere you can't predict. The code already
picks a fixed spot. `setMode('walk')` in `src/view3d.ts:376-381` starts the walker at
`map.getCenter()`, facing `map.getBearing()`. The view has no padding, so that centre is
exactly the middle of the `#map3d` canvas. The camera tilt doesn't change this, because
the centre is the ground point in the middle of the screen. Screen-up is also the way
you'll face.

So a crosshair in the middle of the screen marks the exact start point, and nothing about
how walking starts has to change. Show it only in orbit mode. In walk and playback modes
you are standing at that point, so it would get in the way. In 2D it means nothing.

## Change

1. **`index.html`**: add a crosshair element inside `#hud3d`, next to `#joystick`:
   `<div id="crosshair3d" aria-hidden="true">` with a small inline SVG:
   - a ring or plus sign with a gap at the centre, so the exact point stays visible;
   - a short tick pointing up, to show which way you'll face.
   `#hud3d` is already hidden in 2D, so the crosshair is too.
2. **`src/style.css`**, in the 3D section near `#joystick`:
   - `#crosshair3d { display: none; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: none; z-index: <above canvas, below .hud-bar 1000>; }`.
     Size it around 24–28px.
   - `#app[data-mode3d='orbit'] #crosshair3d { display: block; }`.
   - Draw it white with a dark shadow, like the joystick
     (`filter: drop-shadow(0 0 2px rgba(0,0,0,.6))`), so it shows on both light and dark
     terrain.
   - Add a short comment: walking starts at the map centre, facing screen-up (see
     `setMode` in view3d.ts).
3. **`src/view3d.ts`**: no change to how walking starts. Add a one-line comment at the
   `map.getCenter()` start in `setMode` that points to `#crosshair3d`, so the two stay in
   sync.
4. **Plan doc**: save this plan as `docs/plans/2026-09-15-18-walk-start-crosshair.md`, in
   the same style as the other plan docs.

## Verification

1. `npm run build` passes.
2. `npm run dev`, then press 3D:
   - A crosshair shows in the middle of the screen in orbit mode, flat and when tilted.
   - Put a trail junction or a point pin under the crosshair and press Walk. You land on
     that spot, facing the direction the tick pointed.
   - The crosshair is gone in walk mode, in playback, and in 2D. It comes back on
     Walk → Orbit.
   - Clicking a trail or point right under the crosshair still selects it or opens its
     popup, so the crosshair doesn't catch clicks.
   - At phone width it stays centred and doesn't overlap `#mode3d` or the selection bar.
