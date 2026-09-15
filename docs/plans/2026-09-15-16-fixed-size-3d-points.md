# Keep 3D National Point dots at a fixed screen size

## Context

In 3D the National Point Number dots keep changing size: sometimes they're huge, sometimes
tiny. The cause is the circle layer in `src/scene3d.ts:205`. It leaves `circle-pitch-scale`
at MapLibre's default, `'map'`. The vertex shader
(`node_modules/maplibre-gl/src/shaders/glsl/circle.vertex.glsl`) then scales each dot's
radius by `camera_to_center_distance / depth`. So a dot is `PIN_RADIUS` (5px) only at the
depth of the camera's look-at point, and grows or shrinks as 1/distance everywhere else:

- **Walk / playback:** the look-at point is `LOOK_DISTANCE` = 15 m ahead
  (`src/firstPerson.ts:23`). A point 1.5 m away is drawn at about 50px, and one 300 m away
  is under 1px.
- **Orbit:** the look-at distance changes with zoom, tilt and terrain height, so the dots
  swell and shrink as the camera moves.

We considered laying the dots flat on the ground and rejected it. From 1.7 m eye height a
flat disc is a thin sliver. From orbit height it's too small to see. MapLibre only drapes
fill, line and raster layers onto terrain (`render_to_texture.ts` LAYERS_TO_TEXTURES), and
draws a flat circle at the height of its centre, so on a slope part of the disc sinks into
the hill. The user chose the fixed screen size.

## Change

1. **`src/scene3d.ts` — points layer paint.** Add `'circle-pitch-scale': 'viewport'`. Leave
   `circle-pitch-alignment` at its default `'viewport'`, so the dot stays upright, facing
   the camera and anchored at its spot on the ground. With both set to viewport, the shader
   adds `radius × gl_Position.w`, which is a constant pixel size: 5px with a 1.5px white
   ring, the same as the 2D divIcon from `src/points.ts`. Add a short comment above it on
   why: the default scales by distance from the camera's look-at point, which is 15 m ahead
   in walk mode.
2. **Plan doc.** Save this plan as `docs/plans/2026-09-15-16-fixed-size-3d-points.md`, in
   the same style as the other plan docs.

Clicking needs no change. `queryRenderedFeatures` in `src/view3d.ts:253` already uses a
±6px box, and that now matches the dot's real size on screen.

## Verification

1. `npm run build` passes (type check and bundle).
2. `npm run dev`, turn National Point Numbers on, open 3D:
   - Orbit: zoom in and out and tilt. Every dot stays the same size, the same as in 2D.
   - Walk: go up to a point and past it. The dot doesn't grow as you get close, and
     distant dots are still visible, not sub-pixel. A dot behind a ridge is still hidden
     by the terrain.
   - Clicking a dot in orbit still opens its popup.
