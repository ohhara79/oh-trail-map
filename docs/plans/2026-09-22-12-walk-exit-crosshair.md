# Leaving 3D from walk lands the 2D crosshair on where you stood

## Context

Walking in 3D and pressing the 3D button to go back to 2D, the 2D `#crosshair` does
not sit on the spot you were standing on; it's off toward the bottom-right. From
orbit it's fine. Wanted: the crosshair lands on the walker's position.

Cause: while walking, `#map` is the minimap (120–280 px square in the top-left,
`style.css:208`). `close3d()` (`src/main.ts:465`) removes `data-view` /
`data-mode3d`, so CSS makes `#map` full size again, but Leaflet still has the minimap
size cached. `map.setView([back.lat, back.lon], 17)` then centres the walker's spot in
the *minimap-sized* box, i.e. ~60 px from the top-left. A frame later the
ResizeObserver in `src/map.ts:60` runs `invalidateSize({ pan: false })`, which keeps
the top-left, so the spot stays near the top-left corner and the crosshair (at the
real centre) points somewhere else. Orbit only hides `#map` (`visibility: hidden`) at
full size, so its size was never stale — which is why orbit works.

`viewFor2d()` (`src/view3d.ts:1223`) already returns the walker's pose; it's right.

## Change

1. **`src/main.ts` `close3d()`**: just before `map.setView(...)`, call
   `map.invalidateSize({ pan: false })` so Leaflet reads the full-size container
   (the CSS change above it is already applied; reading `clientWidth` forces layout).
   `pan: false` because setView re-centres right after anyway. Comment in the file's
   voice: walking left `#map` at the minimap's size, and Leaflet only learns the new
   one a frame later (see createMap), so setView would centre the spot in the corner.
   The later ResizeObserver `invalidateSize` then finds no change and does nothing.
2. Save this plan as `docs/plans/2026-09-22-12-walk-exit-crosshair.md`
   (plan-docs convention).

## Verification

1. `npm run build` passes.
2. `npm run dev`, scratchpad playwright script (as in earlier plans):
   - Open 3D, go to walk, walk a bit with W; note the readout lat/lon.
   - Press the 3D button: the 2D readout (map centre, under `#crosshair`) matches the
     walk position to ~1e-5°, and `map.latLngToContainerPoint(walker pose)` equals half
     the map size.
   - Repeat with the large minimap and with the minimap turned off.
   - From orbit, leaving 3D still lands on the orbit centre.
3. Commit with the plan doc.
