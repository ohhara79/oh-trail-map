# Shorter crosshair reach while walking

## Context

Commit c65edf1 limited what the walking crosshair can pick to 300 m standing, 600 m at 20 m eye height and 1.2 km at 80 m. The user still finds that too far and wants it shorter. The new limits are **50 m / 100 m / 200 m**, a sixth of the current ones, like a game's "use" range: you have to be almost at a point or trail to pick it.

## Change

1. **`src/view3d.ts`**: change `REACH = [300, 600, 1200]` to `REACH = [50, 100, 200]`. The comment above it still holds. `inReach()` and the pick filters need no change.
2. **`README.md`** (Walk bullet): "within reach (300 m standing, 600 m at 20 m, 1.2 km at 80 m)" → "within reach (50 m standing, 100 m at 20 m, 200 m at 80 m)".
3. **Repo plan doc:** save this plan as `docs/plans/2026-09-17-10-shorter-walk-pick-reach.md`.

## Verification

1. `npm run build`: typecheck and bundle pass.
2. `npm run dev`, then 3D → **Walk** at 1.7 m:
   - A trail you're on, or one within about 50 m, gets the highlight and name, and a tap selects it.
   - A trail or point 100 m away gets no highlight, and a tap on it acts like a tap on empty ground.
   - Walk towards a point: its highlight appears at about 50 m.
   - At 20 m and 80 m eye height, the reach grows to 100 m and 200 m right away.
