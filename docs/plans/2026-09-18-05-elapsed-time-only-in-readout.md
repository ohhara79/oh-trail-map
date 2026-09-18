# Drop the clock time from the GPX point readout

## Context

The profile panel's readout (`#profile-line1..3`, filled by `ProfilePanel.syncCursor`,
`src/profilePanel.ts:227`) is three fixed-height, one-line rows. On a small phone the readout
gets only about 180–220px beside ◀ ▶, and lines 2 and 3 get cut off:

- line 2 `123.4 m · 2026-09-18 08:49:14` (29 chars)
- line 3 `#1,234 / 3,456 · 3.21 km · +1:13:22` (36 chars)

The user chose to remove the absolute time and keep only the time since the start. That also
avoids the question of which date to show when a trail spans several days. The panel keeps its
three lines and its 158px height, so none of the notice or scale-bar offsets in `style.css` change.

## Width check

The readout's width, from `style.css`: the panel is `100vw − 12 − 56`, minus 8px of padding,
minus ◀ ▶ and the gaps between them, minus the readout's own padding.

- 320px: 176px at 11px
- 361px: 197px at 12px (the worst case above the 360px media query)
- 375px: 211px at 12px

Text widths were measured in headless Chrome with tabular numbers, using worst-case values
(`1234.5 m`, `#12,345 / 12,345`, `12.34 km`, `+12:34:56`). Arial stands in for Roboto on Android.
DejaVu Sans is wider and stands in for iOS SF.

| line | 11px Arial / DejaVu | 12px Arial / DejaVu |
|---|---|---|
| L1 now/new `37.123456, 127.123456` | 116 / 133 | 127 / 145 |
| L2 now `… m · 2026-09-18 08:49:14` | 157 / **180** | 171 / 196 |
| L3 now `#… / … · … km · +12:34:56` | **195 / 229** | 213 / **249** |
| L2 new `1234.5 m · +12:34:56` | 104 / 122 | 114 / 133 |
| L3 new `#12,345 / 12,345 · 12.34 km` | 137 / 159 | 149 / 174 |

Today, line 3 overflows on every phone width, and line 2 is right at the limit. After the change,
the widest line is 159px against 176px at 320px, and 174px against 197px at 361px. That leaves at
least 20px to spare in the wide font. Only the `L1` row uses weight 500.

## Change

1. **`src/profilePanel.ts` `syncCursor`**: new line layout:
   - line 1: `37.123456, 127.123456` (unchanged)
   - line 2: `123.4 m · +1:13:22`: elevation plus elapsed time. Moved up from line 3, where it
     overflowed. With no time on the point (or no start time), it shows `123.4 m · no time`, as today.
   - line 3: `#1,234 / 3,456 · 3.21 km` (25 chars, fits in ~165px at 11px)

   Update the comment above `where`, since elapsed time no longer sits at the end of line 3.
   Remove `formatPointTime` from the import.
2. **`src/trailProfile.ts:106-126`**: delete `TIME_FORMAT` and `formatPointTime`. Nothing else
   uses them.
3. **`src/style.css:704-705`**: reword the 360px media-query comment. It should say the lat/lon
   and all three lines fit whole, not "the elevation and time lines".
4. **`README.md:52-53, 84-85`**: drop "time (in the browser's time zone)" / "time" from both
   readout descriptions. Keep "how long after the start".
5. **`src/profilePanel.ts:1-5`** header comment: "its number, lat/lon, elevation, time, and how
   far…" becomes "…elevation, and how far and how long into the trail it is".
6. Write this plan to `docs/plans/2026-09-18-05-elapsed-time-only-in-readout.md`.

## Verification

1. `npm run build` (tsc + vite) passes, with no unused-import error.
2. `npm run dev`, then in devtools use a 320px-wide device: select a trail, open the profile, and
   scrub. All three lines show whole, with no ellipsis, including near the end of a long trail
   (`+h:mm:ss`, `xx.xx km`).
3. A GPX with no timestamps shows `… m · no time` on line 2.
4. Playback in 3D: the readout follows the playback position with the new layout.

## Result

`npm run build` passes. The built CSS and the real `#profile` markup were rendered in headless
Chrome inside iframes 320, 361 and 375px wide, and each line's `scrollWidth` was compared with its
`clientWidth`. With the worst-case values, the old layout cut line 3 at every width (and line 2 at
320px in DejaVu Sans). The new layout cuts nothing.
