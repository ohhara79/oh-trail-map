# Readout inside the elevation chart

## Context

The elevation panel (`#profile`) is 128px tall, and only about 64px of that is the
chart. The rest is the `.profile-foot` row: a three-line readout (48px plus a 4px
gap) with ◀ ▶ next to it. The panel takes too much of the map, especially on a
phone. I suggested making it see-through, but the user chose to shrink it instead,
with the layout "Readout inside chart":

```
┌──────────────────────────────────────┬──┐
│37.451234, 126.951234          245 m  │◀ │
│231.4 m · +1:02  ╱╲_╱╲                │  │
│#812 · 3.21 km╱╲╱ ┆  ╲___             │▶ │
│212 m_╱╲__╱       ┆   track.gpx 12.34km│  │
└──────────────────────────────────────┴──┘
```

The foot row goes away. The readout sits over the chart's top-left corner, and
◀ ▶ become a thin column on the right. The chart keeps its 64px, so the panel
drops from 128px to **76px** (64 + 8px padding + 4px border; `box-sizing:
border-box`), which saves 52px.

## Change

1. **Markup** (`index.html:180-203`)
   - Move `.profile-readout` (the three `#profile-lineN` divs) into
     `#profile-chart`, after the SVG.
   - Put `#profile-file` and `#profile-total` inside one new
     `<span class="profile-label profile-br">`, file name first, so they share the
     bottom-right corner.
   - Rename `.profile-foot` to `.profile-side`, which now holds only `#profile-prev`
     and `#profile-next`.
   - Update the comment above the panel.

2. **Corners of the chart** (`src/style.css:671-690`)
   - Top-left: the readout, 3 lines × 14px at 11px text, from 3px. This is where
     `#profile-ele-max` was.
   - Top-right: `#profile-ele-max`, which still marks the top of the elevation
     scale. `#profile-total` moves out of this corner.
   - Bottom-left: `#profile-ele-min`, unchanged. It fills 51–61px and the readout
     ends at 45px, so they don't overlap.
   - Bottom-right: `.profile-br` is a flex row with `gap: 4px`. `#profile-file`
     gets cut short with an ellipsis (`min-width: 0`; `max-width` moves to the
     wrapper, widened from 60% to 70%). The total distance stays whole at the
     end of the x-axis, where it belongs.

3. **Readout style** (`src/style.css:693-704`)
   - `position: absolute; top: 3px; left: 4px; right: 4px`, font 11px,
     line-height 14px. Only `#profile-line1` shares a row with the max
     elevation, so only it keeps `margin-right: 48px`; lines 2 and 3 run the
     full width, which keeps `#12,345 / 12,345 · 12.34 km` whole on a 320px
     phone.
   - Use the same halo as the labels (`text-shadow: 0 0 2px #f4f6f8` ×2, plus a
     third for thickness), because the profile line now runs under the text.
   - `pointer-events: none` so scrubbing works across the whole chart.
     **Trade-off:** the readout can't be selected and copied any more (the old
     `user-select: text` goes). If the text caught the pointer instead, hovering
     over the start of the trail would stop scrubbing and the text would change
     under the mouse while you tried to select it. The chart's `title`/aria value
     still has the full values for screen readers.
   - Keep the `#profile-line1` weight and the `#profile-line3` muted colour.

4. **Panel layout** (`src/style.css:633-643, 705-714`)
   - `#profile`: `--profile-h: 76px`, `flex-direction: row`, `gap: 4px`.
   - `.profile-side`: a column with `align-self: stretch`, and the two buttons
     each `flex: 1; min-width: 28px; padding: 0`.
   - Change the `.profile-foot` selectors to `.profile-side`, including the
     `:disabled` rule and the ≤360px media block. There the readout is already
     11px, so that block only tightens the column.
   - The `#profile .profile-side button` rule must still outrank the touch rule
     `.hud-bar button { padding: 8px 12px }` (`src/style.css:882`).

5. **Offsets that depend on the height** (same pattern as commit `0ab8314`)
   - `src/style.css:632` comment: 50 + 76 + 10 = 136px.
   - `:716` `#notices` 188 → **136px**, and `:724` scale-bar `margin-bottom`
     188 → **136px**.
   - `:718-722` playback: 60 + 76 + 10 = **146px** (was 198). Update the comment
     too.
   - `:780` walk: 194 + 76 + 10 = **280px** (was 332).

6. **`src/profilePanel.ts`**
   - Update the class doc comment.
   - `PAD_TOP` (16) stays. The profile's peak still clears the max label, and
     the readout is allowed to sit over the line.
   - No logic changes: `setLines` and the element ids stay the same.

7. **Plan doc**: write this plan to
   `docs/plans/2026-09-19-03-readout-inside-the-chart.md`, in the house style.

## Files

| File | Change |
|---|---|
| `index.html` | Move the readout into the chart, group the bottom-right labels, rename the foot to a side column |
| `src/style.css` | Corner layout, readout overlay, 76px panel, dependent offsets |
| `src/profilePanel.ts` | Comment only |
| `docs/plans/2026-09-19-03-readout-inside-the-chart.md` | New |

## Verification

1. `npm run build` (tsc + vite) passes.
2. `npm run dev`, select a trail, open the profile. The panel is 76px tall, the
   readout sits top-left over the chart, and ◀ ▶ are stacked on the right.
3. Hover or drag across the whole chart, including under the readout. The
   cursor follows everywhere, and the text stays readable where the line
   crosses it.
4. At 320px and 390px widths (devtools): no label overlaps another, the file name
   is cut short with an ellipsis, and the longest readout line
   (`#12,345 / 12,345 · 12.34 km`) fits whole.
5. The notices and the scale bar sit just above the panel in 2D, in 3D playback
   (panel on `#playback3d`), and in walk mode on touch (panel over the lifted
   selection bar).
6. ◀ ▶ step through points, and are disabled at the ends.
