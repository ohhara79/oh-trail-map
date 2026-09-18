# Draw the 3D profile cursor dot like the national point dots

## Context

`2026-09-18-07` stopped the 3D profile cursor dot from flickering by turning off MapLibre's
fading (`opacityWhenCovered: 1`). The dot was still a DOM `Marker`. MapLibre places a Marker on
the terrain height and decides on the CPU, with a depth sample and a tolerance, whether the
ground covers it.

In orbit, national points are drawn another way: a `circle` style layer on a GeoJSON source
(`LAYER_POINTS`). MapLibre also draws those at the terrain height, but on the GPU, with a depth
test per pixel. They never flickered. The dot now uses the same method, so both kinds of dot are
placed and hidden by the terrain in the same way.

The height is unchanged. Both kinds of dot sit on the DEM ground, not the GPX elevation, the
same ground the draped trail line lies on.

## Change

### `src/scene3d.ts`

- `SRC_PROFILE_CURSOR` is a GeoJSON source that starts `EMPTY`.
- `LAYER_PROFILE_CURSOR` is the last layer, above the points, as the 2D cursor pane (590) is
  above the pins (580). It uses `circle-pitch-scale: 'viewport'`, as `LAYER_POINTS` does, so
  the dot is a fixed size on screen. The fill is the trail's colour from the feature's `color`
  property, with a white ring.
- Its size is radius 4.5 with a 3px stroke. MapLibre strokes outside the radius and Leaflet
  strokes across it, so this matches the 2D `ProfileCursor`'s radius 6 with a 3px ring.

### `src/view3d.ts`

- The `Marker` and its element are gone. `setProfileCursor` sets the source's data to one
  Point feature, or to `EMPTY` for none. It still clears the map only when a dot is shown,
  since it is called on every cursor move. `destroy()` no longer removes a marker, because
  `map.remove()` takes the layer with it.
- `syncGround` is unchanged. The layer stays visible while walking, as the Marker did.

### `src/style.css`

The `.maplibregl-marker.profile-cursor-marker` rule is gone. `.profile-cursor-marker`, the
drop shadow on the 2D Leaflet dot, stays.

## Trade-offs

- The dot now hides behind a ridge in front of it, as the point dots do. This undoes 07's
  "always drawn" behaviour, and is the consequence of drawing it the same way.
- A GL circle has no CSS drop shadow. The 3D point dots have none either.

## Verification

1. `npm run build` passes.
2. `npm run dev`: select a trail, open the profile, and switch to 3D orbit. Tilt, then move the
   cursor by dragging, with ◀ ▶ and with the keys. The dot stays steady, in the trail's colour
   with a white ring. Orbit so a ridge covers it: it hides as the point dots do. It shows while
   walking and not during playback. Clearing the selection removes it. 2D is unchanged.
