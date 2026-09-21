# Keep the profile point when the profile closes and reopens

## Context

Turning the elevation profile off and on again with the selection bar's profile button
lost the point its cursor was on: the map dot went away with the panel, and the chart came
back with no cursor. `syncProfile()` sees `profileTrail` go `trail → null` on close and
`null → trail` on reopen, and every change of `profileTrail` cleared `cursorIndex` — right
for a different trail, where a point number means nothing, but not for the same trail
coming back. The user wants the point kept.

## Change

### `src/main.ts`

1. **`parkedCursor`**, next to `cursorIndex`: `{ trail, index } | null`, the point the
   cursor was on when the panel last let go of a trail.

2. **`syncProfile()`** parks the cursor before `profileTrail` changes (only if there is
   one, so passing through a trail with no cursor does not overwrite it), and the new
   trail takes the parked index if it is the parked trail, `null` otherwise. The existing
   `applyCursor()` after `profilePanel.show()` then puts it back on the chart, the 2D dot
   and the 3D dot.

What falls out of it: close and reopen keeps the point; deselecting and reselecting the
same trail keeps it; A → B → A brings A's point back; and 3D playback stopping on the
selected trail with the profile closed leaves reopening on the point it stopped on, as
the panel already does when it stays open.

## Verification

- `npm run build` passes.
- Select a trail, open the profile, pick a point; toggle the profile off and on — the
  cursor, the readout and the map dot are back on the same point.
- Another trail opens with no cursor; going back to the first restores its point.
