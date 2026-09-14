# Size the selection bar like the 3D mode bar

## Context

Clicking a trail shows `#selection-bar` (name · distance · **▶ 3D** · ×) at the bottom
of the map. It looks much bigger than the `#mode3d` bar (Orbit / Walk) and the `#view3d`
button at the top:

- **Height.** `#mode3d` was pinned to `#view3d`'s 34px (`src/style.css:380-388`, plan
  `2026-09-15-05`). `#selection-bar` still takes its height from `.hud-bar`: 2px border
  + 3px padding + buttons with 4px vertical padding ≈ 38px. On touch,
  `.hud-bar button { padding: 8px 12px }` makes it ≈ 46px.
- **Width.** It stretches between `left: 12px` and `right: 56px`, up to 560px. The
  mode bar is only as wide as its contents.

The user wants it the same size as the mode bar: 34px tall, and only as wide as its
contents (still capped, and centred).

## Change

1. **`src/style.css`, the `#mode3d` height rules** (lines 380-388): share the 34px
   height and the button stretch with the selection bar instead of repeating them:
   ```css
   #mode3d {
     top: calc(12px + env(safe-area-inset-top));
     left: 50%; transform: translateX(-50%);
   }
   /* The 34px of #view3d, so both bars match the floating buttons. The buttons
      fill what the border and padding leave: 34 − 2×2 − 2×3 = 24px. */
   #mode3d, #selection-bar { height: 34px; }
   /* Outranks .hud-bar button, including its taller padding on touch below. */
   :is(#mode3d, #selection-bar) button { align-self: stretch; padding-block: 0; }
   ```
   `:is()` takes the id's specificity, so it still beats `.hud-bar button` inside
   `@media (pointer: coarse)`.

2. **`src/style.css`, `#selection-bar`** (lines 426-433): fit the contents, centred in
   the same space, and never wider than that space:
   ```css
   #selection-bar {
     bottom: calc(12px + env(safe-area-inset-bottom));
     left: 12px;
     /* Clears the locate button's column. */
     right: 56px;
     /* As wide as its contents, like #mode3d, centred between the insets. The
        100% − 68px keeps a long name inside them, where it ellipsizes. */
     width: max-content;
     max-width: min(560px, 100% - 68px);
     margin: 0 auto;
   }
   ```
   `.selection-text` is `.grow` (`flex: 1; min-width: 0`) and `.selection-name` already
   has `min-width: 0` + ellipsis, so when the cap applies the name shrinks and the
   buttons stay whole.

3. **`src/style.css`, notices offset** (line 483): the bar now reaches 46px up
   (12 + 34), so `#app[data-selection] #notices` moves from `60px` to `56px`, keeping
   a 10px gap.

4. **`src/style.css`, touch-targets comment** (`@media (pointer: coarse)`): mention
   `#selection-bar` alongside `#mode3d` as holding 34px on touch.

5. **Plan doc**: save this plan as `docs/plans/2026-09-15-10-compact-selection-bar.md`.

## Verification

- `npm run build` passes.
- `npm run dev`:
  - Desktop, 2D: click a trail. The bar is 34px tall (DevTools), only as wide as name +
    distance + ▶ 3D + ×, centred at the bottom. Labels are vertically centred, and ▶ 3D's
    blue fills its button.
  - 3D orbit: the bottom bar and the Orbit/Walk bar at the top are the same height and
    look alike.
  - ~400px touch-emulated viewport: still 34px (not 46px); a long trail name ellipsizes
    and the bar stays clear of the locate/zoom column; a notice (e.g. locate) sits above
    the bar, not on it.
  - ▶ 3D and × still work.
