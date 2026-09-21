# Thicker trails in 2D and 3D

## Context

Trails are drawn 2px wide. The user wants them a little thicker in both 2D and 3D.
One constant drives both: `TRAIL_WEIGHT` in `src/trails.ts:42`. It is used by
- 2D: the Leaflet polyline (`src/trails.ts:143`) and, derived from it, the selection
  halo casings and hover ring (`src/selection.ts:14-27`, weight + fixed pads);
- 3D orbit: `layers()` / `trailWidths(null)` in `src/scene3d.ts` (plain px);
- 3D walk/playback: `groundWidth(TRAIL_WEIGHT, TRAIL_METRES)` holds the px width to z16
  then eases to 3 m on the ground — so walk's close-up width is unchanged.

## Change

1. `src/trails.ts:42` — `TRAIL_WEIGHT = 2` → `3`. Halo/hover rings grow by the same 1px
   automatically since they are `TRAIL_WEIGHT + pad`, keeping the casing visible
   around the thicker line.
2. `src/trails.ts` PALETTE comment — "a 2px line holds up" → "a 3px line holds up".
3. Leave `TRAIL_METRES` (walk ground width) alone: it's already wide underfoot.
4. Add `docs/plans/2026-09-21-06-thicker-trails.md` (project plan-doc convention) with
   this plan, and commit both.

## Verification

- `npm run build` (type-check) passes.
- Run the dev server: in 2D trails look ~1.5× thicker; selecting one still shows the
  white + dark casing around it; hover ring still visible.
- Switch to 3D orbit: trails match the 2D width; selection casings still frame them.
- Walk: trails underfoot look as before.
