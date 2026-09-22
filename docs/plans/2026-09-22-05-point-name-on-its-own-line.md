# Name the national point on a fourth readout line

## Context

Commit 3d5c10b shows the national point under the profile cursor by putting its
name on line 3 of the readout. That line normally reads `#n / N · distance`, so
the point number and the distance disappear while you're on a point. The user
wants to keep them and show the name on a new line below them. The panel can
grow a little taller to make room.

## Change

1. **`index.html`**: add `<div id="profile-line4"></div>` after
   `#profile-line3` in `.profile-readout`.
2. **`src/profilePanel.ts`**
   - Add `profile-line4` to `lines`.
   - Line 3 always shows `#n / N · distance` again.
   - Line 4 shows the point's name, or its code if it has no name. It gets the
     pin colour and the `.profile-point-name` class. Off a point, and with no
     cursor, line 4 is empty. The no-cursor hint stays on lines 1–3.
   - Move the colour and class reset from `lines[2]` to `lines[3]`. `setLines`
     then takes four strings.
   - `aria-valuetext` is unchanged.
3. **`src/style.css`**: add one 14 px line.
   - `--profile-h`: 76 → **90px**. The chart grows from 64 to 78 px, so the line
     keeps its room under the taller readout.
   - Update the offsets that clear the panel: `136px` → **150px** (notices and
     scale bar) and `146px` → **160px** (notices during playback).
   - The touch Walk rule that puts the notices above the lifted profile:
     `280px` → **294px** (194 + 90 + 10).
   - Update their comments: 50 + 90 + 10, 60 + 90 + 10, 194 + 90 + 10, a 78 px
     chart, and the readout "ending 59px down".
   - "Always three lines" → "Always four lines".
   - `#profile-line3.profile-point-name` → `#profile-line4.profile-point-name`.
4. **`README.md`**: the readout names the point "on a line below the number and
   distance" rather than "in place of" them.
5. Save this plan as
   `docs/plans/2026-09-22-05-point-name-on-its-own-line.md`.

## Verification

1. `npm run build` passes.
2. Start `npm run dev` with a 1400 px wide window and use the scratchpad
   playwright-core script on `ohhara_10959058.gpx` with the profile open:
   - Drag onto a pin. Line 3 still shows `#n / N · distance`, and line 4 shows
     the name in the pin colour.
   - Drag off the pin. Line 4 is empty, and nothing moves.
   - Take a screenshot of the panel. All four lines fit, the line is not
     squashed, the notices and the scale bar clear the taller panel, and the
     panel doesn't overlap the controls above it.
3. Commit with the plan doc.
