# A point's popup over its ball while walking

## Context

[2026-09-17-14](2026-09-17-14-floating-point-balls-while-walking.md) made each national
point a ball while walking and in playback. The ball has a 1 m radius, with its centre
2 m above the ground. But the popup is still placed with `setLngLat([lon, lat])`, and
MapLibre's `Popup._update` projects that onto the terrain. So the popup's tip lands on
the ground under the ball, next to its shadow. The user wants the popup **above the
ball**. Orbit keeps its dots, so it also keeps its popup placement.

MapLibre popups have no altitude. They do have `setOffset`, which re-runs `_update`. So
while walking, the offset is set to the pixel gap between the ground point and the top of
the ball. MapLibre 6 no longer exposes `map.transform`, so the projection is taken from
the matrix the ball layer is handed (`defaultProjectionData.mainMatrix`), which is public
API.

## Change

### `src/pointBalls.ts`

1. `render()` keeps a double-precision copy of `mainMatrix`.
2. **`project(lon, lat, alt)`** maps a spot at `alt` metres above sea level through that
   matrix to CSS pixels on the canvas. It returns null before the first frame, or when
   the spot is behind the camera (`w <= 0`).

### `src/view3d.ts`

3. **`ballTop(lngLat)`** projects `queryTerrainElevation` + `BALL_HEIGHT` +
   `BALL_RADIUS` with `balls.project`. It returns null while the terrain has not loaded.
4. **`liftPopup()`** sets the offset to `[top.x − base.x, top.y − base.y − 10]`, where
   `base = map.project(lngLat)`. This keeps the same 10 px gap above the ball that orbit
   has above the dot. In orbit, or when `ballTop` is null, the offset is plain `10`.
5. **Call sites:**
   - **The `render` event while walking**, not `move`. The ball layer has just drawn with
     the matrix `ballTop` uses, so the popup lines up with that frame. A `render` also
     happens when finer terrain arrives, which fires no `move`.
   - **`openPopup()`**. Standing still draws no frame, so the first placement cannot wait
     for one.
6. **`inWalkView`** tests the ball top against the canvas when it is known, because the
   popup sits there now.

## Files

| File | Change |
|---|---|
| `src/pointBalls.ts` | keep the last matrix; `project()` |
| `src/view3d.ts` | `ballTop`, `liftPopup`; lifted on `render` and in `openPopup`; `inWalkView` uses the ball top |

## Verification

1. `npm run build` passes.
2. `npm run dev`, with National Points on, open **3D**:
   - **Orbit:** tap a dot. The popup sits just above it, as before.
   - **Walk:** aim at a ball and tap. The popup's tip sits just above the ball, not on
     its shadow. Walk toward it, back off and look up and down: the popup stays on the
     ball.
   - Look away until the ball leaves the screen: the popup closes.
   - Open a point from the panel list while walking. The popup sits over its ball, or on
     the ground until the terrain there loads.
   - **Playback:** the same as walk.
