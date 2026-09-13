# 64 distinct trail colours, no colour picker

## Context

`PALETTE` (`src/trails.ts`) had 8 colours, and `nextColor(index)` wraps around. With the 36
files in `data/gpx/`, each colour was used 4–5 times, and trails in the same area often
looked alike. More trails are coming, so the palette is now a fixed list of **64** colours
chosen to be as far apart as possible. The 65th trail starts again from the first colour.

The per-trail colour picker is gone, and every colour comes from the palette. This also
fixes stale colours: `setVisible()` and show/hide-all used to store each trail's colour in
IndexedDB, and at boot `record?.color ?? nextColor(index)` kept the old palette colour. Now
nothing reads a stored colour.

A trail's colour depends on its file's position in the sorted list. The files are named
`ohhara_<increasing id>.gpx`, so a new trail goes at the end and existing trails keep their
colours.

## Change

1. **`src/trails.ts`: the 64-colour `PALETTE`.** The colours were chosen once by a greedy
   search in OKLab (the script is not committed):
   - The candidates are a 16-level sRGB grid (steps of 17), filtered to OKLab lightness
     0.40–0.75 and chroma ≥ 0.08. That rules out pastels and near-blacks, which a 2 px
     line loses on the street, topo, and satellite basemaps.
   - These colours count as already taken but are never output:
     - `#ffffff` and `#1f2328`: the halo, `selection.ts`
     - `#b45309` and `#64748b`: the pins, `points.ts`
     - `#1a73e8`: the location dot, `map.ts`
     - OSM ground colours: `#f2efe9 #add19e #c8facc #aad3df #e0dfdf #d9d0c9 #f7fabf #fcd6a4`
   - Each step takes the candidate farthest from everything taken so far. The first N
     colours are therefore the most distinct N, whatever N is.
   - The smallest distance between any two of the first 36 colours is 0.100, and 0.078
     across all 64. Every palette colour is at least 0.084 from the taken colours.
   - `nextColor` is unchanged. The comment on `Trail.color` now says the colour comes from
     the palette.
2. **The colour picker is removed.**
   - `src/ui.ts`: `onTrailColor` is gone. The `<input type="color">` is replaced by a
     `<span class="trail-swatch">` in the same place. It is not interactive, and a click on
     it goes to the row, which selects and zooms.
   - `src/main.ts`: no `onTrailColor` handler. At boot every trail gets `nextColor(index)`,
     and `toRecord()` no longer writes `color`.
   - `src/store.ts`: `TrailRecord` is `{ id, visible }`. Old records still have a `color`
     field. It is ignored, and it disappears the next time the record is written.
   - `src/style.css`: `.trail-swatch` (12×12, 1 px border, 3 px radius, `flex: none`)
     replaces both `input[type='color']` rules.
3. **`README.md`**: the features list says "a distinct colour", and only visibility is
   saved.

## Verification

1. `grep -rn "onTrailColor\|type='color'" src` finds nothing.
2. `npm run build`: the typecheck and build pass.
3. `npm run dev` in a browser with existing saved records:
   - 36 different swatches, each matching its line on the map.
   - Visibility persists across reloads, and colours don't change.
   - Clicking a swatch selects and zooms.
   - The lines stay readable on all three basemaps.
