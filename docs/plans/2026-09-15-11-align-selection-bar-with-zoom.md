# Line the selection bar up with the zoom control

## Context

Clicking a trail shows `#selection-bar` (name · distance · ▶ 3D · ×) at the bottom of
the map, 34px tall. It sits next to the zoom control, but slightly out of line with it:

- The bar uses `bottom: calc(12px + env(safe-area-inset-bottom))` (`src/style.css:428`).
- The zoom control sits on the 10px corner margin that Leaflet uses
  (`.leaflet-right .leaflet-control`) and MapLibre uses too
  (`.maplibregl-ctrl-bottom-right .maplibregl-ctrl { margin: 0 10px 10px 0 }`). With the
  border-box sizing, that's 2px border + 30px zoom-in + 30px zoom-out + 2px border, so it
  spans 10–74px from the bottom.

So the bar spans 12–46px. That leaves its bottom edge 2px above the control's, and its
text 2px above the middle of the zoom-out (−) button. At `bottom: 10px` the bar spans
10–44px. Its bottom edge then meets the control's, and the space inside its border
(12–42px) matches the − button's 12–42px exactly, so the labels line up with the − glyph.
The same holds in 3D, where MapLibre's control also sits 10px up.

The right side already follows this rule: `#locate`, `#view3d` and `#compass` use 10px
so they line up with the control (comment at `src/style.css:238-246`). The selection bar
was the only thing near the control still on 12px.

## Change (all in `src/style.css`)

1. **`#selection-bar`** (~line 428): `bottom: calc(12px + …)` → `bottom: calc(10px + env(safe-area-inset-bottom));`
   and add a short comment saying 10px is the zoom control's margin, so the two share a
   bottom edge and the text lines up with the − button.
2. **`#playback3d`** (~line 408): same 12px → 10px. The selection bar is "placed like
   #playback3d" and gives way to it, so they should stay the same. Otherwise starting ▶ 3D
   would move the bottom bar up 2px.
3. **Notices offset** (~line 487): `#app[data-selection] #notices` `56px` → `54px`
   (bar top at 10 + 34 = 44, plus the same 10px gap).
4. **Plan doc**: save this plan as `docs/plans/2026-09-15-11-align-selection-bar-with-zoom.md`
   (repo convention).

No change to horizontal placement (left 12 / right 56, centred, max-content). That keeps
a 12px gap to the zoom column.

## Verification

- `npm run build` passes.
- `npm run dev`, click a trail:
  - 2D: in DevTools, the bottom of `#selection-bar` and of `.leaflet-control-zoom` have
    the same `getBoundingClientRect().bottom`. The bar's text is vertically centred on
    the − button.
  - 3D orbit: its bottom matches `.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group`.
  - ▶ 3D → playback bar sits at the same height as the selection bar did.
  - A notice (e.g. locate denied) shows above the bar with a 10px gap.
