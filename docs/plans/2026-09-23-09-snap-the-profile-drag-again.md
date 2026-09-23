# Snap the profile drag onto national point pins again

## Context

880deaf made a drag on the elevation profile snap onto a national point's pin
(within 6 px mouse / 12 px touch); 5161c41 removed it because the GPX points right
beside a pin became hard to reach. Since then ◀ ▶ repeat when held
(`holdArrow`, `src/profilePanel.ts:158`), so stepping one point at a time off a pin
is easy. The user wants the snap back: dragging lands on pins easily, and ◀ ▶ /
the arrow keys reach the points next to them.

The tap-on-pin behaviour added later (`pinAt`, `heldPinX`, `TAP_SLOP_PX`) stays as
it is. The snap only covers the drag, in `scrubTo`.

## Change

1. **`src/profilePanel.ts`**
   - Add constants next to `PIN_HIT_PX_*`, with the same values as the old snap:
     `SNAP_PX_MOUSE = 6` and `SNAP_PX_TOUCH = 12`. Doc comment: how near a pin's
     centre, measured along the chart, a drag snaps onto its point.
   - Update the `PIN_HIT_PX_*` comment, which says "a drag past one never
     snaps". It should now say a press anywhere near a pin lands on it and holds
     there. A drag snaps only within the narrower SNAP_PX.
   - `scrubTo(clientX, pointerType)`: after `indexAtDistance`, look through
     `this.pins`. These are the pins that are actually drawn, so hidden points
     and repeat visits are already left out. Compare each pin's `x` with the
     pointer's `t * rect.width`, and take the nearest one within the threshold.
     This is the old loop, but it reuses `this.pins` instead of filtering
     `this.passes` again.
   - The trail's start and end snap too. Add the first point (index `0`,
     x `0`) and the last point (index `profile.s.length - 1`, x `rect.width`)
     to the snap targets, with the same threshold, even when they have no pin.
     Build the candidates as `[{index: 0, x: 0}, ...this.pins, {index: last,
     x: this.x(profile.s[last])}]` and take the nearest. A pin that sits at the
     start or end is then just a tie.
   - Pass `e.pointerType` from both call sites, `pointerdown` (line 115) and
     `pointermove` (line 125).
   - Module comment (lines 6–7): add that a drag snaps onto a pin, or onto the
     start or end, when it passes close by.
2. **`README.md`** (~line 61): replace "a drag never snaps, so the GPX points
   beside a pin stay in reach" with: "a drag snaps onto a pin, or onto the trail's
   start or end, when it passes close by, and ←/→ or ◀ ▶ step one GPX point at a
   time to the points beside it."
3. Save this plan as `docs/plans/2026-09-23-09-snap-the-profile-drag-again.md`.

## Verification

1. `npm run build` passes.
2. Run `npm run dev` with the profile open on a trail that has pins, such as
   `ohhara_10959058.gpx`. Use a scratchpad Playwright script to check:
   - A drag a few px beside a pin puts the cursor on the pin's point, and the
     readout names the point.
   - A drag well away from pins follows the pointer.
   - Pressing ▶ once from the pin moves to the next GPX point.
   - Hidden points don't snap.
   - A drag within 6 px (mouse) of the chart's left or right edge lands on
     point 1 or the last point.
3. Commit together with the plan doc.
