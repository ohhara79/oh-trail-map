# A map click only clears while something is selected

## Context

Today a click on the map does one of these:
- On a trail: selects it. If another trail was already selected, the selection
  jumps to the new one.
- On a National Point Number pin: opens its popup. The trail selection stays.
- On the selected trail or on empty map: clears the trail selection.

To get back to the plain map you have to hit empty space. A miss that lands on
another trail or on a pin selects that instead. The change is:

- **Nothing selected** (no trail selected, no point popup open): a click on a
  trail selects it, and a click on a pin opens its popup, as today.
- **Something selected**: any map click only clears it. That covers a click on
  another trail, the same trail, a pin, or empty map. The trail selection is
  cleared and the popup closes. Nothing new is picked on that click.

The same rule applies in the 3D orbit view. These stay as they are: clicking a
row in the trail list (it still selects directly), the selection bar's ✕,
Escape, and a popup's own ✕.

## Change

1. **`src/points.ts`**
   - Stop using `bindPopup`. It adds its own `click` listener on each marker, and
     that listener cannot be vetoed. Also, the popup closes on the map's
     `preclick`, which fires before the marker's `click`. So at the time of a pin
     click we could not tell whether a popup had been open.
   - `createPointsLayer(map, points, onPinClick: (point: NationalPoint) => void)`:
     each marker gets `.on('click', () => onPinClick(point))`. Having a listener
     keeps the marker interactive, so the click still never reaches the map
     handler.
   - New `export function openPointPopup(map, point): L.Popup`. It opens
     `L.popup({ closeButton: true, autoPan: true, closeOnClick: false, offset })`
     at the point with `popupContent(point)`, via `openOn(map)`.
     - `closeOnClick: false`, because main.ts now decides when a click closes it.
     - `offset` is `[0, 7 - PIN_CENTRE]`: Leaflet's default popup offset (`[0, 7]`)
       plus the old `POPUP_ANCHOR`, so the tail still sits on the dot's top edge.
       This replaces `POPUP_ANCHOR` and the icon's `popupAnchor`.
   - Rewrite the doc comment on `createPointsLayer` (the "leaves the trail
     selection exactly as it was" paragraph) to describe the new rule.

2. **`src/main.ts`**
   - Keep `let pointPopup: L.Popup | null = null`.
   - Pass the pin callback to `createPointsLayer`:
     `(point) => { if (clearMapSelection()) return; pointPopup = openPointPopup(map, point); }`.
   - Add `clearMapSelection(): boolean` next to `selectTrail`:
     - Check whether anything is selected: `selectedId !== null` or
       `pointPopup?.isOpen()`.
     - Close the popup and call `selectTrail(null)` when a trail was selected.
     - Return whether anything was selected.
   - The map click handler (`src/main.ts:408`) becomes:
     `if (clearMapSelection()) return; const hit = trailAt(...); if (hit) selectTrail(hit.id);`.
     Update the comment above it.
   - `onPointsChange`: when the layer is hidden, also `map.closePopup()`. This
     replaces the `remove → closePopup` that `bindPopup` used to wire up.

3. **`src/view3d.ts`** (orbit click handler, `src/view3d.ts:225`)
   - After the `mode !== 'orbit'` guard, check whether anything is selected:
     `popup?.isOpen()` or `getScene().selectedId !== null`. If so, remove the
     popup, call `opts.onSelect(null)` if a trail was selected, and return.
   - Otherwise:
     - A point hit opens the popup as now, with `closeOnClick: false` added.
     - A trail hit calls `opts.onSelect(id)`. A miss does nothing.
   - Update the two comments that describe the old rule.

4. **`README.md`**: next to the trail-click and point bullets (lines 27 and 40),
   say that while a trail is selected or a point's popup is open, a click on the
   map only clears it.

5. **Plan doc**: save this plan as
   `docs/plans/2026-09-15-09-click-clears-before-it-selects.md`.

## Verification

1. `npm run build` passes (type check and bundle).
2. `npm run preview`, 2D:
   - With nothing selected, click a trail: it is selected, with the halo and the
     selection bar.
   - Click another trail: the selection clears and nothing else is selected. Click
     it again: now it is selected.
   - With a trail selected, click a pin: the trail is deselected and no popup
     opens.
   - With nothing selected, click a pin: the popup opens with its tail on the dot.
   - With the popup open, click a trail, another pin, or empty map: the popup
     closes and nothing else happens.
   - The popup's ✕ closes it. Turning the points layer off closes an open popup.
   - A row click in the list still selects that trail, even with a popup open.
3. 3D orbit: repeat the trail, pin and empty-ground cases.
4. Phone emulation: the same results with taps.
