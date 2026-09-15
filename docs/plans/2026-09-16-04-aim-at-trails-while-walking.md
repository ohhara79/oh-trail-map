# Aim at trails with the crosshair while walking

## Context

In 3D walk and playback modes the crosshair at the screen centre can aim at a national
point, and a tap or click opens its popup (`2026-09-15-19-aim-at-points-while-walking`).
Trails could not be picked the same way: only the orbit `map.on('click')` handler in
`src/view3d.ts` selected a trail. The user wants to click trails in walk mode too.

The selection bar (`#selection-bar`) was also hidden in walk mode, because clicks there
did not select and the touch joystick holds the bottom-left corner. With trails now
selectable while walking, the bar is where the selected trail's name and its ▶ 3D show.

## Change

1. **`src/view3d.ts`**
   - Take the orbit click's trail lookup out as `trailIn(box)`. Orbit clicks behave as
     before.
   - `aimedTrail()` looks up the visible trail within 12px of the canvas centre, which
     is the crosshair's ticks rather than only its ring, since a far trail is a
     hairline. The trail already selected does not count: a tap has nothing more to do
     with it, so the crosshair does not light up for the trail you are playing.
   - `syncAim()` lights the crosshair for an aimed point or trail, and `syncTrails()`
     now calls it, because visibility and selection change what is aimed at.
   - `onSceneTap()`:
     1. an open popup is closed, as before;
     2. in walk mode (not playback), a selected trail is cleared, the same rule as
        orbit and 2D;
     3. an aimed point opens its popup, as before;
     4. an aimed trail is selected. The tap is spent, so the mouse stays free and can
        reach the selection bar's ▶;
     5. anything else falls through to `hud.tap()`.
   - Playback skips step 2: the trail playing is the selection, and a tap there is for
     the controls.
   - Both walk hints say “a point or trail”.
2. **`src/style.css`**: `#selection-bar` shows in walk mode and is still hidden in
   playback, where `#playback3d` holds that spot. On coarse pointers in walk mode it is
   lifted to 154px, clear of the joystick, which spans 24–144px up.
3. **`README.md`**: Walk mentions aiming at points and trails.

## Verification

1. `npm run build` passes.
2. `npm run dev`, then 3D and Walk:
   - The crosshair lights up over a visible trail and goes back when you look away.
     A hidden trail does not light it.
   - Mouse not captured: a click while aimed selects the trail. The halo shows, the
     selection bar shows its name, and the mouse is not captured, so ▶ 3D can be
     clicked. The next click clears the selection.
   - Mouse captured: a click while aimed selects the trail, and the next click clears it.
   - Aiming at a point on top of a trail opens the point's popup, not the trail.
   - Touch, walk: the selection bar sits above the joystick.
   - Playback: the playing trail does not light the crosshair, and a tap still toggles
     the controls. Aiming at another trail and tapping selects it. The selection bar
     stays hidden.
   - Orbit clicks on points and trails behave as before.
