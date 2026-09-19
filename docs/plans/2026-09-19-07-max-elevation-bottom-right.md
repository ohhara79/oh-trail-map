# Maximum elevation to the bottom right, no file name on the profile

## Context

On a narrow phone the elevation profile's first readout line (`lat, lon`) was cut
short. That line kept 48px clear for the maximum elevation in the chart's top-right
corner. The user wants that number moved to the bottom right, and the .gpx file name
there removed to make room.

## Change

1. **`index.html`**: the bottom-right label holds `#profile-ele-max` and then
   `#profile-total` in place of `#profile-file`.
2. **`src/style.css`**: `#profile-ele-max` no longer sits at the top right. A ` ·`
   after it reads `812 m · 5.23 km`. With the file name gone, `.profile-br` doesn't
   need its clipping and `max-width`. `#profile-line1` loses its 48px right margin.
3. **`src/profilePanel.ts`**: remove the `file` label. The file name still goes into
   the chart's `aria-label`.

## Verification

- `npm run build` passes.
- At phone width, with a point picked, the whole `lat, lon` line shows. The bottom
  row reads the minimum elevation at the left and `max · length` at the right.
