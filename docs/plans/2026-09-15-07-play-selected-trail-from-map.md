# Play the selected trail in 3D from a selection bar

## Context

Clicking a trail on the map selects it and shows its name for 3 seconds
(`selectTrail(id, true)` → `ui.notify`, `src/main.ts:319`). To walk it in 3D you
then have to open the panel (☰), find the highlighted row and press its ▶. On a
phone that is three steps and a drawer covering the map.

Change: while a trail is selected, a small bar sits at the bottom of the map with
the trail's name, its distance, a **▶ 3D** button and a **×**. ▶ does exactly what
the row's ▶ already does. The bar replaces the 3-second name notice.

```
┌──────────────────────────────────────┐
│ 북한산 둘레길 · 12.3 km   [▶ 3D] [×] │
└──────────────────────────────────────┘
```

## Change

1. **`index.html`** — add the bar inside `#app`, next to `#notices` (outside `#hud3d`,
   so it works in 2D too):
   ```html
   <div id="selection-bar" class="hud-bar" hidden>
     <div class="grow selection-text">
       <span id="selection-name" class="selection-name"></span>
       <span id="selection-stats" class="muted"></span>
     </div>
     <button id="selection-walk" type="button" title="Walk this trail in 3D">&#9654; 3D</button>
     <button id="selection-clear" type="button" title="Clear selection" aria-label="Clear selection">&times;</button>
   </div>
   ```

2. **`src/ui.ts`**
   - New fields for the four elements.
   - `bind()`: `selection-walk` click → `cb.onWalkTrail(this.lastSelectedId)` (when not
     null); `selection-clear` click → `cb.onSelect(null)`.
   - `renderTrails()` already receives `trails` and `selectedId`, and every selection
     change goes through it (`refresh()` in `selectTrail`). Fill the bar there, from
     `trails` (not `matches`, so a filter never hides it): name, and
     `formatDistance(trail.stats.distance)`; `hidden = !selected`. Set
     `app.dataset.selection` when shown and delete it when not (used by CSS below).
     The walk button's `aria-label` is `Walk ${trail.name} in 3D`, like the row's.

3. **`src/main.ts`**
   - `selectTrail()`: drop the `fromMap` notice and the parameter, since the bar now
     names the trail wherever the click came from. Update its comment. Update the two
     callers (`map.on('click')` and the 3D `onSelect`).
   - `onWalkTrail` is reused as-is: shows the trail, selects it, closes the drawer,
     opens 3D and plays. (A selected trail is always visible — `setVisible` clears the
     selection when hiding.)

4. **`src/style.css`**
   - `#selection-bar`: same placement as `#playback3d` — `bottom: calc(12px + safe-area)`,
     `left: 12px; right: 56px` (clears the zoom/locate column), `max-width: 560px;
     margin: 0 auto`. `.hud-bar` already gives chrome and z-index 1000 (under the phone
     drawer and backdrop). `#selection-bar[hidden] { display: none; }` — `.hud-bar`'s
     `display: flex` would otherwise beat the reset.
   - `.selection-text` flex row with a gap; `.selection-name` ellipsis like
     `.playback3d-name`; `#selection-walk` in the accent colour.
   - Hide it while the 3D HUD owns the bottom edge:
     `#app[data-mode3d='walk'] #selection-bar, #app[data-mode3d='playback'] #selection-bar { display: none; }`
     (in walk mode clicks don't select, and the touch joystick sits bottom-left).
   - `#app[data-selection] #notices { bottom: calc(60px + safe-area); }` so notices
     don't cover the bar.

5. **`README.md`** — next to the "▶ on a trail row" bullet, add that clicking a trail on
   the map shows a bar with ▶ that does the same.

6. **Plan doc** — save this plan as
   `docs/plans/2026-09-15-07-play-selected-trail-from-map.md`.

## Verification

- `npm run build` passes (type check + bundle).
- `npm run preview`, desktop and a phone-sized window:
  - click a trail in 2D → bar shows name and distance; ▶ 3D opens 3D and plays it;
  - × , Escape, a click on bare map, and a second click on the trail all hide the bar;
  - hiding the selected trail's checkbox hides the bar;
  - in 3D orbit, click a trail → bar shows; ▶ plays; during playback and walk the bar
    is gone and returns in orbit (Esc twice);
  - selecting a row in the panel also shows the bar; filtering the list doesn't hide it;
  - on a phone the bar clears the zoom/locate buttons, sits under the open drawer, and a
    notice (e.g. locate) appears above it, not on top.
