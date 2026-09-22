# `K` switches the minimap's size

## Context

In 3D walk and playback the 2D minimap only changed size (small ↔ large) with a click on the inset. `M` turns it on and off; its size had no key.

## Change

1. `src/main.ts`: the click handler's size toggle becomes `toggleMinimapSize()`, which does nothing unless the minimap is showing (3D walk or playback, minimap on). The click and `K` both call it.
2. `src/shortcuts.ts`: `toggleMinimapSize` in `ShortcutCallbacks`, on `KeyK`.
3. `index.html` (the `?` sheet) and `README.md`: list `K`.

## Verification

1. `npm run build` passes.
2. Walk and playback: `K` grows and shrinks the minimap, as a click does; `M` off and on again keeps the size.
3. Minimap off, orbit and 2D: `K` does nothing.
