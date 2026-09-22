# Keyboard shortcuts on a PC, and a `?` sheet listing them

## Context

On a PC almost everything takes a mouse click. The only keys were Escape, WASD /
arrows / Shift / Space while walking, the profile chart's arrows once focused, and
Leaflet's own `+` `-` and arrows. Wanted: single-key shortcuts for the common
actions, and a way to find out what they are.

## Behaviour

- Single keys, matched on `e.code` (like `walkControls.ts`), so the Korean IME does
  not turn them into jamo. Never W A S D, arrows, Space or Shift, which walking owns;
  never with Ctrl / Alt / Meta; never while a text box has focus (a focused checkbox
  or slider does not count, or clicking one would leave the keys dead).
- Anywhere: `?` the sheet, `/` panel + trail filter, `L` panel, `3` 2D ↔ 3D,
  `E` elevation profile, `,` `.` previous / next GPX point (`Shift` ×10, repeats
  when held), `Enter` walk the selected trail, `C` zoom to it, `G` locate / follow,
  `B` next basemap, `H` every national point off, or back on.
- 3D: `V` walk ↔ orbit, `M` minimap, `P` play / pause (Space still works), `X` speed.
- `N` for north-up was dropped: `#compass` only asks iOS for the compass, and the
  2D map never rotates.
- Escape with the sheet open closes the sheet and nothing else.

## Change

1. **`src/shortcuts.ts`** (new): `installShortcuts(cb)`. Most keys press the button
   already on screen (`#view3d`, `#playback3d-profile` / `#selection-profile`,
   `#locate`, `#walk3d`, `#play3d`, `#speed3d`, `#minimap3d`, `#selection-walk`), so
   a key does what the click does and nothing where the button is not laid out. The
   rest go through callbacks. A capture-phase Escape listener, registered before
   view3d.ts's, closes the sheet first.
2. **`src/main.ts`**: `zoomToTrail` and `setBasemap` pulled out of the Ui callbacks
   so the keys share them; `installShortcuts` wired after `ui.applySettings`.
   `applyAbout` shows the footer's shortcut link where `canHover()`.
3. **`src/ui.ts`**: `togglePanel()`, `focusTrailSearch()`.
4. **`src/profilePanel.ts`**: `step()` public.
5. **`index.html`, `src/style.css`**: the `#shortcuts` `<dialog>` and the footer link.
6. **`README.md`**: a Keyboard shortcuts section.

## Verification

1. `npm run build` passes.
2. Scratchpad playwright script (swiftshader for WebGL2): `?` opens and Esc closes
   the sheet; `L` toggles the panel; `/` focuses the filter and typing `bh` there
   triggers nothing; `B` cycles the basemaps; `H` toggles `#point-all`; with a trail
   selected `E` opens the profile and `.` `.` `Shift+.` `,` step 1, 2, 12, 11; `3`
   opens 3D, `V` walks, `M` toggles the minimap, `?` + Esc leaves the walk alone,
   `V` back to orbit, `3` back to 2D; `Enter` plays the trail, `P` pauses, `X` goes
   5× → 20×, `E` hides the playback profile. No page errors.
