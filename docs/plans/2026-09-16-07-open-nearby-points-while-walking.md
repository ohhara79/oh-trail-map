# Open nearby national points while walking in 3D

## Context

3D playback opens a national point's popup on its own when it passes within 25 m of a point
that's in view (`2026-09-16-05-open-nearby-points-during-playback`). In free Walk mode you
still have to aim the crosshair at a point and tap. The user wants Walk mode to open nearby
points automatically too, the same way playback does.

## Change

1. **`src/view3d.ts`**
   - `move` handler (`src/view3d.ts:341`): call `openNearby()` in every non-orbit mode, not
     only `mode === 'playback'`. The handler already returns early in orbit, so the call
     needs no condition. Walking uses the same `NEARBY` / `NEARBY_RELEASE` (25 m / 40 m),
     the same in-view check and the same `opened` set as playback.
   - Update the comments on `NEARBY`, `opened` and `openNearby()` so they no longer say only
     playback opens points.
   - `stopWalking()` (`src/view3d.ts:494`) calls `opened.clear()`, so walking again after
     going back to orbit opens its points again. Going from playback to walk keeps `opened`:
     you're standing in the same place, so a point you just closed stays closed. The
     `opened.clear()` in `walkTrail()` stays, so replaying a trail still reopens its points.
   - Unchanged: `openNearby()` still does nothing during the camera flight into Walk (`tween`)
     or when points are hidden. A tap with a popup open only closes it. Aiming and tapping
     still opens a point that's further away. `setMode` still closes the popup when you switch
     modes.
2. **`README.md`**: add the sentence "Walking past a national point (within 25 m) opens its
   popup on its own." to the **Walk** bullet, and remove it from the ▶ bullet, since it now
   applies to both.

## Verification

1. `npm run build` passes.
2. `npm run dev`, 3D, then Walk near K-numbered points:
   - Walking up to a point opens its popup on its own. It closes once the point is behind
     you, and the next one opens when you reach it.
   - Tap to close an auto-opened popup: it doesn't reopen while you stay within 40 m. Walk
     more than 40 m away and come back: it opens again.
   - If you're standing within 25 m of a point, turning to face it opens its popup.
   - With national points turned off, nothing opens.
   - Nothing opens during the camera flight into Walk. Walk → orbit → Walk at the same spot
     opens the point again.
   - Aiming and tapping a distant point still opens it. Tapping a trail still selects it.
   - Playback behaves as before, and Esc from playback back to Walk doesn't reopen a point
     you just closed.
