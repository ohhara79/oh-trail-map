# Revert the crosshair preview while walking in 3D

## Context

`2026-09-17-04-preview-while-walking` (commit 5a8c6e2) made `syncHover()` follow
the crosshair in Walk and playback: on every camera `move` frame it picked what
the crosshair aimed at, updated the two hover layers' filters whenever the aim
changed, and showed or hid the name label. The user found that walking and
playback felt sluggish with it and wanted it removed. Walking goes back to what it
was before: only the crosshair's accent look (`syncAim()`), with the hover preview
in orbit only.

## Change

1. **`git revert 5a8c6e2`.** This restores `syncAim()` and its calls, makes
   `onSceneTap` use `aimedPoint()` / `aimedTrail()` directly again, removes
   `walkPickAt()`, and makes `syncHover()` orbit-only again. It also restores the
   README hover bullet and the `#crosshair3d` comment in `src/style.css`, and
   deletes the 04 plan doc.
2. **Adjustments for later commits:**
   - `move` handler: `syncAim()` without `openNearby()`, which
     `2026-09-17-08-no-auto-open-points-while-walking` removed.
   - `onEye` handler: `2026-09-17-09-walk-pick-reach` added `scheduleHover()` so
     the walk preview would follow the new reach. Replace it with `syncAim()` so
     the accent crosshair does.
   - The reach itself (`REACH`, `inReach`, `keep` on `pointAt` / `trailIn`)
     stays: it still decides what a tap picks.

## Verification

1. `npm run build`: typecheck and bundle pass.
2. `npm run dev`, then 3D → **Walk** and playback:
   - Moving and looking around feel smooth, and no casing, ring or name follows
     the crosshair.
   - The crosshair still turns accent over a trail or point within reach, and a
     tap opens or selects it.
   - Changing the eye height while standing still updates the accent crosshair
     right away.
3. Orbit: the mouse hover preview still works, also after flying back from walk.
