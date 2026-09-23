# Make the profile drag snap less eager

## Context

377dcb4 brought back the drag snap on the elevation profile: a drag within
`SNAP_PX_MOUSE = 6` / `SNAP_PX_TOUCH = 12` CSS px of a national point pin (or the
trail's start/end) puts the cursor on that pin's point (`scrubTo`,
`src/profilePanel.ts:238`). Because the threshold is in pixels along the chart, on a
long trail a few pixels cover many GPX points, so the cursor jumps to a pin while
the pointer is visibly away from it. The user finds it too sensitive and wants it
narrower.

## Change

1. **`src/profilePanel.ts`**
   - Halve the drag snap: `SNAP_PX_MOUSE = 3`, `SNAP_PX_TOUCH = 6`. The pin is
     drawn with r 3.5, so a mouse snaps only when the pointer is roughly over the
     pin itself; a finger gets a little more.
   - Leave `PIN_HIT_PX_*` (the press-on-a-pin tap, 8 / 14 px) alone: that is an
     explicit tap on a pin, not the drag snap.
   - Leave `pointAt` / `PASS_DISTANCE` (which point the readout names within 30 m)
     alone: that names, it does not move the cursor.
   - The constant's doc comment stays accurate; no wording change needed beyond
     the numbers.
2. **`README.md`** (~line 61): wording says "when it passes close by" — still
   true, no change.
3. Save this plan as `docs/plans/2026-09-23-13-snap-the-profile-drag-less.md`
   (convention: `docs/plans/YYYY-MM-DD-NN-slug.md`).

## Verification

1. `npm run build` passes.
2. `npm run dev`, open a trail with pins (e.g. `ohhara_10959058.gpx`), and with a
   scratchpad Playwright script:
   - a drag ~5 px beside a pin (mouse) no longer snaps; ~2 px still does;
   - touch: ~8 px no longer snaps, ~4 px does;
   - start/end still snap within the new threshold.
3. Commit with the plan doc.
