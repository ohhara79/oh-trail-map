# Line the 3D button up with the locate button on the right

## Context

`#view3d` (top-right) and `#locate` (bottom-right) are the same 34px box, but their
right offsets differ: `#locate` uses `right: 10px` (Leaflet's control margin, so it
lines up with the zoom control below it — and MapLibre's control uses the same 10px in
3D), while `#view3d` and the iOS-only `#compass` beneath it use `right: 12px`
(`src/style.css`). So the top-right buttons sit 2px further left than the locate button
and zoom control. The user wants them in one column.

## Change

1. **`src/style.css`, `#view3d`** — `right: calc(12px + env(safe-area-inset-right))`
   → `calc(10px + …)`.
2. **`src/style.css`, `#compass`** — same 12px → 10px, so the top-right stack stays a
   single column with `#view3d`. Top offsets unchanged (only horizontal alignment was
   asked for).
3. **`src/style.css`, comment above `#locate`** — it said the top-corner buttons use
   12px because they have no neighbour to align to; reword to say every right-side
   button uses Leaflet's 10px margin so they share one column with the zoom control.
   Leave `#expand` (top-left, 12px) alone.
4. **Plan doc** — save as `docs/plans/2026-09-15-04-align-right-side-buttons.md`.

## Verification

- `npm run build` passes.
- `npm run dev`, open the app on desktop and a ~400px viewport: the 3D button's right
  edge lines up with the locate button and zoom control in 2D, and with the locate
  button and MapLibre control after switching to 3D.
