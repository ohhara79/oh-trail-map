# Follow your location while walking in 3D

## Context

The bottom-right locate button toggles `following` in `src/main.ts:170`. Following pans the
view to each GPS fix through `panToFix()` → `view3d.panTo()`. In 3D, `panTo`
(`src/view3d.ts:703`) only works in orbit, so in Walk and during playback the button does
nothing. The user wants the button to take them to their current location in Walk mode.

Decisions from the user:
- **Walk**: jump there and keep following, the same as orbit. The button turns on and every
  new fix moves you.
- **Playback**: a click stops playback, the same as Esc, and puts you in Walk at your
  location.

## Change

1. **`src/view3d.ts`**
   - Rename the option `onDragStart` to `onStopFollowing`. Its doc becomes: a drag in orbit,
     walking with the keys or joystick, or starting a trail's playback, which is how
     following your location stops. The orbit `dragstart` handler calls it the same way as
     before.
   - `panTo(lat, lon)`:
     1. During a camera flight (`tween`), return. The flight into Walk starts at the map
        centre, which is already you while following. The flight back to orbit ends where
        you stood, and the next fix pans from there. `map.panTo` in the middle of a flight
        would fight it.
     2. Orbit: `map.panTo` as today.
     3. Playback: `setMode('walk')` first. It drops the playback and closes the popup. This
        is only reached from a click, because starting playback stops following (see
        `walkTrail` below).
     4. Walk: `walker.jump({ lat, lon }, far ? JUMP_HEIGHT : null, ground)`. `far` means
        `haversine(walker.pose, target) > FAR_JUMP`. `ground` is
        `map.queryTerrainElevation([lon, lat]) ?? walker.groundHeight`. On a far jump, also
        `closePopup()` and `syncAim()`, as `walkTrail` does. Small fix-to-fix moves just
        move `pose`. `FirstPerson.jump()` in `src/firstPerson.ts:146` already handles both
        cases.
   - `startWalking()`'s per-frame callback: when there is no playback and
     `controls.intent()` has `forward` or `right` set, call `opts.onStopFollowing()`. That
     function is a no-op unless following. Looking around, or turning with the arrow keys,
     doesn't stop following: only moving does.
   - `walkTrail()` calls `opts.onStopFollowing()`, so a fix never pulls you off a trail
     that's playing.
2. **`src/main.ts`**: pass `onStopFollowing: stopFollowing` instead of `onDragStart`. The
   `onLocate` toggle and `panToFix()` stay as they are.
3. **`README.md`**: add to the 3D **Walk** bullet that the locate button takes you to your
   location and keeps following until you walk away or click it again. During playback it
   stops the trail first.

## Verification

1. `npm run build` passes.
2. `npm run dev` on localhost (geolocation needs it; DevTools → Sensors can fake a
   location), 3D:
   - Walk somewhere away from your location, then click locate. You move to your location
     (descending from above if it's more than 200 m away), and the button turns on.
   - With it on, change the faked location: you move with it. Press W, or use the joystick:
     the button turns off, and further fixes no longer move you. Dragging to look around
     doesn't turn it off.
   - Click locate again while it's on: it turns off and you stay where you are.
   - Start ▶ on a trail while following: the button turns off, and fixes don't interrupt
     playback. Click locate during playback: playback ends, you're in Walk at your location,
     and following is on.
   - Toggle Walk on from orbit while following: the flight lands on your location, and
     following continues afterwards.
   - Orbit still follows and pans as before, and dragging still stops it.
