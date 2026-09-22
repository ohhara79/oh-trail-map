# Remove the `/` shortcut

## Context

`/` opened the panel with the trail filter focused. It is easy to press by accident, and then the next keys type into the filter instead of reaching the map. The shortcut goes; the filter stays, a click away once `L` opens the panel.

## Change

1. `src/shortcuts.ts`: `focusSearch` leaves `ShortcutCallbacks`, and `Slash` leaves the key map.
2. `src/main.ts`: the `focusSearch` callback goes.
3. `src/ui.ts`: `focusTrailSearch()` goes with its only caller.
4. `index.html` (the `?` sheet) and `README.md` drop the `/` row.

## Verification

1. `npm run build` passes.
2. Pressing `/` does nothing, and the `?` sheet no longer lists it.
3. Clicking the filter and typing still filters the trails.
