# A see-through minimap

## Context

The 2D minimap in 3D Walk and playback (`2026-09-21-01-2d-minimap-in-3d.md`) was
opaque, and covered a 120–280px corner of the scene. The user wanted to see the
3D view through it. Offered a faded basemap under solid trails, they asked for
**the whole map** to be transparent instead.

## Change (`src/style.css`, the minimap block)

1. **No ground.** The inset `#map` gets `background: transparent`, overriding
   `.leaflet-container`'s `#ddd`, so empty or loading tiles show the scene.
2. **One fade for the whole map.**
   `#app[data-view='3d'] #map .leaflet-map-pane { opacity: .6; }`. The map pane
   holds every other pane, so tiles, trails and pins fade as one group rather than
   doubling up where they overlap. It is not `opacity` on `#map`: the
   `data-chrome` fade animates that, and the inset rule outranks it.
3. **The shadow goes and the border stays.** Over a clear box the shadow read as
   a smudge. `#minimap-you` lies outside the map and stays solid.

## Verification

1. `npm run build` passes.
2. Headless Chrome at 390×844 (walk, and playback enlarged) and 1280×800: sky and
   terrain show through the whole inset, and the arrow is solid.
3. `data-chrome='hidden'` still hides the inset and the arrow (reduced motion).
4. 2D is untouched: the rules are scoped to `#app[data-view='3d']`.
