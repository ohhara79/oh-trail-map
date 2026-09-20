# A see-through white playback scrubber

## Context

`2026-09-20-01` made `#selection-bar` and `#playback3d` see-through but kept `#scrub3d` on
`accent-color: var(--accent)` as the one bit of colour left. In use it reads as the
opposite of the intent: the blue played half and the browser's opaque grey unplayed half
together are the widest solid thing on the bar, and the scene does not show through them.
The user wants it white, and see-through for the same reason the bar is.

## Change (`src/style.css`)

1. **`#scrub3d` drops `accent-color` for `appearance: none`.** A colour could only have
   recoloured the engine's parts, not given them alpha; handing them over is what lets both
   halves of the track carry it.
2. **The track is `rgba(255, 255, 255, .25)` with a 1px `rgba(0, 0, 0, .2)` edge**, 4px
   tall — the hairline is what keeps it readable over bright tiles, as the bars' own
   `rgba(0,0,0,.2)` border is for them.
3. **The thumb is a solid 12px white circle** with the same hairline, so the position still
   reads at a glance against a track you can see through.
4. **Chrome and Firefox get their own rules.** Each engine drops a rule naming the other's
   pseudo-element, so `::-webkit-slider-runnable-track` / `::-webkit-slider-thumb` and
   `::-moz-range-track` / `::-moz-range-progress` / `::-moz-range-thumb` are written out
   rather than grouped. Firefox draws the played part itself, so it takes a heavier `.55`
   white; Chrome draws none with `appearance: none`, and there the thumb alone marks the
   position, as `#profile`'s cursor dot does.
5. **`height: 16px`**, which the engine used to pick (16px in Chrome, more elsewhere). That
   choice was what made `#playback3d`'s 44px arithmetic a range rather than a number, so
   the comment above it now says so.

## Verification

- `npm run build` passes.
- Play a trail in 3D: the scrubber is white, the scene shows through both halves of the
  track, and the thumb and the track's edge stay visible over pale tiles as well as dark
  ones. Dragging it moves the camera, it follows the playback when released, a click on the
  track jumps, and Tab then ← → still works with a focus ring.
- The bar is still 44px and `#profile` still sits 60px up, in Chrome and in Firefox.
