# Check what the crosshair hits only on tap

## Context

In 3D Walk and playback, turning or moving the camera sometimes feels sluggish. The cause is the check behind the crosshair highlight, not the color change itself.

The walk loop calls `map.jumpTo` every frame the camera changes (`src/firstPerson.ts`). Each call fires `move`, and the `move` handler in `src/view3d.ts` called `syncAim()`. That ran `aimedPoint()` and `aimedTrail()`, which means 2 `queryRenderedFeatures` calls per frame. Since the reach change (2026-09-17-09), `trailIn` with a `keep` filter also skips its single-hit shortcut. It then runs `map.project` (with terrain) and `haversine` on every vertex under the crosshair. So it was slow only while a trail was near the screen centre.

**Recommendation:** remove the highlight. Don't check hits while the camera moves. Run the check only when you tap or click. `onSceneTap()` already calls `aimedPoint()` / `aimedTrail()` itself, so taps pick the same things as before.

## Change

1. **`src/view3d.ts`**
   - Delete `syncAim()` and all its calls: eye height, trail and point filters, `goTo`, `setMode`, `walkTrail`, and opening a point from the panel.
   - The `move` handler keeps only the cheap check that closes a popup once it is out of view.
2. **`src/hud3d.ts`**: remove `setAimed()` and the `crosshair` field.
3. **`src/style.css`**
   - Remove the `#crosshair3d[data-aimed]` rule, the crosshair's transition, and the reduced-motion override for it.
   - Reword the comment above the crosshair to say why it no longer lights up.

## Verification

1. `npm run build`: passes, and no references to `setAimed` or `syncAim` remain.
2. `npm run dev`, then 3D → Walk:
   - Look and walk around with a trail under the crosshair. Motion should feel smooth.
   - The crosshair stays white.
   - Tap a nearby point: its popup opens. Tap a nearby trail: it gets selected. Tap something out of reach: the mouse is captured, or the controls toggle.
   - Walk away from an open popup: it closes.
3. Playback: the camera follows smoothly, and a tap still picks what is within reach.
