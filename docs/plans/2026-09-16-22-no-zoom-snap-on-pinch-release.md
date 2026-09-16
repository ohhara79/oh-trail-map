# Pinch release keeps its zoom in 2D, as in 3D

## Context

When you lift your fingers after a pinch, the two views behave differently:

- **3D (MapLibre)** keeps the zoom exactly where your fingers left it. MapLibre zoom is
  fractional.
- **2D (Leaflet)** jumps a little. `createMap` set `zoomSnap: 1`, so on release
  `TouchZoom._onTouchEnd` animates to `_limitZoom(zoom)`, which rounds to the nearest whole
  level (`node_modules/leaflet/src/map/handler/Map.TouchZoom.js`, `Map.js` `_limitZoom`). A
  pinch that stops at 14.4 eases to 14, and one that stops at 14.6 eases to 15.

The snap was there so tiles are always drawn at a whole scale (1x, 2x, 4x) and stay sharp.
We're giving that up so 2D behaves like 3D.

## Change

1. `src/map.ts`: `zoomSnap: 0`, with a new comment. `zoomDelta: 1` stays, so +/- still
   steps one whole level, like MapLibre's buttons. `bounceAtZoomLimits: false` stays.
2. `src/view3d.ts` `viewFor2d()`: remove `Math.round` from the orbit zoom it hands back.
   Otherwise closing 3D would still snap 2D to a whole level. 2D → 3D already passed
   `map.getZoom()` unrounded.

Side effects, accepted:

- In 2D, wheel zoom is smooth and fractional, as it already is in 3D.
- `fitBounds` on a trail row fits tightly at a fractional zoom instead of rounding down.
- Between whole levels, tiles are scaled by a non-integer factor, so they look a little soft.

## Files

| File | Change |
|---|---|
| `src/map.ts` | `zoomSnap: 0` |
| `src/view3d.ts` | `viewFor2d` stops rounding the zoom |

## Verification

1. `npm run build`: the type check and build pass.
2. On a phone, or with DevTools touch emulation, pinch in 2D to a zoom between two levels
   and let go. Nothing should move. Do the same in 3D and check the two match.
3. The +/- buttons still step one level. A pinch still stops at MAX_ZOOM with no bounce.
4. Go 2D → 3D → 2D at a fractional zoom. The view shouldn't jump either way.
