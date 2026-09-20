# A played half on the playback scrubber

## Context

`#scrub3d` is a native `<input type="range">` that `2026-09-20-02-white-playback-scrubber.md`
styled with `appearance: none`, to win the alpha on the track that `accent-color` could
not give. That hands over the engine's own parts, and the engines do not have the same
parts: Chrome and Safari have `::-webkit-slider-runnable-track` and no progress box at
all, while Firefox has `::-moz-range-progress`, a played-portion box it places itself.

So the scrubber read differently per browser. Firefox already filled the played half, a
heavier white — `.55` against the track's `.25` — while in Chrome and Safari there was no
fill and the thumb alone marked the position, which `-02` chose deliberately. The user
wants the played span in a pale blue, told apart by colour rather than by weight or by
nothing, so this revisits that half of `-02` for Chrome and retires Firefox's native box
in favour of one shared gradient.

It extends `2026-09-20-04` rather than reopening `-02`: what `-02` got rid of was
`accent-color`, "a colour could only have recoloured the engine's parts, not given them
alpha". A hand-written `rgba()` keeps the alpha that decision was about, so the scene
still shows through both halves.

## Change

### `src/style.css`

1. **The fill is defined once on `#scrub3d`**, as `--played`, `--fill` and `--track`.
   Neither track rule may name the other engine's pseudo-element — each drops a rule that
   does, which is why the two sets are written out — but a custom property on the host is
   inherited by both, so the gradient is still written once. Its percentages resolve where
   `--track` is used, against each track's own box.
2. **`--fill` is `calc(7px + var(--played) * (100% - 14px))`**, not the raw percentage.
   The thumb is 14px wide with its border, so its centre travels from 7px to 7px short of
   the far end; the raw percentage would run up to 7px ahead of it at the ends.
3. **Both tracks take `background: var(--track)`** — played `rgba(26, 115, 232, .35)`,
   unplayed the `rgba(255, 255, 255, .25)` they already had. The tint is
   `2026-09-20-04`'s one step up in alpha: `.30` on a 4px track reads fainter than `.30`
   on a 30px button.
4. **`::-moz-range-progress` is blanked to `transparent`.** Left alone it would cover the
   gradient, and unstyled it would be accent blue. Both thumbs are untouched.
5. `--played: 0` is declared on the host, so no JS shows an empty track, not a broken one.

### `src/hud3d.ts`

6. **`markPlayed()` writes `--played`**, called from `setPlayback` each frame and from the
   scrubber's `input` handler so a drag paints on the drag rather than a frame behind. It
   rounds and compares against `playedAt` before writing, as `setAttitude` does with
   `attitudeAt`, so a frame that changed nothing touches no style.
7. **It reads the fraction off `this.scrub.value`, not off `state.s`.** While the scrubber
   is held the element's value is the authoritative one and `state.s` trails it by a
   frame, so one line covers playing and seeking alike.

Nothing gets a `transition` — at rAF a transition is only lag — and `height: 16px` and the
margin stay put, since `#playback3d`'s 44px arithmetic counts on them.

## Verification

- `npm run build` passes, and the gradient survives Vite's CSS parse intact.
- Play a trail in 3D: the track left of the thumb is pale blue, right of it stays white,
  the scene shows through both, and the fill tracks the thumb as it advances.
- Drag the scrubber: the fill follows the thumb during the drag and does not freeze or
  jump when the drag ends.
- Both ends — at 0 the blue is a stub under the thumb, at the far end it reaches the thumb
  without overshooting. `Playback` wraps at `total`, so it resets to empty on the loop.
- Seek from the elevation chart (`seekToPoint`): chart, scrubber fill and camera still
  agree, the invariant `2026-09-18-04` records.
- Open it in Firefox as well as Chrome — that is where the risk is, Firefox being the
  engine whose native part is overridden. The two should look identical, with no white
  `::-moz-range-progress` band surviving on top of the gradient.
