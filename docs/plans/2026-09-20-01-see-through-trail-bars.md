# See-through selection and playback bars

## Context

The elevation panel went see-through in `2026-09-19-04` and `-05`, but the two bars it
stacks on kept `.hud-bar`'s opaque `#fff`: `#selection-bar`, which appears when a trail is
chosen, and `#playback3d`, the bottom bar with the scrubber while a trail plays in 3D. The
user wants the map to show through both, the accent-blue fills in them gone, and the
"▶ 3D" button reduced to its glyph so the selection bar takes less room.

## Change

### `index.html`

**`#selection-walk` becomes an icon button**: `class="hud-icon"`, the label down to
`&#9654;` alone, and a static `aria-label` so it still reads as "Walk this trail in 3D"
before `renderSelection` names the trail. The bar is `width: max-content`, so it loses the
width of the "3D" text.

### `src/style.css`

1. **`#selection-bar` and `#playback3d` get `background: rgba(255, 255, 255, .35)`**, the
   same override of `.hud-bar`'s white that `#profile` carries. The 2px `rgba(0,0,0,.2)`
   border stays, so each bar's edge still reads, and neither height changes — the `#notices`
   and scale-bar `calc()`s measured from 34 and 44px are untouched.
2. **`.selection-text` and `.playback3d-text` take the labels' halo**,
   `text-shadow: 0 0 2px #fff, 0 0 2px #fff`. With no solid ground under them, the halo is
   what keeps the trail name, its length and `12.3 km / 20.0 km` readable over busy tiles.
3. **Every button on the two bars goes `background: transparent`** with the same halo, and
   hovering tints it `rgba(255, 255, 255, .5)` in place of the global opaque `#f5f6f8` —
   exactly what `#profile`'s ◀ ▶ do. `#selection-walk`'s own
   `color: #fff; background: var(--accent)` goes away with it.
4. **`aria-pressed='true'` reads as a heavier white there**, `.75` and `var(--fg)`, `.9` on
   hover, instead of `.hud-bar`'s accent fill: solid blue would be the one opaque thing
   left on a bar you are meant to see through. `#mode3d`'s Walk and Gyro keep the accent —
   that bar is still solid. The four rules tie on specificity, so their order decides them.
5. `#scrub3d` is unchanged and keeps `accent-color: var(--accent)`, the one bit of colour
   left in the playback bar.

## Verification

- `npm run build` passes.
- Select a trail: the map shows through the bar, the name, length, ▶, the profile toggle
  and × stay readable, hover tints them, and the toggle's on state is a heavier white. The
  bar is narrower, and the elevation panel still sits 6px above it.
- Play the trail: the bottom bar is see-through too, the blue scrubber still drags and
  follows the playback, ❚❚ / 5× / the profile toggle / × all work, and a tap on the scene
  still fades the whole bar out and back with the rest of the chrome.
