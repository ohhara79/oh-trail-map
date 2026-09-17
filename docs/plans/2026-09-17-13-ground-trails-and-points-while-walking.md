# Trails and national points painted on the ground while walking

## Context

In 3D walk and playback, trails and national points were hard to see:

- **Trails** were draped `line` layers at a flat `TRAIL_WEIGHT` = 2 px
  ([2026-09-16-19](2026-09-16-19-flat-3d-trail-width.md),
  [2026-09-16-20](2026-09-16-20-match-2d-trail-width.md)). The walk camera always sits at
  about z21–22 — `eyeCamera` in `src/firstPerson.ts` holds the look-at point 15 m ahead
  whatever the eye height — so underfoot that is a few centimetres of hairline. Plan 19
  took that trade on purpose and left a follow-up: make the width mode-dependent with
  `setPaintProperty` on a mode change, the metre ramp back for walk and playback only.
  This is that follow-up.
- **National points** were billboard `circle` dots, 5 px, standing at their spot. They
  are now painted on the terrain instead while walking, and only there: the dot goes away
  in walk and playback. [2026-09-15-16](2026-09-15-16-fixed-size-3d-points.md) rejected
  flat circles because a `circle` layer is not draped and sinks into a slope. A `fill`
  polygon is draped, as the location-accuracy circle already is, so it lies on the hill.

The user chose a **3 m** trail on the ground and a **ground disc only** for points. Orbit
keeps what it had: 2 px trails and 5 px dots.

## Change

### `src/scene3d.ts`

1. **The ground-width ramp is back.** `groundWidth(px, metres, lat)` from commit
   `73c26a4`: holds `px` to z16, eases into `metres` by z19, then doubles every zoom,
   which holds a width constant on the ground. `EARTH_RADIUS` is imported from `./gpx`.
   `TRAIL_METRES = 3`, `HALO_METRES = [4.6, 3.8]`: the old 1.6 / 0.8 m pads around the
   trail, so a selected trail's casings frame it without turning it into a road.
2. **`trailWidths(lat | null)`** is the one place the trail widths are decided. It
   returns `[layerId, width]` for `trails`, both halos and `trail-selected`. `null` gives
   orbit's pixel widths (`TRAIL_WEIGHT`, `ring.weight`), and a latitude gives
   `groundWidth`. `layers()` starts with the same pixel widths. The hover layer only
   shows in orbit, so it is left alone.
3. **Point discs.** `pointDiscsGeoJson(points, radius)` builds each point as a
   `circlePolygon()` with the same `{ index, named, code }` properties as
   `pointsGeoJson`. Those properties now come from a shared `pointProperties()`, so
   `pointsFilter` and the index lookup work as they are. There are two sources,
   `point-edges` at `POINT_DISC_METRES + POINT_EDGE_METRES` (3.75 m) and `point-discs` at
   `POINT_DISC_METRES` (3 m), and two `fill` layers, `LAYER_POINT_DISCS =
   ['point-disc-edge', 'point-disc']`. The edge is white, and the disc is
   `PIN_COLOR_NAMED` / `PIN_COLOR_UNNAMED`, with named points sorted on top. Both layers
   start with `visibility: 'none'`. They sit after the location circle, above the
   trails. A 7.5 m disc is well wider than a 3 m trail, so a point on a trail still
   stands out.

### `src/view3d.ts`

4. **`syncGround()`** runs next to each `hud.setMode(mode)` call, in `setMode` and
   `walkTrail`. A `groundOn` flag stops it restyling when you switch between walk and
   playback. Outside orbit it sets `line-width` from `trailWidths(map.getCenter().lat)`,
   shows the disc layers and hides `points`. Back in orbit it does the reverse. The swap
   happens as the camera flight starts, while everything is moving.
5. **`syncPoints()`** filters the two disc layers as well as the dots.
6. **Aiming.** `pointAt()` now takes the layer to query. `pickAt()` in orbit still
   queries `points`. `aimedPoint()` queries `point-disc-edge`, which covers the whole
   disc, so the crosshair picks a point from anywhere on its disc. `inReach` still
   applies.

## Files

| File | Change |
|---|---|
| `src/scene3d.ts` | `groundWidth` and the metre constants back; `trailWidths()`; disc sources, `pointDiscsGeoJson`, two draped fill layers |
| `src/view3d.ts` | `syncGround()` on each mode change; disc filters in `syncPoints`; `pointAt` takes a layer, and `aimedPoint` queries the disc |

## Verification

1. `npm run build` passes.
2. `npm run dev`, with a trail from `data/gpx/` loaded and National Points on, open **3D**:
   - **Orbit:** nothing changes. Trails are 2 px and dots 5 px at every zoom, with no
     discs.
   - **Walk:** trails are a band about 3 m wide lying on the ground, and points are
     coloured discs with a white edge painted on the terrain, with no floating dots. This
     holds at every eye height (1.7 / 20 / 80 m).
   - Where a point lies on a trail, its disc shows clearly on top of the band.
   - Selecting a trail while walking puts its casings around the 3 m band.
   - Aiming anywhere on a disc within reach and tapping opens the popup. Hiding that point
     in the panel list removes its disc.
   - **Playback** looks the same as walk. Going back to orbit (Esc or the walk toggle)
     brings back orbit's widths and dots.
