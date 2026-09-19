# See-through ◀ ▶ on the elevation profile

## Context

The elevation panel (`#profile`) went see-through in the previous change, but its ◀ ▶
buttons kept the global `button { background: #fff }`, so they sat on it as two opaque
white tiles. The user wants them see-through like the rest of the panel.

## Change (`src/style.css`)

1. **`#profile .profile-side button` gets `background: transparent`** and the labels'
   white halo, `text-shadow: 0 0 2px #fff, 0 0 2px #fff`, so the glyphs stay readable
   over busy tiles as the readout and min/max do.
2. **Hovering an enabled one tints it `rgba(255, 255, 255, .5)`**, in place of the
   global opaque `#f5f6f8`, so they still read as pressable. Disabled ones get no
   hover, matching their `cursor: default`, and still dim to `.35`.

## Verification

- `npm run build` passes.
- Select a trail: the map shows through ◀ ▶, the glyphs stay readable, hover tints them,
  disabled ones dim, and stepping points still works — in 2D and in 3D orbit, walk and
  playback.
