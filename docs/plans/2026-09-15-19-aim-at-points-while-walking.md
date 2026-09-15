# Aim at points with the crosshair while walking

## Context

In 3D walk and playback modes there is no way to open a national point's popup. The
`map.on('click')` handler in `src/view3d.ts` returns early unless the mode is orbit,
because the pointer is used for looking around there: a drag turns the camera, a mouse
click captures the mouse, and a tap during playback shows or hides the controls. With the
mouse captured there is no cursor at all, so the centre of the screen is the only place
you can aim.

`#crosshair3d` already sits at the screen centre in orbit mode. In walk and playback the
camera looks straight through the screen centre (`FirstPerson.place` →
`calculateCameraOptionsFromTo`). So the same crosshair can aim: it lights up when a point
circle is under it, and a tap or click anywhere on the scene opens that point's popup,
like a game. If nothing is aimed at, a tap does what it does today.

## Change

1. **`src/style.css`**: show `#crosshair3d` in every 3D mode, not only orbit. It is not
   in the playback `CHROME`, so it stays up while the controls are hidden. With
   `data-aimed` it turns the accent colour and grows a little. The grow is dropped under
   reduced motion.
2. **`src/hud3d.ts`**: `setAimed(on)` toggles `data-aimed` on the crosshair, and
   `destroy()` clears it.
3. **`src/view3d.ts`**:
   - Take the orbit click's point lookup and popup building out as `pointAt(x, y, r)`,
     `openPopup(point)` and `closePopup()`. Orbit clicks behave as before.
   - `aimedPoint()` looks up the point within 8px of the canvas centre, so anything
     inside the 7px ring counts.
   - `syncAim()` runs on `move` while walking, on mode changes and in
     `setPointsVisible`. The walk camera only jumps when it moves, so standing still
     costs no query.
   - `onSceneTap()` replaces `hud.tap()` as the controls' `onTap`. An open popup is
     closed. Otherwise an aimed point opens its popup and keeps the mouse free, so its
     × can be reached. Anything else falls through to `hud.tap()`.
   - While walking, a popup closes once its point is behind you or off the canvas.
     MapLibre projects a point behind the camera to a mirrored spot in front of it,
     so the check also compares the bearing to the point against your yaw.
   - Close the popup on every mode change and when `walkTrail` jumps.
   - Both walk hints mention aiming the crosshair.
4. **`src/walkControls.ts`**: with the mouse captured, a left press used to do nothing.
   It now calls `onTap`, because a captured mouse never drags.

## Verification

1. `npm run build` passes.
2. `npm run dev`, then press 3D and Walk:
   - The crosshair shows in orbit, walk and playback, including while the playback
     controls are hidden.
   - It lights up over a point circle and goes back when you look away. Hiding the
     points layer turns it off.
   - Mouse not captured: a click while aimed opens the popup without capturing the
     mouse, and the next click closes it. A click while not aimed captures the mouse.
   - Mouse captured: a click while aimed opens the popup, and the next click closes it.
   - Touch, playback: a tap while aimed opens the popup instead of toggling the
     controls. A tap while not aimed still toggles them.
   - Turn around or walk past a point: its popup closes and is never drawn mirrored.
   - Orbit clicks on points and trails behave as before. Switching modes or starting
     another trail closes any open popup.
