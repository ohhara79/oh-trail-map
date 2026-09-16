# Show a scale bar on the map

## Context

Nothing on the map tells you how far anything is. The selected trail's bar gives
its length, but not the gap between two trails, from a car park to a point, or
across a ridge. The user asked for a scale bar, or something better. The other
options (km marks along the selected trail, distance from you in point popups,
a measure tool) were offered, and the user chose the scale bar alone.

The result is a metric scale bar in the bottom-left corner, in 2D and in 3D
orbit. Both libraries ship one, so this is mostly placement and styling.

## Approach

### 1. 2D — `src/map.ts`

After `L.control.zoom({ position: 'bottomright' })` (`src/map.ts:44`), add
`L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map)`, with a
comment: metric only, since the trails are in Korea; bottom-left because it is
the one map corner nothing else uses (`#expand` is top-left, `#view3d` is
top-right, zoom and `#locate` are bottom-right). The default `maxWidth: 100`
stays. With `zoomSnap: 0` it redraws on every move, so it stays right through a
pinch.

### 2. 3D orbit — `src/view3d.ts`

Import `ScaleControl` from `maplibre-gl` (`src/view3d.ts:13`). Next to the two
`NavigationControl`s (`src/view3d.ts:186`), add
`map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')` with a short
comment. The bar measures across the middle of the screen, so once orbit is
tilted it is only right at that depth. That is fine for a rough idea of distance.

### 3. Styles — `src/style.css`

- **Same look in both views.** Next to the other `#map3d .maplibregl-ctrl-group`
  rules (~`src/style.css:409`), give `#map3d .maplibregl-ctrl-scale` Leaflet's
  `.leaflet-control-scale-line` look (2px `#777` border with no top, a
  translucent white background, 11px text), so switching views doesn't change
  the bar. This follows how the zoom buttons were already matched. Both bars
  sit at the zoom control's 10px margin instead of Leaflet's 5px, so the two
  bottom corners line up.
- **Hidden at eye height.** Add `.maplibregl-ctrl-bottom-left` to the existing
  walk/playback rule at `src/style.css:422` that hides the bottom-right controls.
  A scale bar means nothing in a first-person view, and the touch joystick sits
  in that corner.
- **Above the selection bar.** `#selection-bar` spans 10–44px up, is centred,
  and on a phone (or a narrow map beside the open panel) it is as wide as the
  map minus 68px, so it would cover the scale bar. Add
  `#app[data-selection] :is(.leaflet-control-scale, .maplibregl-ctrl-scale)
  { margin-bottom: calc(54px + env(safe-area-inset-bottom)); }`. That leaves the
  same 10px gap as `#notices` already has (`src/style.css:651`). `data-selection`
  is set by `src/ui.ts:261`.
- Leave `#notices` alone. Notices are short-lived and draw above the bar
  (z-index 1200).

### 4. README

Add to the "OSM basemap…" feature bullet: a metric scale bar in the bottom-left,
in 2D and 3D orbit.

### 5. Plan doc

Save this plan as `docs/plans/2026-09-17-06-map-scale-bar.md`.

## Files

| File | Change |
|------|--------|
| `src/map.ts` | `L.control.scale` bottom-left, metric |
| `src/view3d.ts` | `ScaleControl` bottom-left, metric |
| `src/style.css` | match the 3D bar to Leaflet's; hide it while walking; lift both above the selection bar |
| `README.md` | mention the scale bar |

## Verification

1. `npm run build`: typecheck and bundle are clean.
2. `npm run dev`, desktop with the panel open and closed, and at 390×844:
   - 2D: a metric bar in the bottom-left that updates on zoom and pinch
     (e.g. "500 m" becomes "1 km").
   - Select a trail: the bar moves above the selection bar and doesn't overlap
     it; clear the selection and it drops back.
   - 3D orbit: the same bar in the same place, looking the same; tilting and
     zooming update it.
   - Walk and ▶ playback: the bar is hidden (and on touch, the joystick corner is
     clear). Back to orbit, it returns.
