# Preview the national point the profile cursor is on

## Context

134417d made `;` `'` preview the pin they step onto: the 2D pin gets its hover ring
and the name label beside it (`syncHover`, `src/main.ts:874`), and orbit does the
same (`setSteppedPoint`, `src/view3d.ts`). But the preview only exists for `;` `'`,
because `main.ts` keeps it in `steppedPass`, which only `stepPoint` writes
(`src/main.ts:405`). Dragging the profile onto a pin (it snaps there since
377dcb4), tapping a pin, or reaching one with ◀ ▶ / `,` `.` shows nothing on the map.

The user wants the same preview whenever the cursor is on a national point, however
it got there. So derive the previewed point from the cursor itself instead of from a
record of the last `;` `'` step.

"On a national point" = the cursor's GPX index is the index of a drawn pin (the
dedup'd, non-hidden passes `drawPoints` draws). That is exactly where the drag snap,
the pin tap and `;` `'` land, so it matches what the user sees on the chart.

## Change

1. **`src/profilePanel.ts`**
   - Pull the "passes that get a pin" loop (skip hidden, skip a repeat of the pin
     before) into one private helper, e.g. `private pinPasses(): PointPass[]`, and use
     it in both `stepPass` and `drawPoints` so the two cannot drift.
   - Add `passAt(index: number | null): PointPass | null` — the pin pass at GPX point
     `index`, or null. Takes the index rather than reading `this.cursor`, so main.ts
     asks about its own `cursorIndex`.
2. **`src/main.ts`**
   - Remove `steppedPass` (line 182) and its write in `stepPoint` (lines 403–407):
     the shortcut just calls `profilePanel.stepPass(delta)`; its `onCursor` →
     `setCursor` → `applyCursor` → `applySteppedPoint` already refreshes the preview.
   - Rename `steppedPoint()` → `cursorPoint()` and make it
     `cursorTrail && profilePanel.passAt(cursorIndex)?.point || null` (hidden points
     are already excluded by the helper). Rename `applySteppedPoint` →
     `applyCursorPoint` and update its callers (`applyCursor`, `syncPoints`,
     `open3d`'s `view.setSteppedPoint(...)`) and the local `stepped`/`steppedAt`/
     `steppedOn` names and comments in `syncHover`.
   - Rewrite the comments that say "the pin `;` `'` stepped onto" to "the pin the
     profile cursor is on".
3. **`src/view3d.ts`** — rename `setSteppedPoint`/`steppedPoint` to
   `setCursorPoint`/`cursorPoint` and update the three comments (lines ~141, 284, 792)
   the same way. Behaviour unchanged.
4. **`README.md`** — the `;` `'` row loses "ringed and named on the map as a hover
   would"; the elevation-profile paragraph (~line 61) gains: when the cursor is on a
   national point's pin, the map rings and names that point as a hover would.
5. Save this plan as `docs/plans/2026-09-23-11-preview-the-point-the-cursor-is-on.md`.

Unchanged: the mouse hover still wins over the cursor preview (`syncHover` order),
nothing is previewed while playing, and the 2D label only shows while the pin is on
screen.

## Verification

1. `npm run build` passes.
2. `npm run dev`, select a trail with pins (e.g. `ohhara_10959058.gpx`), open the
   profile; with a scratchpad Playwright script check:
   - Dragging onto a pin: the 2D pin is ringed and its name shows beside it; dragging
     off it clears both.
   - Tapping a pin, and `,` `.` / ◀ ▶ landing on a pin index, do the same.
   - `;` `'` still preview as before.
   - Hiding the point (H or its checkbox) removes the preview.
   - Mouse hovering another pin/trail shows that instead; moving away brings the
     cursor's point back.
   - In 3D orbit the cursor's point is labelled beside its dot; in playback nothing is.
3. Commit together with the plan doc.
