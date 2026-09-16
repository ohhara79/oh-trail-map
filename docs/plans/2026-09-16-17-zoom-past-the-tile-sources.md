# Zoom past a basemap's last tiles in 2D

## Context

2D stops dead at z19 on OSM and Satellite, and at z17 on OpenTopoMap, while 3D carries on
well past either. The asymmetry is accidental: the two libraries read the same number as
opposite instructions.

`src/map.ts:56` handed the basemap's deepest server level to Leaflet as the tile layer's
`maxZoom`. The map sets no `maxZoom` of its own (`src/map.ts:25-37`), and Leaflet's
`getMaxZoom()` falls through to the deepest of its layers when it has none
(`leaflet-src.js:3967-3971`), so that number became the whole map's ceiling — the `+`
button greys out and the wheel clamps. `maxNativeZoom`, the option that says "the server
has nothing past here, keep drawing these tiles scaled up" (`leaflet-src.js:11221-11225`,
applied at `:11646`), was never set, so "no more tiles" and "no more zooming" were the same
limit.

MapLibre reads the identical field (`src/scene3d.ts:60`) as where overzooming *begins*, and
limits the camera separately with `ORBIT_MAX_ZOOM = 22` — Leaflet z23 after `ZOOM_OFFSET`.
The terrain source already leans on this: DEM tiles stop at z15 and "MapLibre overscales
past that" (`src/scene3d.ts:42-46`).

Three clamps in 2D existed only to keep the camera away from blank tiles, and all three go
away with the limit that caused them.

## Change

1. **`src/basemaps.ts`.** Add `MAX_ZOOM = 23`, how far in either view may go. It matches
   what orbit already allowed, so the two views agree and coming back from 3D never has to
   pull you out. `Basemap.maxZoom` keeps its meaning and gains a comment naming it the
   deepest level the server actually has — which is what MapLibre always assumed it was.

2. **`src/map.ts`.** Both `L.tileLayer(...)` constructions take `maxNativeZoom:
   source.maxZoom` and `maxZoom: MAX_ZOOM` in place of the single `maxZoom`.

   - The clamp in `setBasemap` (`if (map.getZoom() > next.maxZoom) map.setZoom(...)`) is
     deleted. Every source shares `MAX_ZOOM` now, so coming from OSM at z22 to OpenTopoMap
     upscales its z17 tiles instead of blanking, and you keep the view you had.
   - The `zoomSnap: 1` comment claimed tiles are "always drawn at their native size", which
     stops being true above `maxNativeZoom`. Integer zoom is still worth keeping, for a
     different reason: it holds the upscale factor at a whole number, and a 2x or 4x tile is
     blocky but sharp where 1.7x is mush.

3. **`src/main.ts`.** The two remaining clamps against `basemapById(...).maxZoom` go:

   - The national-point row click keeps only `Math.max(map.getZoom(), POINT_ZOOM)`.
     `POINT_ZOOM` is 17, at or below every source's native level, and "never zooms out"
     still holds from z23.
   - `close3d()` passes `back.zoom` straight through. `viewFor2d()` returns at most
     `ORBIT_MAX_ZOOM + ZOOM_OFFSET` = 23 in orbit and a fixed 17 in walk, both within reach.

   Both `fitBounds` calls — the trail row's zoom button and the startup fit over restored
   trails — gain `maxZoom: basemapById(settings.basemapId).maxZoom`. They were relying on
   the old layer cap to stop them, and without it a 200 m loop would frame itself on
   upscaled tiles nobody asked for. Framing is automatic; only zooming by hand should go
   past native detail.

4. **`src/view3d.ts`.** `ORBIT_MAX_ZOOM` becomes `MAX_ZOOM - ZOOM_OFFSET` rather than a
   restated 22, so the two ceilings cannot drift apart. The value is unchanged.
   `WALK_MAX_ZOOM = 24` stays independent — the eye-height camera must never be clamped.

## Verification

1. `npm run build` passes.
2. `npm run dev`, then:
   - OpenTopoMap is the sharp test: it takes six more steps past z17, the imagery coarser
     each time but never blank, and `+` only greys out at the end.
   - OSM and Satellite take four steps past z19, upscaled rather than white.
   - Zoom to z22 on OSM and switch to OpenTopoMap: the view holds its place and depth
     instead of jumping out to z17.
   - Zoom in hard in 3D orbit and close 3D: 2D comes back where you were. Walk still
     returns at z17.
   - A short trail's zoom button still frames at native resolution, not blurry z23, and so
     does the startup fit.
   - A point row still lands at z17, and still does not zoom you out when clicked from z23.
