# A tap while walking does not also press what it brought up

## Context

In 3D walk mode, tapping the scene selects the trail under the crosshair. Sometimes
the same tap also starts playing the trail.

**Cause.** Walking handles taps on `pointerup`, not on `click`
(`onPointerUp` in `src/walkControls.ts:163` → `onSceneTap` in `src/view3d.ts:554`).
That handler selects the trail right away, so `renderSelection` (`src/ui.ts:254`)
shows `#selection-bar` with its **▶ 3D** button (`#selection-walk`). On a touch
screen, the browser then fires a `click` for the same tap and hit-tests where the
finger was. On a phone, the bar sits 154px up, just above the joystick
(`src/style.css:650`). If the finger was there, the click lands on the button that
just appeared, and playback starts. It can also land on ✕ and clear the selection.

The same tap-through happens in two other places:
- During playback, a tap that brings back the hidden controls (`hud.tap()`,
  `src/hud3d.ts:167`) can press ⏸, the speed button, or ✕ under the finger.
- A tap that opens a point's popup can hit the popup's close button.

Orbit and 2D are not affected. They act on the map's `click` event, so no second
click follows.

## Change

### `src/walkControls.ts`

1. In `onPointerUp`, when `opts.onTap?.()` returns true (the tap selected
   something, opened a popup, or brought the controls back), **swallow the click
   that follows this pointer sequence** before returning:
   - Add a one-shot `click` listener on `window` in the capture phase. It calls
     `preventDefault()` and `stopPropagation()`, then removes itself.
   - Take it away if no click comes: on the next `pointerdown` (capture, on
     `window`), so a quick real tap on ▶ still works, and after a short timeout
     (about 500 ms) as a backstop.
   - Keep it in a small helper, e.g. `swallowNextClick()`, with a comment saying
     why: the tap changed the UI under the finger, and the click the browser sends
     afterwards would press whatever appeared there.
   - `destroy()` removes a swallower that is still pending.
2. Update the `onTap` doc comment in `ControlsOptions` (`src/walkControls.ts:52`).
   A true result now also means the click that follows is swallowed. The rename
   from "must not capture the mouse" is not needed; the existing meaning still
   holds.

This one spot covers all three cases above. The captured-mouse path
(`onPointerDown` while pointer-locked) is left alone. There, clicks go to the lock
element and cannot reach the HUD.

### Plan doc

Save this plan as `docs/plans/2026-09-17-18-tap-does-not-press-what-it-shows.md`.

## Files

| File | Change |
|---|---|
| `src/walkControls.ts` | Swallow the click that follows a tap `onTap` spent |
| `docs/plans/2026-09-17-18-tap-does-not-press-what-it-shows.md` | This plan |

## Verification

1. `npm run build` passes.
2. `npm run dev` on a phone, or in Chrome DevTools device emulation with touch.
   Open **3D** → **Walk** with trails loaded:
   - Aim at a trail and tap just where the selection bar's ▶ 3D button will
     appear. The trail is selected and the bar shows, but playback does not start.
   - Tap ▶ 3D straight after that. Playback starts.
   - Tap where ✕ will appear. The selection stays.
   - During playback, wait for the controls to hide, then tap where ⏸ was. The
     controls come back and the trail keeps playing.
   - Aim at a point and tap. The popup opens and stays open.
3. On desktop in walk mode, clicking a trail still selects it. A plain click on
   empty scene still captures the mouse, and dragging to look still works.
