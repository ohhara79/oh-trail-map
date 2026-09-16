# Preview what a tap would pick while walking

## Context

The hover preview (commit 37556e3) shows what a click would pick in 2D and 3D orbit: a faint white casing under the trail or a ring around the point, plus its name beside the pointer. In walk mode it is switched off (`syncHover` in `src/view3d.ts:537` goes quiet when `mode !== 'orbit'`).

In walk mode the mouse position doesn't matter. A click or tap always picks what is under the **crosshair** at the screen centre (`onSceneTap` → `aimedPoint()` / `aimedTrail()`, `view3d.ts:419-517`). Today the only feedback is `#crosshair3d[data-aimed]`, which turns accent-coloured and grows. It doesn't say *which* trail or point, and it lights up even when a tap would only clear a popup or selection.

**Recommendation:** in walk mode, use the crosshair as the hover position. The same casing, ring and name label then follow what the crosshair aims at, and they come from the tap's own pick functions, so the preview and the tap can't disagree. Since this needs no mouse, it also works on touch (phones), where orbit and 2D can't preview at all.

## Change

1. **`src/view3d.ts`: one `syncHover()` for orbit and walk.**
   - Add `walkPickAt(): { point?: NationalPoint; trail?: string } | null`. It follows `onSceneTap`'s rules in order:
     - popup open → `null` (the tap only closes it);
     - `mode === 'walk' && selectedId !== null` → `null` (the tap only clears);
     - `aimedPoint()` → `{ point }`;
     - `aimedTrail()` → `{ trail }`.
   - Change `onSceneTap` to call `walkPickAt()` for the pick. Its clear branches stay as they are, so both paths share one rule set.
   - In `syncHover()`, branch on mode:
     - **orbit:** unchanged (`hoverAt`, `canHover()`, `map.isMoving()`, `pickAt`).
     - **walk / playback:** quiet only while `tween !== null`. `at` is the canvas centre (`clientWidth/2`, `clientHeight/2`), and `pick = walkPickAt()`. There is no `canHover()` gate (the crosshair works on touch) and no `isMoving()` gate (moving is exactly when the aim changes).
   - The layer filters (`LAYER_TRAIL_HOVER`, `LAYER_POINT_HOVER`) and the change-only `setFilter` guard are shared as they are. The cursor line stays orbit-only.
   - **Fold `syncAim()` into `syncHover()`:** `hud.setAimed(mode !== 'orbit' && pick !== null)`. The crosshair highlight, casing and label then all come from one pick, and the crosshair stops lighting up when a tap would only clear. Replace the existing `syncAim()` calls with `scheduleHover()`: `map.on('move')` (`:453`), `goTo`, `syncTrails`, `syncPoints`, `setMode`. Then delete `syncAim`.
   - The walk camera fires `move` every frame. `scheduleHover()` is rAF-coalesced, so this costs the same two `queryRenderedFeatures` per frame that `syncAim` already does.
   - Where a `syncAim()` sat next to `openPopup`/`closePopup` (`goTo`, `walkTrail`, `showPoint`), just drop it: those already call `scheduleHover()`.
   - Also call `scheduleHover()` at the end of both camera flights (into walk after `startWalking`, and back to orbit after `orbitLimits`), because `tween` just went null.

2. **Label placement.** Reuse `hoverLabel.show(name, cx, cy)` as is. It sits 12px right of and below the centre, in the crosshair's empty lower-right quadrant: the ticks are axis-aligned and the scaled ring's radius is about 9px. It stays clear of the selection bar and the joystick. `src/hoverLabel.ts` needs no change.

3. **`src/style.css`:** update the `#crosshair3d` comment to say `data-aimed` now follows the preview (nothing is lit while a tap would only clear).

4. **`README.md`:**
   - Extend the hover bullet (~line 48) to say that while walking, the crosshair does the same: the aimed trail or point gets the casing or ring and its name, with a mouse or on a phone.
   - Adjust "2D and 3D orbit" wording accordingly.


## Verification

- `npm run build` passes.
- `npm run dev`, 3D → **Walk**, with a mouse:
  - Look at a trail. The casing, the name beside the crosshair and the accent crosshair appear. Look away and all three clear together.
  - Look at a point on a trail: only the point ring and the point's name show, and clicking opens that point.
  - Where two trails cross near the crosshair, the label names the one a click then selects.
  - With the mouse captured (pointer lock), the same behaviour applies.
  - Select a trail, then aim at another: no preview and no accent crosshair, and a click clears.
  - Walk up to a point so its popup opens by itself: the preview goes quiet until the popup closes.
- **Playback (▶ on a row):** the playing trail itself never previews, because it is selected and `aimedTrail` excludes it. Crossing trails and points preview, and a tap on one does what the label says.
- **Mode flights (orbit ↔ walk):** nothing shows mid-tween. The orbit mouse preview still works after returning.
- **DevTools phone emulation:** walk shows the crosshair preview. Orbit and 2D still show none.
