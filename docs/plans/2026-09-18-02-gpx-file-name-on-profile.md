# GPX file name on the elevation profile

## Context

The profile panel (`#profile`, `src/profilePanel.ts`, from 2026-09-18-01) reads out the selected
trail's GPX points. Nothing in it says which `.gpx` file those points come from. The selection
bar shows the trail's `<name>`, which is a long Korean route description and not the file name.
The file name is already available: `Trail.id` is the bare file name in `data/gpx/`
(`TrailFile.file` in `src/trailFiles.ts`, passed as the id in `main.ts`).

## Change

1. **`index.html`**: add `<span id="profile-file" class="profile-label">` to `#profile-chart`.
   It goes in the bottom-right corner, the only one still free: max elevation is top left, min is
   bottom left, total distance is top right.
2. **`src/style.css`**: `#profile-file` is capped at 60% of the chart's width, on one line, and
   cut with an ellipsis. The clip at `line-height: 1` would cut off the underscore
   (`ohhara_10672068.gpx`), so the label sits 2px lower and has 2px of bottom padding. It keeps
   the `.profile-label` text shadow, which keeps it readable where the line runs through it at
   the trail's low end. It also keeps `pointer-events: none`, so scrubbing works under it.
3. **`src/profilePanel.ts`**: `show(profile, fileName)` sets the label's text and `title`, once
   per trail. The label takes no pointer, so the full name also goes in the chart's
   `aria-label` ("GPX point along <file>"). `Profile` itself is unchanged.
4. **`src/main.ts` `syncProfile()`**: passes `trail?.id` to `show()`.
5. **`README.md`**: the profile bullet mentions the file name.

## Verification

1. `npm run build`: `tsc --noEmit` and `vite build` pass.
2. **Headless Chrome over CDP against `vite preview`:**
   - 1280×800: select the first row and open the profile. The label reads `ohhara_10672068.gpx`
     and the chart's aria-label is `GPX point along ohhara_10672068.gpx`. Selecting the second
     row with the panel still open changes it to `ohhara_10681045.gpx`.
   - A 3× crop of the corner shows the underscore whole.
   - 320×700 (mobile): the label is at x 141–254 and the min-elevation label at 22–54. They sit on
     the same row without touching, and the name fits without an ellipsis.
3. To check by hand: in 3D the same panel shows the same name.
