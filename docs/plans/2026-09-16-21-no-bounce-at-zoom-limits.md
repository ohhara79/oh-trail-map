# Pinch stops at the zoom limit in 2D, as in 3D

## Context

At the deepest zoom, a pinch-out behaves differently in the two views:

- **3D (MapLibre)** stops: the camera won't go past `ORBIT_MAX_ZOOM` (`src/view3d.ts`).
- **2D (Leaflet)** keeps scaling the map while your fingers are down, then snaps back to
  `MAX_ZOOM` (23) when you let go.

The snap-back is a Leaflet default. `TouchZoom` has a `bounceAtZoomLimits` map option,
which is `true` unless you turn it off
(`node_modules/leaflet/src/map/handler/Map.TouchZoom.js`). With it off, `_onTouchMove`
holds the pinch at `getMaxZoom()` / `getMinZoom()`. That's how MapLibre already works, at
both ends. `createMap` never set the option, so 2D got the bounce.

## Change

1. `src/map.ts`: `bounceAtZoomLimits: false` on the `L.map` options, next to
   `zoomSnap`/`zoomDelta`. It covers the minimum zoom too, where MapLibre also stops
   without bouncing.

No other code changes. The scroll wheel and the +/- buttons already stop at `maxZoom`. Only
touch pinch had the overshoot.

## Files

| File | Change |
|---|---|
| `src/map.ts` | `bounceAtZoomLimits: false` on `L.map` |

## Verification

1. `npm run build`: the type check and build pass.
2. `npm run dev` on a phone, or Chrome DevTools touch emulation. In 2D, zoom to z23 with
   the + button, then pinch out. The map should not grow, and nothing should jump when
   you let go.
3. Pinch in from z23: it should zoom out normally.
4. Switch to 3D at max zoom and pinch out. It still stops, so the two views now match.
5. In 2D, zoom all the way out and pinch in: it also stops without bouncing.
