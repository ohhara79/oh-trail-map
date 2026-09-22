# Always animate stepping to a national point in 2D

## Context

`[` and `]` now always fly to a trail in 2D (plan 15). `;` and `'` had the same problem.

`goToPoint` called `map.setView`, which Leaflet animates only when the point is already on screen and the zoom changes by 4 levels or less. So some steps glided and most snapped. In 3D, `showPoint` → `panTo` always animates.

The popup could not simply open at the start of the flight, as it did before. `openPointPopup` uses `autoPan`, which runs as soon as the popup is added. Mid-flight, it would measure against the old view and pan against the flight.

## Change

All of it is in `src/main.ts`.

1. **`prefersReducedMotion()`.** A small top-level helper, shared by `zoomToTrail` and `goToPoint`.
2. **`goToPoint`, 2D branch.**
   - It closes any open point popup, so it doesn't ride along.
   - It highlights the row with `selectPoint(point)` straight away. Without this, a quick second `;` or `'` would step on from the point you are leaving.
   - It then calls `map.flyTo` and sets `pendingPoint`. A `moveend` handler opens the popup only if `pendingPoint` is still that point.
   - The handler is registered before the call: under reduced motion, `flyTo` is a `setView` that fires `moveend` before it returns.
3. **`pendingPoint` is cleared by `openPoint` and `closePointPopup`.** Any other popup change, such as a pin click mid-flight, therefore cancels the pending open.
4. **`zoomToTrail` closes a pending point before flying.** Stepping to a trail mid-flight doesn't leave the list highlighting a point that has no popup.

## Verification

1. `npm run build` passes.
2. In 2D, `'` and `;` across points far apart and at different zooms:
   - Every step flies to the point.
   - The popup opens on landing.
   - The row highlights at once.
3. Pressing `'` several times quickly opens only the last point's popup.
4. Pressing `'` then `]` mid-flight frames the trail, with no point popup and no point highlight.
5. A points list row click behaves the same way.
6. With reduced motion on, it jumps and the popup opens at once.
7. 3D is unchanged.
