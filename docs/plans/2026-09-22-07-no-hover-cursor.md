# Stop 2D mouse hover from moving the profile cursor

## Context

In 2D, hovering near the selected trail moves the profile cursor (the dot on
the trail) to the nearest GPX point, whether the panel is open or not. See
`syncHover()` in `src/main.ts`, around lines 761–767. The user doesn't want the
mouse to move it. From now on, only the profile panel moves the cursor (drag,
keys, ◀ ▶), and 3D playback moves it while a trail plays.

## Change

1. **`src/main.ts`**
   - Delete the hover block at the end of `syncHover()`, including its comment.
   - Drop `nearestPointIndex` from the `./selection` import.
2. **`src/selection.ts`**: delete `nearestPointIndex` and its doc comment. It
   has no other caller. Keep `projectedSegments` and `tolerance`, which
   `trailAt` still uses. Confirm this with a grep.
3. **`README.md`** (lines ~61–66):
   - Remove "In 2D, hovering near the selected trail moves the cursor to the
     nearest point too; a click there still only clears the selection."
   - Remove "hovering still moves them then" from the sentence about the panel
     being closed.
   - Keep the hover-preview paragraph (line 67). That describes the halo and
     name shown before a click, not the cursor.
4. Save this plan as `docs/plans/2026-09-22-07-no-hover-cursor.md`.

## Verification

1. `npm run build` passes, with no unused-import errors.
2. With `npm run dev`, run the scratchpad playwright script
   (`cursor-06.mjs`, adapted):
   - Select the trail and drag on the profile to set a point.
   - Hover on the trail a few px away from the dot. The dot and line 1 of the
     readout don't change.
   - Close the panel. The dot stays.
   - Deselect. The dot is cleared.
   - With nothing selected, the hover preview (halo and name) still works.
3. Commit with the plan doc.
