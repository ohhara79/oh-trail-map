# Stop opening national points on their own while walking in 3D

## Context

In 3D Walk and playback, passing within 25 m of a national point that's in view
opened its popup without a tap (`openNearby()` in `src/view3d.ts`, added by
`2026-09-16-05-open-nearby-points-during-playback` and
`2026-09-16-07-open-nearby-points-while-walking`). The user found that confusing
and wanted it removed. Now a point's popup opens only when you aim the crosshair
at it and tap or click, as it did before those two plans.

## Change

1. **`src/view3d.ts`**
   - Delete the `NEARBY` and `NEARBY_RELEASE` constants.
   - Delete the `opened` set and `openNearby()`.
   - `move` handler: drop the `openNearby()` call. Keep `scheduleHover()` and the
     check that closes a popup once it's out of view, because a popup you opened
     with a tap should still close when you walk or look away from it.
   - Delete `opened.clear()` and the comment above it in `stopWalking()` and
     `walkTrail()`.
2. **`README.md`** (Walk bullet): remove "Walking past a national point (within
   25 m) opens its popup on its own, in playback too; points hidden in the panel
   are skipped."

## Verification

1. `npm run build`: typecheck and bundle pass.
2. `npm run dev`, 3D near K-numbered points:
   - Walk up to a point: no popup opens. Aim the crosshair at it and tap: it
     opens, and it closes once you look or walk away from it.
   - Play a trail that passes points: no popups open during playback.
   - Tapping a trail still selects it, and the crosshair hover preview still
     works.
