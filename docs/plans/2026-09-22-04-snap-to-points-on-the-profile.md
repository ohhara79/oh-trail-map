# Snap the profile cursor onto a national point

## Context

Commit 3d5c10b put the national points a trail passes on the elevation profile
as small pins. The readout names a point only when the cursor is within 30 m of
it. On a phone that's a few pixels, so landing on a pin by dragging is fiddly.
The user now wants the snap that was offered and declined in that plan: dragging
near a pin puts the cursor exactly on it.

## Change

1. **`src/profilePanel.ts`**
   - Add `SNAP_PX`: 6 for a mouse, 12 for touch or pen. Each number is
     measured from the pin's centre, in CSS pixels.
   - `scrubTo(clientX, pointerType)`: after it computes the pointer's x on the
     chart, find the visible pass (not in `hiddenPoints`) whose pin
     `this.x(profile.s[pass.index])` is closest. If that pin is within the snap
     distance, the index is `pass.index`. Otherwise the index is
     `indexAtDistance`, as today.
   - Pass `e.pointerType` from the `pointerdown` and `pointermove` handlers.
   - Only dragging snaps. The arrow keys, Home/End, PageUp/PageDown and ◀ ▶ still
     step one GPX point at a time. That way you can still reach the GPX points
     that fall inside a pin's snap zone.
   - Playback needs no change. A snapped scrub still goes through `onCursor`,
     which seeks while a trail plays.
2. **`README.md`**: in the profile bullet, add that dragging near a pin snaps
   the cursor onto it.
3. Save this plan as `docs/plans/2026-09-22-04-snap-to-points-on-the-profile.md`.

## Verification

1. `npm run build` passes.
2. Start `npm run dev` and drive it in headless Chrome with the scratchpad
   playwright-core script, on `ohhara_10959058.gpx` with the profile open:
   - Drag to a few px beside a pin. The cursor line sits exactly on the pin, and
     line 3 names the point.
   - Drag well away from any pin. The cursor follows the pointer freely.
   - Next to a pin, ◀ ▶ still move one GPX point at a time.
   - Hide a point in the National Points list. Its pin no longer snaps.
3. Commit with the plan doc.
