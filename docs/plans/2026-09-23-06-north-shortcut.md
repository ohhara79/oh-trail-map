# `N` faces north in 3D

## Context

The 3D compass had no key. Orbit shows MapLibre's compass control (reset north and pitch); walk and playback hide it and show `#attitude3d` (face north and level) in its slot.

## Change

1. `src/view3d.ts`: give MapLibre's compass button the id `compass3d`.
2. `src/shortcuts.ts`: `KeyN: ['attitude3d', 'compass3d']` in `BUTTONS`, so `N` presses whichever is showing, and nothing in 2D.
3. `index.html` (the `?` sheet) and `README.md`: list `N`.

## Verification

1. `npm run build` passes.
2. Orbit: rotate and tilt, `N` eases back north-up and flat.
3. Walk and playback (also with the controls faded): `N` faces north and level.
4. 2D: `N` does nothing.
