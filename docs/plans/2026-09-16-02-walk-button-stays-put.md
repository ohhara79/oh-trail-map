# Keep the Walk button in place when walking starts

## Context

The 3D mode bar (`#mode3d`) is centred on the screen. In orbit mode it holds only Walk.
In walk and playback modes, Eye height and Gyro appear to the right of Walk. The bar grew
and stayed centred, so Walk moved left under your finger.

Putting Eye height to the left of Walk and Gyro to the right is not enough by itself:

- the Eye height label is wider than the Gyro icon
- the label's width changes as it cycles through 1.7, 20 and 80 m
- desktop has no Gyro

## Change

1. **`index.html`**: `#eye3d` moves in front of `#walk3d`. The order is now Eye height,
   Walk, Gyro.
2. **`src/style.css`**
   - `#mode3d` sets two widths as custom properties: `--icon-w` for Walk and Gyro, and
     `--eye-w` for Eye height. They are 30/52px, or 36/56px on touch. Eye height uses
     a fixed width with its text centred, so cycling it moves nothing.
   - The bar is placed by the centre of Walk, not by its own centre. In walk and
     playback modes it moves left by `2 border + 3 padding + --eye-w + 4 gap +
     --icon-w / 2`. That distance is the same with or without Gyro. Orbit keeps
     `translateX(-50%)`, since Walk is the whole bar there.
   - The narrow-screen override for `#mode3d` (`left/right: 58px; margin: 0 auto`) is
     gone. It centred the bar box. The widest bar, on touch, is 146px, and it still
     clears `#expand` and `#view3d` on a 320px screen.

## Verification

1. `npm run build` passes.
2. Headless Chrome with the built CSS, in a 320px container, measuring the centre of
   Walk:
   - orbit, walk and playback modes
   - with and without Gyro
   - mouse and touch widths
   - every Eye height label

   Walk sat at x = 160 in every case. The labels fit, and on touch the bar spans
   77–223px.
3. `npm run dev` → 3D → Walk and back, on desktop and with touch emulation: Walk
   doesn't move.
