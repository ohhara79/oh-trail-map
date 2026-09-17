# Every click on the scene captures the mouse

## Context

In desktop 3D walk mode, a click on the scene hides the pointer only if the click did
nothing else (`onPointerUp` in `src/walkControls.ts:201-218`). A click that closes a
popup, clears or selects a trail, opens a point, or brings back the playback controls
leaves the pointer free. That made hiding it look random. The last commit (`95899e2`)
worked around this by capturing the mouse when **Walk** is clicked. The user has
changed their mind and wants the simpler rule instead:

**Every mouse click on the scene captures the mouse**, including one that picks
something. To reach a popup, the selection bar's ▶, or the playback controls, you press
Esc first. The Walk-button capture from `95899e2` is replaced by this rule, not kept
alongside it.

Drags still don't capture, so dragging to look keeps working.

## Change

### `src/walkControls.ts`

1. `onPointerUp` (`:207-217`): capture on every mouse click, whether or not the tap was
   spent:
   ```ts
   // A tap that opened a popup, picked a trail or brought the playback controls
   // back: the click the browser sends next must not press what it put there.
   if (opts.onTap?.()) swallowNextClick();
   // A click with a mouse captures it, game-style, so looking no longer needs a
   // held button, even a click that picked something: Escape gives the mouse back
   // to reach it. Only on click, never on a drag, so dragging to look keeps working
   // for anyone who would rather not. pointerup is a user activation, which
   // requestPointerLock requires.
   if (e.pointerType === 'mouse') captureMouse(surface);
   ```
2. `captureMouse` (`:93-98`): no longer exported, since only this file uses it again.
3. `ControlsOptions.onTap` doc (`:54-58`): the return value now only means "the click
   that follows is swallowed". It no longer decides whether the mouse is captured.

### `src/hud3d.ts`

4. Put back `onWalk: () => void` and `() => cb.onWalk()` (`:17`, `:77`), as before
   `95899e2`.
5. `tap()` doc (`:162-166`): it returns true when it brought the controls back, so the
   browser's click that follows isn't pressed on them. Drop the part about leaving the
   mouse uncaptured. Esc still reveals the controls when it frees the mouse
   (`pointerlockchange`, `:99`).

### `src/view3d.ts`

6. Put back `onWalk: () => setMode(mode === 'orbit' ? 'walk' : 'orbit')` (`:246-258`),
   and `import { createControls, type WalkControls }` (`:72`).
7. Remove `releaseMouse()` and its calls in `stopWalking()` and `destroy()`
   (`:754-763`, `:1036`). Now only the controls capture, and `controls.destroy()`
   already releases.
8. Desktop hint (`:~740`):
   `'W A S D or arrows to move, Shift to run. Drag, or click to capture the mouse, to look around. Aim the crosshair at a point or trail and click to pick it. Esc frees the mouse to reach what you picked, and Esc again goes back.'`

### `README.md`

9. Walk bullet (`:57-59`): "…Shift to run. Drag, or click the scene to capture the
   mouse, to look around. Every click captures it, even one that picks something, so
   press Esc to reach a popup or the selection bar."
10. Playback bullet (`:73-74`): "…tap or click the scene to bring them back, or again to
    hide them. With a captured mouse, Esc frees it and brings them back too."

### `docs/plans/2026-09-17-21-every-scene-click-captures-the-mouse.md`

11. This plan, committed with the change. Plan 20 stays as the record of what it
    replaced.

## Verification

1. `npm run build` passes.
2. `npm run dev`, desktop Chrome, 3D → click Walk: the pointer stays visible, and Space
   doesn't leave walk (a scene click moves focus off the button).
3. Aim at a point and click: its popup opens and the pointer hides. Esc: the pointer is
   back and you can click the popup. Esc again: back to orbit.
4. Aim at a trail and click: the selection bar shows and the pointer hides. Esc, then
   click ▶: playback starts.
5. With the mouse captured, click again: it clears the popup or selection, as before.
6. Playback: once the controls fade, a click brings them back and captures the mouse.
   Esc frees the mouse and the controls stay up.
7. Drag on the scene without capturing: it still looks around and doesn't capture.
8. Phone emulation: tap picks work, and a tap that shows the selection bar doesn't
   also press ▶ (the ghost click is still swallowed).
