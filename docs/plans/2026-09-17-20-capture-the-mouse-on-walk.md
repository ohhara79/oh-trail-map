# Capture the mouse when Walk starts

## Context

On a desktop, 3D walk mode hides the mouse pointer only after you click the scene
(`onPointerUp` in `src/walkControls.ts:194`). That click often does something else
instead: it clears a popup or selection, picks a point or trail, or counts as a drag.
When that happens the pointer stays visible, so hiding it looks random.

Goal: clicking **Walk** with a mouse captures the mouse (pointer lock) right away.
Esc gives it back, as it does now. After that, a plain click on the scene captures it
again, which is the current rule.

The browser allows `requestPointerLock()` only during a user gesture. So it has to be
called from the Walk button's own click, not when the camera flight ends
(`startWalking`, `src/view3d.ts:683`). The canvas container is always in the DOM, so
it can be locked before the flight starts.

## Change

### `src/walkControls.ts`

1. Export a helper next to `typingTarget`, and use it in `onPointerUp`
   (`:210-212`) in place of the inline call:
   ```ts
   /** Captures the mouse, game-style: the cursor hides and every move looks around.
    *  Only from inside a click or key press, which requestPointerLock requires. A
    *  refusal, such as a click within Chrome's second after Esc, is ignored. */
   export function captureMouse(surface: HTMLElement): void {
     if (surface.requestPointerLock) Promise.resolve(surface.requestPointerLock()).catch(() => {});
   }
   ```

### `src/hud3d.ts`

2. `HudCallbacks.onWalk` takes the click: `onWalk: (e: MouseEvent) => void`.
   `:77` becomes `(e) => cb.onWalk(e)`.

### `src/view3d.ts`

3. `onWalk` (`:246`):
   ```ts
   onWalk: (e) => {
     const entering = mode === 'orbit';
     setMode(entering ? 'walk' : 'orbit');
     // Walking with a mouse is looking with it: capture it now rather than on a
     // first click, which a popup or a trail under the crosshair may spend instead.
     if (entering && (e as PointerEvent).pointerType === 'mouse') {
       // Or Space, meant for the scene, would press Walk again and leave.
       (e.currentTarget as HTMLElement | null)?.blur();
       captureMouse(map.getCanvasContainer());
     }
   },
   ```
   - Only `pointerType === 'mouse'`, so touch, pen and keyboard presses (`''`) don't
     lock. The blur is needed because Chrome focuses a clicked button. The old
     scene click moved focus away from it; this path doesn't.
   - Don't lock on the other ways into walk: ✕ on playback, Esc from playback, or
     locate during playback. Esc can't grant a lock, and the other two are clicks on
     controls that need a free mouse.
4. Release a lock that walking never took over. During the flight into walk,
   `controls` is still null, so `stopWalking()` → `controls?.destroy()` won't call
   `exitPointerLock`. This matters if 3D is closed mid-flight. Add a `releaseMouse()`
   helper (`if (document.pointerLockElement === map.getCanvasContainer())
   document.exitPointerLock();`) and call it in `stopWalking()` (`:736`) and
   `destroy()` (`:1012`), after the controls are destroyed.
5. Update the desktop hint (`:725`) to say how the mouse works now:
   `'W A S D or arrows to move, Shift to run. The mouse looks around; Esc frees it, and a click on the scene captures it again. Aim the crosshair at a point or trail and click to pick it. Esc again to go back.'`

### `README.md`

6. Update the Walk bullet (`:57-58`): "…Shift to run. With a mouse, Walk captures it to
   look around; Esc frees it, and a click on the scene captures it again. You can also
   drag to look."

### `docs/plans/2026-09-17-20-capture-the-mouse-on-walk.md`

7. This plan, in the repo's plan style, committed with the change.

## Verification

1. `npm run build` passes (tsc + vite).
2. `npm run dev` in desktop Chrome: 3D → click **Walk**. The pointer disappears at once,
   before the flight ends. Once walking, moving the mouse looks around and WASD moves.
3. Press Space: Walk stays on, so the button isn't focused.
4. Esc: the pointer comes back and you're still walking. Esc again: back to orbit.
   Click Walk again: the pointer is captured again.
5. Click Walk, then Esc during the flight down. The flight finishes, you're walking,
   and the pointer is free.
6. Tab to Walk and press Enter: walk starts without capturing the mouse. A scene
   click captures it, as before.
7. DevTools phone emulation: Walk doesn't try to lock, and the joystick and drag work.
8. Playback: ▶ on a trail doesn't capture. ✕ back to walk doesn't capture either.
