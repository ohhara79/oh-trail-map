# Start with the panel hidden on every screen

## Context

On a phone the control panel started hidden, so the map was unobstructed. On a desktop it started open. It should start hidden everywhere. On a desktop it can still be opened with ☰ or `L`.

## Change

In `src/ui.ts`, the constructor calls `setPanel(false)` on every screen. It no longer checks `DRAWER_QUERY`. The panel state is still not persisted. `DRAWER_QUERY` stays, because picking a row still closes the drawer on small screens.

## Verification

1. `npm run build` passes.
2. At desktop width:
   - A fresh load shows the full-width map, with ☰ in the top-left and no sidebar.
   - ☰ or `L` opens the panel and the map resizes. `«` or `Esc` closes it.
   - `/` opens the panel with the cursor in the filter.
3. At phone width, the panel still starts closed and opens as a drawer.
