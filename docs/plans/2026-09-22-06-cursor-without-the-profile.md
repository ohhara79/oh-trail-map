# Keep the cursor's dot while a trail is selected

## Context

The dot on the map that marks the profile cursor's GPX point (the "current
location" on the trail) only exists while the elevation profile is open.
`syncProfile()` in `src/main.ts` ties the cursor to `profileTrail`, which is the
selected trail **only while `profileOpen`**. Close the panel and the dot goes,
and 2D hover no longer moves it. Separately, `parkedCursor` brings the old point
back when the same trail is selected again.

The user wants:
- the dot to follow the selected trail whether the panel is open or not, and
- the cursor to be cleared as soon as the trail is deselected, with no restore
  when the trail is picked again.

## Change

1. **`src/main.ts`**: split "whose cursor" from "is the panel showing".
   - Rename `profileTrail` → `cursorTrail`, which is `playbackTrail ?? selected
     trail`, with no `profileOpen` check. Update the comment block (lines ~151–160).
   - Remove `parkedCursor`. When `cursorTrail` changes, `cursorIndex` becomes
     `null`, so deselecting (or picking another trail) clears the cursor. Ending
     playback on the selected trail leaves `cursorTrail` the same, so the point
     you stopped on stays, as it does now.
   - `syncProfile()`:
     - `hidden = playbackTrail ? !playbackProfileOpen : !profileOpen`
     - `ui.setProfileShown(cursorTrail !== null && !hidden)`
     - `profilePanel.setHidden(hidden)`
     - then, if the trail changed: `profilePanel.show(profile of cursorTrail, …)`
       and `applyCursor()`, as now.
     The panel keeps its profile and cursor while hidden, the same way playback's
     own hide button already works (`ProfilePanel.setHidden`). Its ResizeObserver
     redraws the panel when it opens again.
   - `cursorAt()`, `onWalkTrail`'s `from`, and the hover block in `syncHover()`
     (lines ~763–769) use `cursorTrail`. Hover near the selected trail now moves
     the dot with the panel closed too. Update that comment ("With the profile
     open" → "While a trail is selected").
   - Update the `syncProfile` doc comment to match.
2. **`src/profilePanel.ts`**: no logic change. Update the `setHidden` comment if
   it still says only playback uses it.
3. **`README.md`** (around lines 52–63): say that the dot and 2D hover work
   whenever a trail is selected, the panel only adds the chart and readout, and
   deselecting the trail clears the point.
4. Save this plan as `docs/plans/2026-09-22-06-cursor-without-the-profile.md`.

## Verification

1. `npm run build` passes.
2. Run `npm run dev` and use the scratchpad playwright-core script on
   `ohhara_10959058.gpx`:
   - Select the trail with the profile closed and hover near it. The dot follows.
   - Open the profile. The readout shows the same point. Close it. The dot stays.
   - Deselect (click the map). The dot is gone. Select the trail again. There is
     no dot until you hover again, and the profile reads "Drag along the profile".
   - 3D: with the profile closed, the ball/dot for the cursor still shows. Walk
     the trail from a hovered point, and it starts there.
   - Playback: the panel's hide button still hides only the panel, and stopping
     leaves the cursor on the point you stopped on.
3. Commit with the plan doc.
