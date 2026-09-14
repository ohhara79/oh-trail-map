# Compass above the locate button in 3D

## Context

In 3D, `src/view3d.ts` added one MapLibre `NavigationControl({ visualizePitch: true })`
bottom-right. That is one group of three buttons: zoom-in, zoom-out and the compass
(camera direction). So the compass sat *under* zoom-out, and the group reached 104px up
instead of the 74px of Leaflet's 2D zoom control. To clear it, `src/style.css` raised
`#locate` from 84px to 114px in 3D (`#app[data-view='3d'] #locate`). The result was that
entering 3D moved the locate and zoom buttons around.

Goal: locate, zoom-in and zoom-out stay exactly where they are in 2D. The compass becomes
its own 34px button directly above `#locate`, with the same 10px gap.

## Change

1. **`src/view3d.ts`**: split the control in two:
   `NavigationControl({ showCompass: false })`, then
   `NavigationControl({ showZoom: false, visualizePitch: true })`. MapLibre puts each
   bottom-position control before the first child, so the second one (the compass)
   stacks above the zoom group. The zoom-only group is 2px border + 30 + 30 + 2px border
   = 64px on a 10px margin, reaching 74px up, the same as Leaflet's.
2. **`src/style.css`**:
   - Remove the `#app[data-view='3d'] #locate` rule. `#locate` stays at 84px in both views.
   - Add `#map3d .maplibregl-ctrl-group:has(> .maplibregl-ctrl-compass) { margin-bottom:
     calc(54px + env(safe-area-inset-bottom)); }`. `#locate` spans 84–118px, so the
     compass needs to start at 128px, which is 74 + 54. The inset matches the `env()` term
     in `#locate`'s own offset. The existing group border and 30px button rules already
     make it a 34px box on the 10px right margin, so it lines up with `#locate` on both
     edges.
   - Update the `#view3d` comment that said the bottom-right stack shifts between views.

Walk and playback already hide the whole `.maplibregl-ctrl-bottom-right` container, so
both groups hide together.

## Verification

- `npm run build` passes.
- `npm run dev`, toggle 3D: locate, zoom-in and zoom-out don't move. The compass is a
  separate 34px button 10px above locate, right edges aligned. Rotating or pitching
  still turns and tilts it, and clicking it resets north.
- Walk / Playback: the MapLibre controls hide. Back to Orbit and they return in place.
