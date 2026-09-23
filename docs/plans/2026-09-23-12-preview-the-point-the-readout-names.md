# Preview the national point the profile readout names

## Context

0274423 made the map preview (the pin highlight and name label, in 2D and in orbit)
follow the profile cursor. But it only shows when the cursor sits exactly on a pin's
GPX index: `ProfilePanel.passAt(index)`, `src/profilePanel.ts:289`. The panel's
readout uses a looser rule. `pointAt(i)` (`src/profilePanel.ts:439`) names the
nearest non-hidden passed point within `PASS_DISTANCE` (30 m) of the cursor. So the
panel names a point over a stretch of GPX points while the map previews it at only
one, and near two close pins they can even name different points (K51 vs K35 on
`ohhara_10959058.gpx`).

The user wants one rule, the readout's "close to the point" one.

## Change

1. **`src/profilePanel.ts`**
   - Make `pointAt` public and accept `null`
     (`pointAt(i: number | null): NationalPoint-like | null`, returning null for
     `null`). Update its doc comment: the point the readout names, and the one both
     maps preview.
   - Delete `passAt`. It has no other caller. `pinPasses` stays, since
     `stepPass` and `drawPoints` still use it.
2. **`src/main.ts`** `cursorPoint()` (~line 754): return
   `cursorTrail ? profilePanel.pointAt(cursorIndex) : null`. Reword its doc comment
   from "whose pin the profile cursor is on" to "the point the profile readout names:
   the nearest shown one within 30 m of the cursor". Also reword the related comments
   in `syncHover` (main.ts) and `view3d.ts` (`setCursorPoint`, `cursorPoint`,
   `syncHover` doc) from "the pin the profile cursor is on" to "the point the profile
   cursor is at".
3. **`README.md`** (~line 63): "With the cursor on a pin, however it got there, the
   map rings and names that point as a hover would." becomes "Whenever the readout
   names a point, the map rings and names that point too, as a hover would."
4. Save this plan as `docs/plans/2026-09-23-12-preview-the-point-the-readout-names.md`.

Behaviour otherwise unchanged. The mouse hover still wins, nothing is previewed
during playback, and hidden points are never previewed because `pointAt` skips them.

## Verification

1. `npx tsc --noEmit` and `npm run build` pass.
2. With `npm run dev` and the scratchpad Playwright script (`preview.mjs`) on
   `ohhara_10959058.gpx`, for every cursor index 200–230 and around a lone pin,
   compare `#profile-line4` with the 2D `.map-hover-label` text and the
   `.is-hovered` count. They should always agree, including at index 216, where
   both now say K51. Also check that the label shows for a few GPX points either
   side of a pin and clears once the readout's name line empties.
3. Hide points (`H`) and check the preview goes. Also check `;` `'` still preview.
4. Commit together with the plan doc.
