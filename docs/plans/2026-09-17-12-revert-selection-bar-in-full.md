# Revert the selected trail in full on the map

## Context

`2026-09-17-07-selection-bar-in-full` (commit df63959) made the selection bar show
the trail's whole name, wrapped, over the full `statsLine()` stats. The bar grew
with the name and wrote its height to `--selection-h` so the notices and the scale
bar sat above it. On a phone that bar got tall and covered too much of the map. The
bar goes back to what it was before: a single 34px line with the name ellipsized and
only the distance.

## Change

1. **`git revert df63959`.** Later commits only touched the `#crosshair3d` comment
   in `src/style.css`, a separate hunk, so the revert applies cleanly. It:
   - `index.html`: drops the `selection-stats` class.
   - `src/style.css`: `#mode3d, #selection-bar { height: 34px; }` again, the
     one-line `.selection-text` and ellipsizing `.selection-name`, no
     `.selection-stats`, and the notices and scale bar back at the fixed `54px`.
   - `src/ui.ts`: removes the `ResizeObserver` that wrote `--selection-h`, and the
     stats are `formatDistance(trail.stats.distance)` again.
   - Deletes the 07 plan doc.

## Verification

1. `npm run build`: typecheck and bundle pass.
2. `grep -rn selection-h src index.html` finds nothing.
3. `npm run dev`, narrow viewport: selecting a long-named trail shows a single 34px
   bar with the name ellipsized and the distance, and the notices and the scale bar
   sit just above it.
