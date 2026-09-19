# See-through elevation profile

## Context

The elevation panel (`#profile`) covers a 76px strip of the map or the 3D scene with
two opaque layers: `.hud-bar`'s `#fff` on the panel and `#f4f6f8` on `#profile-chart`.
The user wants the map to show through it, at a low alpha.

## Change (`src/style.css`)

1. **`#profile` gets `background: rgba(255, 255, 255, .35)`**, overriding `.hud-bar`'s
   white for this panel alone; the selection and playback bars stay solid. The 2px
   `rgba(0,0,0,.2)` border stays, so the panel's edge still reads.
2. **`#profile-chart` loses its `#f4f6f8` fill**, which would otherwise be a second,
   opaque layer.
3. **The text halos go from `#f4f6f8` to `#fff`** on `.profile-label` and
   `.profile-readout`. With no solid ground under them, the halo is what keeps the
   readout and the corner labels readable over busy tiles.
4. The line, area, cursor and ◀ ▶ buttons are unchanged: the accent line and fill
   still read over the map, the cursor dot already has a white stroke, and the
   buttons keep their own background so they still look pressable.

## Verification

- `npm run build` passes.
- Select a trail: roads and labels show through the panel, and the readout, min/max,
  file name and length stay readable — also in 3D orbit, walk and playback, where
  auto-hide still fades it. Scrubbing the chart works as before.
