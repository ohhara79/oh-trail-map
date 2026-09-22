# Show one pin per run of the same national point on the profile

## Context

`pointPasses()` (`src/trailProfile.ts`) splits the trail into passes: each run
of GPX points within `PASS_DISTANCE` (30 m) of a national point counts as one
pass. When GPS jitter moves the track back and forth across the 30 m edge, one
real visit turns into several passes. The elevation profile then draws a row of
identical pins. The user wants only the first pin to show whenever the next
visible pin is the same national point as the one before it.

## Change

1. **`src/profilePanel.ts` – `drawPoints()`** (~line 262)
   - Track the code of the last pin drawn (`let last = ''`). Skip hidden points
     as the code does now. If `point.code === last`, skip that pass too.
     Otherwise draw the pin and set `last = point.code`.
   - The check goes here, not in `pointPasses()`, so it looks only at visible
     pins. With A, then a hidden B, then A again, the second A is dropped. The
     cached `pointPasses()` output doesn't need to change when a point is
     toggled.
   - Update the doc comment: "A pin on the line for each pass of a point that
     is on … A pass of the same point as the pin before it (GPS jitter across
     PASS_DISTANCE) draws nothing, so a visit shows one pin, at its first pass."
   - Leave `pointAt()` and the readout alone. The name still shows at every GPX
     point within 30 m.
2. **`README.md`** (~line 58): after "sit on the line as small pins", add
   "(one per visit: repeats of the same point in a row, from GPS jitter, show
   only the first)", or similar short wording.
3. Save this plan as `docs/plans/2026-09-22-09-one-pin-per-visit.md`.

Side effect: an out-and-back trail that passes a point and comes straight back,
with no other visible point in between, now shows one pin instead of two. This
follows from the "consecutive" rule the user asked for.

## Verification

1. `npm run build` passes.
2. Run `npm run dev` and use the scratchpad playwright-core script with the
   profile open, on a trail in `data/gpx/` with jitter near a point. Count the
   `circle`s in the profile's points group before and after the change: the
   repeats are gone, the first pin of each run stays in place, and with the
   cursor on the later spots the readout still names the point.
3. Commit with the plan doc.
