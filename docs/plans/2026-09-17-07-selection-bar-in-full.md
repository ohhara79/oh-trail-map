# Show the selected trail in full on the map

## Context

Clicking a trail shows `#selection-bar` (name · distance · **▶ 3D** · ×) at the
bottom of the map. It was a single 34px line with `.selection-name` clamped by
`nowrap` + `ellipsis`, so a long name was cut off, and it showed only the
distance. The Trails list has drawn each row in full since
`2026-09-17-05-always-show-rows-in-full.md`: the whole name, wrapped, over the
full stats line (distance · ↑ ascent · duration · pts). The bar now shows the same
info as the list, with nothing cut off.

## Approach

### 1. Content: `src/ui.ts`

`renderSelection()` fills `#selection-stats` from `statsLine()`, the same
function the list row uses, so the two can't drift apart.

### 2. Styles: `src/style.css` and `index.html`

- `.selection-text` stacks the name over the stats, like a list row.
- `.selection-name` loses its clamp and takes `overflow-wrap: anywhere`, the same
  as `.trail-name`. The stats span gets a `selection-stats` class: 11px and
  wrapping, like `.trail-stats`.
- `#mode3d` keeps `height: 34px`, and `#selection-bar` gets `min-height: 34px`, so
  a wrapped name makes the bar taller. Its buttons still stretch to its height.
  `width: max-content` and the `min(560px, 100% − 68px)` cap stay, so a short name
  still gets the compact bar.

### 3. Notices and the scale bar

Both used to be lifted by a fixed 54px (10px bottom + 34px bar + 10px gap).
Now a `ResizeObserver` in `src/ui.ts` writes the bar's height to `--selection-h`
on `#app`, and both rules use
`calc(20px + var(--selection-h, 34px) + env(safe-area-inset-bottom))`.

## Out of scope

The name in the 3D playback controls (`.playback3d-name`) still ellipsizes. It
shares a line with the scrubber.

## Verification

1. `npm run build`: typecheck and bundle pass.
2. `npm run dev`, on desktop and at 390×844 with touch emulation:
   - A long-named trail's bar shows the whole name, wrapped, over the full stats
     line. ▶ 3D and × fill the bar's height and still work.
   - A short-named trail keeps the compact bar.
   - With a tall bar, the scale bar and a notice sit above it, not on it.
   - The bar still hides during 3D playback, and sits above the joystick while
     walking on touch.
