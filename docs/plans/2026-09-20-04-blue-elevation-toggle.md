# A transparent blue on state for the elevation toggle

## Context

The elevation panel's toggle — the same button on both see-through bars,
`#selection-profile` and `#playback3d-profile` — showed it was on with
`rgba(255, 255, 255, .75)`. Over a mid-tone map pixel that composites to roughly
`(238,240,236)`: a nearly solid white chip on a bar you are meant to see through. The
user wants the map to read through the indicator, and proposed a more transparent blue.

This supersedes item 4 of `2026-09-20-01-see-through-trail-bars.md`, though less than it
appears to. What that item turned down was `.hud-bar`'s *solid* accent fill, "the one
opaque thing left on a bar you are meant to see through". A transparent blue answers that
objection rather than reopening it: hue, not weight, carries the on state, so the
indicator can shed half its opacity and still read. `#mode3d` keeps the solid accent,
that bar being solid.

Those two buttons are the only ones carrying `aria-pressed` on the two bars, so the rules
below are the elevation indicator and nothing else.

## Change (`src/style.css`)

1. **On goes to `rgba(26, 115, 232, .30)`** — `--accent` written out with alpha, there
   being no `--accent-rgb` channel triple and the file already hand-rolling its tints
   (`#eaf2fd`). Over the same mid-tone pixel that is about `(139,170,196)`: clearly a blue
   chip, with the terrain under it still legible.
2. **On + hover goes to `rgba(26, 115, 232, .45)`**, the step up in weight the white pair
   had.
3. **`color: var(--fg)` stays.** The glyph reads near-black over a light tint, where
   `#fff` would vanish; the halo on the base rule carries over untouched.
4. **Off and off + hover are unchanged**, `transparent` and `rgba(255, 255, 255, .5)`.
   Hover stays a neutral white so it reads as "pressable", leaving blue to mean on alone.
5. **The comment above the block is rewritten**, since it recorded the opposite decision.

## Verification

- `npm run build` passes.
- Select a trail: the toggle's on state is a transparent blue, the terrain under it is
  legible, the glyph and its halo stay readable, and hover deepens it. Off is still
  see-through with a white hover.
- Pan so the chip sits over varied ground — forest, built-up, a ridge — and confirm it
  still reads as on against each.
- Play the trail in 3D: `#playback3d-profile` matches the selection bar's.
- `#mode3d`'s Walk and Gyro are untouched — still the solid accent fill.
