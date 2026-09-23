# Take the 3D hover label down with the 3D view

## Context

Walking up to a national point in 3D shows its name in the hover label beside the ball
(`syncNearby`, `src/view3d.ts`). Leaving for 2D while that name was showing, then
entering 3D walk again, left the name stuck on screen for good.

`createHoverLabel(container)` (`src/hoverLabel.ts`) appends a `.map-hover-label` div to
`#map3d`, which `src/main.ts` reuses for every 3D session. `destroy()` in
`src/view3d.ts` removed the MapLibre map, the HUD and the location marker, but not that
div — and `map.remove()` only takes MapLibre's own elements. The old label stayed in
`#map3d`, unhidden, and the next 3D view made a second label of its own, so nothing
ever hid the first one again.

## Change

1. `src/hoverLabel.ts`: `HoverLabel` gains `remove()`, which takes the label's element
   out of its container.
2. `src/view3d.ts` `destroy()`: calls `hoverLabel.remove()` beside
   `locationMarker.remove()`.

The 2D map lives for the whole page, so its label needs nothing.

## Verification

1. `npx tsc --noEmit` passes.
2. Enter 3D, walk up to a point until its name shows, press 2D. Enter 3D and walk
   again: no name is left over, and one shows again beside the next point you reach.
3. In orbit, hovering a point still shows its name, and moving off it hides it.
