# Only the minimap's basemap is see-through

## Context

`2026-09-21-02-see-through-minimap.md` faded the whole minimap to 60% through
`.leaflet-map-pane`, which took the trails, pins, GPS dot and profile dot down
with the tiles. Having seen it, the user asked for the option offered first
instead: fade the basemap alone. The marks are what say where you are, so they
should hold their strength over a busy scene — the see-through ground under solid
marks that `#profile` and `#playback3d` already use.

## Change (`src/style.css`, the minimap block)

1. `#app[data-view='3d'] #map .leaflet-map-pane { opacity: .6; }` becomes
   `#app[data-view='3d'] #map .leaflet-tile-pane { opacity: .55; }`. Pane opacity,
   not the tile layer's `opacity` option, so `setBasemap` in `src/map.ts` carries
   nothing over; still scoped to 3D, so 2D is untouched; still not `opacity` on
   `#map`, which the `data-chrome` fade animates and the inset rule outranks.
2. Everything else from the previous plan stands: the transparent ground, no drop
   shadow, the 2px border, the solid `#minimap-you`.

## Verification

1. `npm run build` passes.
2. Headless Chrome at 390×844 (playback, enlarged) and 1280×800: the sky shows
   through the tiles, and the magenta trail line, the amber pins and the arrow are
   full-strength.
3. `data-chrome='hidden'` still hides the inset and the arrow (reduced motion).
