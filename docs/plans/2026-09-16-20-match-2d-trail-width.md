# A 3D trail as thin as the 2D one

## Context

After [2026-09-16-19](2026-09-16-19-flat-3d-trail-width.md) a 3D trail held one width at
every zoom, but that width was still a little heavier than 2D's. `src/scene3d.ts` drew it at

```ts
const TRAIL_WIDTH_3D = TRAIL_WEIGHT + 1;
```

on the theory that a draped line is resampled with the terrain texture and loses some of
its weight. On screen it doesn't lose enough to need the pixel: 3 px against 2D's
`TRAIL_WEIGHT = 2` is half as thick again, and it reads that way. The casings carried the
same extra pixel — 13 / 9 px against 2D's 12 / 8 px (`HALO_RINGS` in `src/selection.ts`).

MapLibre's `line-width` is in CSS pixels, scaled by the map's `pixelRatio` just as the
browser scales Leaflet's SVG stroke, so the same number is the same width in both views.

## Change

All of it in `src/scene3d.ts`.

1. `TRAIL_WIDTH_3D` deleted, with its "one pixel heavier" reason. The rest of its comment —
   plain pixel widths at every zoom, and why the metre ramp went — moves onto `layers()`.
2. The trail layers take the 2D numbers as they are:

   | Layer | `line-width` |
   |---|---|
   | `trails` | `TRAIL_WEIGHT` (2) |
   | `trail-halo-outer` / `trail-halo` | `ring.weight` (12, 8) |
   | `trail-selected` | `TRAIL_WEIGHT` (2) |

   The casing arithmetic goes: `ring.weight` is exactly what `Halo.show` passes to
   `L.polyline` in 2D.

## Files

| File | Change |
|---|---|
| `src/scene3d.ts` | `TRAIL_WIDTH_3D` removed; trail and casing widths are the 2D ones |

## Verification

1. `npm run build` passes.
2. `grep -rn TRAIL_WIDTH_3D src/` → no hits.
3. In the app, with a trail from `data/gpx/` loaded: 2D and 3D (pitch 0) at a similar zoom
   draw the trail, and a selected trail's two casings, at the same width.
4. At a steep pitch over hilly ground the line still reads clearly. If it turns faint
   there, the extra pixel was earning its keep after all.
