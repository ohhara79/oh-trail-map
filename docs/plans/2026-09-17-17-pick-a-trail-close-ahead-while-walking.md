# A trail close in front of you can be picked while walking

## Context

In 3D Walk, if you aim the crosshair at a trail a few metres ahead and tap, nothing
happens. A trail further off, still within reach, can be picked. The user reported it
as "when I am too close to the trail, I can't click it".

**Cause: a MapLibre 6.9.0 bug in `queryRenderedFeatures`.** `aimedTrail()` →
`trailIn()` (`src/view3d.ts:406`) asks `map.queryRenderedFeatures` for the box around the
crosshair. MapLibre pads that box by `transform.maxPitchScaleFactor()`
(`node_modules/maplibre-gl/src/geo/projection/mercator_transform.ts:816`). That value is
the depth of the screen's top-left corner, found where it meets the plane at the
centre's elevation, divided by the depth of the centre. If that corner is above the
plane's horizon, the ray meets the plane behind the camera, and the factor comes out
**negative**. Then:

- `TileManager.tilesIn` calls `tileSpaceBounds.expandBy(negative)`, and the bounds
  collapse to empty, so no tile is queried.
- `FeatureIndex.query` shrinks its grid query by the same negative padding.

The walk camera looks at a centre 15 m ahead along your view (`eyeCamera`,
`src/firstPerson.ts:72`), with a 50° vertical FOV. That puts the corner above the horizon
whenever you look between level and about 25° down. That is exactly how you aim at
ground a few metres ahead. MapLibre's own `MercatorTransform` gives these values (the
distance is the ground at the crosshair from 1.7 m):

| look | factor | ground at |
|---|---|---|
| −3° | −0.13 | 32 m |
| −5° | −0.23 | 19 m |
| −10° | −0.61 | 9.6 m |
| −20° | −3.56 | 4.7 m |
| −26° | +22.8 | 3.5 m |
| −45° | +1.87 | 1.7 m |

The padding is the trail's line-width radius, about 50 px at walk zoom, times this
factor. It wipes out the ±12 px query box from about 4 m to about 17 m ahead, so those
taps find nothing. Further off, the factor is close to 0 and the box survives. Right
under your feet the factor is positive. Orbit's steepest tilts are affected too: at
85° pitch the top edge is above the horizon, so hover and click near the top of a
tilted view miss in the same way.

## Change

### `src/view3d.ts`

1. In the `-- clicks --` section, before `pointAt()`, patch the map's transform once
   so its pitch scale factor is never below 1:

   ```ts
   const { transform } = map._camera;
   const pitchScale = transform.maxPitchScaleFactor.bind(transform);
   transform.maxPitchScaleFactor = () => Math.max(1, pitchScale());
   ```

   Add a comment in the style of the `sourcedata` workaround that explains the bug:
   past the horizon the factor is negative and the query box collapses. It should also
   say why 1 is safe. `queryRenderedFeatures` is the only thing that reads the factor,
   and only to pad the tile and grid lookups. Every candidate still goes through the
   exact test (`queryIntersectsFeature`, which uses the line's real half-width), so a
   larger pad can only let more candidates through, never give a wrong hit. A factor of
   1 already covers a map-aligned line's width.

   In MapLibre 6 the transform lives on `map._camera`, which is declared in the
   typings, as `compass._handler` is. `map.queryRenderedFeatures` reads it from there.
   It is replaced only by `migrateProjection`, which runs when the style's projection
   is set: that has already happened by the time `style.load` has fired, and
   `view3d.ts` never calls `setStyle` or `setProjection`.

`trailIn()`, `aimedTrail()`, `inReach()` and `pointAt()` stay as they are: the
reach, nearest-wins and the 12 px crosshair tolerance are unchanged.

### Repo plan doc

2. Save this plan as `docs/plans/2026-09-17-17-pick-a-trail-close-ahead-while-walking.md`.

## Files

| File | Change |
|---|---|
| `src/view3d.ts` | Clamp `map._camera.transform.maxPitchScaleFactor()` to at least 1, with a comment explaining the MapLibre bug |
| `docs/plans/2026-09-17-17-pick-a-trail-close-ahead-while-walking.md` | This plan |

## Verification

1. `npm run build` passes (tsc + vite).
2. `npm run dev`, with a trail from `data/gpx/` loaded, open **3D** → **Walk** at 1.7 m:
   - Stand 3–15 m from a trail, aim the crosshair at the band and tap. It gets
     selected. Before the fix this did nothing.
   - Stand right on the trail and look down at it, then look at it ~30 m ahead. Both
     still select it.
   - A trail more than 50 m away still can't be picked. Where two trails run close
     together, the nearer one to the crosshair is still picked.
   - Repeat at 20 m and 80 m eye heights.
3. **Orbit**, tilted to the maximum pitch: hover over and click a trail near the top of
   the view. The preview and selection work. At low pitch, hover and click behave as
   before.
