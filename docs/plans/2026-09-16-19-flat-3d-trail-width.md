# A trail that does not thicken when you zoom in 3D

## Context

In 2D a trail is a Leaflet polyline at a fixed `TRAIL_WEIGHT = 2` CSS px. Zooming never
changes it. In 3D the same trails are MapLibre `line` layers, and their `line-width` ran
through `groundWidth()` in `src/scene3d.ts`:

```ts
['interpolate', ['exponential', 2], ['zoom'], 16, px, 19, at19, 24, at19 * 32]
```

That expression came from [2026-09-14-01](2026-09-14-01-3d-view.md): hold the 2D pixel
width to z16, ease into a fixed width in *metres* by z19, then double with every zoom, so
the walk camera at z20–21 sees a trail about as wide as a real path under your feet.

Orbit runs through the same expression, though, and orbit climbs to z22
(`ORBIT_MAX_ZOOM = MAX_ZOOM - ZOOM_OFFSET`). At lat 37.5 that works out to:

| MapLibre zoom | trail | outer casing |
|---|---|---|
| ≤ 16 | 3 px | 13 px |
| 19 | ~8 px | ~22 px |
| 22 | ~67 px | ~176 px |

So zooming in fattened the line to a ribbon — 2D's behaviour is what was wanted in 3D too.

**The trade, taken deliberately:** the ground-locked width is gone rather than kept for
walk mode alone. Walking, the trail is now a 3 px screen line rather than a path-width
band. That is a real loss against the 3D view's original design, and it is the price of
one width that behaves the same wherever the camera is — no mode-dependent restyle, no
second rule to keep in step with the first.

Nothing changes at or below z16, where the ramp was already flat.

## Change

All of it in `src/scene3d.ts`.

1. `groundWidth()` deleted, with `TRAIL_METRES`, `HALO_METRES` and the now-unused
   `EARTH_RADIUS` import. `offset` from `./geo` stays — `circlePolygon()` uses it.

2. `TRAIL_WIDTH_3D = TRAIL_WEIGHT + 1` stays and is now the whole story. Its comment
   keeps the reason for the extra pixel (a draped line is resampled with the terrain
   texture and loses some of its weight) and records what the metre widths were for.

3. The three trail layers take plain numbers:

   | Layer | `line-width` |
   |---|---|
   | `trails` | `TRAIL_WIDTH_3D` (3) |
   | `trail-halo-outer` / `trail-halo` | `ring.weight - TRAIL_WEIGHT + TRAIL_WIDTH_3D` (13, 9) |
   | `trail-selected` | `TRAIL_WIDTH_3D` (3) |

   The casing arithmetic is unchanged, just no longer wrapped, and lands on exactly what
   the ramp already gave below z16.

4. `layers(lat)` → `layers()`, and `trailsLatitude()` is deleted — `layers()` was its
   only caller, and latitude only ever fed the metres-per-pixel scale.

`syncTrails()` in `view3d.ts` is untouched: it still only sets filters and `line-opacity`,
and the width is now the same in orbit, walk and playback.

## Files

| File | Change |
|---|---|
| `src/scene3d.ts` | `groundWidth`, `TRAIL_METRES`, `HALO_METRES`, `trailsLatitude` and the `EARTH_RADIUS` import removed; `layers()` loses its `lat`; three flat `line-width` values |

## Verification

1. `npm run build` passes. `noUnusedLocals` / `noUnusedParameters` are on, so the orphaned
   `lat`, `trailsLatitude` and `EARTH_RADIUS` would each have failed it.
2. `grep -rn "groundWidth\|TRAIL_METRES\|HALO_METRES\|trailsLatitude" src/` → no hits.
3. In the app, with a trail from `data/gpx/` loaded and **3D** open: zoom from the opening
   view to orbit's ceiling and the trail holds one width the whole way. Selected, its two
   casings hold 13 px and 9 px at every zoom. The 3D stroke stays one pixel heavier than
   2D's, by design.
4. Walking the trail shows the accepted trade-off: a thin line underfoot rather than a
   path-width band, unchanged as the eye height cycles (1.7 / 20 / 80 m).

## Follow-up

- If the walk view ever wants its path back, the width would have to become
  mode-dependent — `setPaintProperty` on the four trail layers from `setMode` in
  `view3d.ts`, with the ramp restored from git history for walk and playback only.
