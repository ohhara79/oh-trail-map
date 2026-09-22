# Pulse the selection halo in 3D too

## Context

In 2D, when you select a trail, its white halo blinks twice and then settles. This is the `trail-halo-pulse` animation in `src/style.css`. The 3D view draws the same halo as a MapLibre line layer, and CSS can't animate a layer drawn in WebGL, so in 3D the halo just appeared. Selecting a trail should look the same in both views.

## Change

1. `src/selection.ts`: `HALO_PULSE` (`low: 0.2`, `period: 550` ms, `count: 2`) holds the numbers the CSS keyframes use. The CSS and this constant each point to the other.
2. `src/view3d.ts`: `syncTrails()` notes which trail has the halo (the selected trail, if it is visible). When that trail changes to a new one, `pulseHalo()` starts a rAF loop. The loop moves the white ring's `line-opacity` from 0.95 down to 0.2 and back on a cosine curve, twice, then sets it back to 0.95. It skips the pulse under `prefers-reduced-motion`, as 2D does. A new pulse cancels any pulse still running, and so does `destroy()`. The first value is the selection 3D opens with, so entering 3D doesn't replay a pulse 2D has already played.
3. `src/scene3d.ts`: the halo layers set `line-opacity-transition: { duration: 0 }`. Without it, MapLibre's default 300 ms paint transition would smear each frame's opacity step into the next one.

## Verification

1. `npm run build` passes.
2. 3D orbit: clicking a trail makes its white halo blink twice, as in 2D.
3. 3D: clicking a different trail pulses again. Clearing the selection shows no halo.
4. Entering 3D with a trail already selected doesn't pulse again.
5. Changing a trail's visibility or colour in 3D doesn't pulse.
6. With reduced motion turned on in the OS, the halo shows without blinking in both views.
