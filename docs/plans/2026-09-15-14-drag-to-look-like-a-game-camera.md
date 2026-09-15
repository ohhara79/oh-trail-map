# Drag to look like a game camera

## Context

In 3D Walk and trail Playback, dragging on the scene (the right thumb on a phone) turned
the camera with "grab" semantics, like Street View: the scene followed the finger, so
dragging left turned you right and dragging down looked up (`onPointerMove` in
`src/walkControls.ts`). Next to a movement joystick under the left thumb, that felt
inverted. Game controls work the other way: drag right to turn right, drag up to look
up. The captured mouse already worked like that (`onMouseMove`).

Goal: dragging to look turns the camera the way the finger moves, on both axes, the same
way as the captured mouse. Playback uses the same `consumeLook()` path, so one change
fixes both modes.

## Change

1. **`src/walkControls.ts` `onPointerMove`**: flip both signs:
   - `dyaw += (e.clientX - drag.x) * DRAG_DEG_PER_PX;`
   - `dlook -= (e.clientY - drag.y) * DRAG_DEG_PER_PX;`
   - Replace the "Grab semantics, like Street View" comment: the camera follows the
     finger like a game's look stick and the captured mouse.

Mouse drags without pointer lock use the same handler, so they now match the captured
mouse too. Arrow keys, the gyroscope and the joystick don't change.

## Verification

1. `npm run build` passes.
2. `npm run dev`, 3D → Walk, on a phone (or with touch emulation in devtools): dragging
   right on the scene turns right, dragging up looks up. The joystick still moves you, and
   a joystick and a look drag still work together.
3. Desktop: an unlocked mouse drag and a captured mouse both turn in the same direction.
4. Select a trail → Play: dragging looks around the same way, then drifts back to the
   trail ahead after about 2s.
