# Easier-to-hit national point pins

## Context

Clicking a national point dot often missed. In 2D only the drawn ink took the click (`.point-pin-body { pointer-events: auto }` in `src/style.css`), so the target was a circle of radius `PIN_RADIUS + PIN_STROKE` = 6.5 px. That is far smaller than a fingertip. Even with a mouse, a click just off the edge fell through to `trailAt()` and selected the trail the point sits on. Where pins crowded, the one stacked on top won, not the nearest.

**Recommendation:** pick pins by distance, the way trails are already picked (`trailAt`). A click within **12 px** of a pin's centre (**20 px** on a coarse pointer) opens it. This is tighter than the trail tolerance (15 / 22 px) because a pin takes the click over a trail, and a pin on a trail must not swallow the trail.

A separate behaviour can also feel like a miss, and it is unchanged: while a trail is selected or a popup is open, the first click only clears it.

## Change

1. **`src/selection.ts`: `pinReach()`.** Add it beside `tolerance()`. Both use the same `(pointer: coarse)` query.
2. **`src/points.ts`: `createPointsLayer(map, points)`.**
   - Markers are `interactive: false`, with no click or hover listeners and no `riseOnHover`.
   - Add a new `pinAt(at)`. It returns the nearest drawn pin within `pinReach()`. A named pin wins a tie by 1 px, matching the `zIndexOffset` that draws it on top.
3. **`src/main.ts`.**
   - The map click handler asks `pinAt()` before `trailAt()`.
   - `syncHover()` asks `pinAt()` too, so the preview and the click still agree.
   - `map-pick` now gives the pointer cursor to a pin as well as a trail.
   - `hoveredPin` is gone.
4. **`src/style.css`.** Drop the pointer-events rules on the pin. leaflet.css already makes a non-interactive marker icon ignore the pointer.
5. **`src/view3d.ts`: `pickAt()`.** In 3D orbit, pad the query by `pinReach() - (PIN_RADIUS + PIN_STROKE)` instead of a fixed 6. This gives the same reach as 2D. Walk aiming is unchanged.

## Verification

1. `npm run build`: typecheck and bundle pass.
2. `npm run dev`, then in 2D:
   - Clicking a few px off a pin opens its popup.
   - Hovering near a pin shows the ring, the label and a pointer cursor.
   - Clicking a trail away from pins still selects it.
   - In a cluster, the nearest pin opens.
   - A pin hidden from the list can't be hovered or clicked.
3. Repeat in touch emulation, where the reach is larger, and in 3D orbit.
