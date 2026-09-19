# Shorter elevation profile

## Context

The selected trail's elevation profile (`#profile`, `src/style.css`) was a fixed 158px
tall: border 2 + 2, padding 4 + 4, a `flex: 1` chart of about 94px, a 4px gap and the
three-line readout (3 × 16px). Over the map or the 3D scene that is a lot of screen
for a curve that reads just as well flatter.

## Change

1. **`--profile-h` 158px → 128px.** Only the chart gives way (about 94 → 64px): it is
   the `flex: 1` child, and the readout keeps its fixed three lines, so what it says
   never moves the panel. `ProfilePanel` already measures `chart.clientHeight` on
   resize, so the path redraws to the new height with no script change.

2. **Every clearance measured from the panel drops by the same 30px**, since the
   notices and the scale bar clear it with a number, not a layout:

   | Rule | Was | Now |
   |---|---|---|
   | `#app[data-selection][data-profile] #notices` | 218 | 188 |
   | `#app[data-mode3d='playback'][data-profile] #notices` | 228 | 198 |
   | scale bar `margin-bottom` with `data-profile` | 218 | 188 |
   | touch walk, `[data-profile] #notices` | 362 | 332 |

   The comments that spell out the sums are updated to match.

## Verification

- `npm run build` passes.
- Select a trail: the panel is 128px, the curve fills the smaller chart, the corner
  labels do not collide on a 320px-wide screen, and the notices and scale bar sit
  just above the panel — also in 3D playback and in touch walk mode.
