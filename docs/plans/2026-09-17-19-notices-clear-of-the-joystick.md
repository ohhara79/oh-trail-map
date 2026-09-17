# Notices sit clear of the joystick while walking

## Context

On a touch screen, entering 3D walk mode shows a how-to notice for 6 seconds
(`notify(...)` in `src/view3d.ts:721`). You can't use the joystick until it goes away.

**Cause.** `#notices` is pinned to the bottom of the map. On a phone it runs from 12px
to 56px from the edges, starting 16px up (`src/style.css:653`, `:710`). Each `.notice`
takes pointer events (`pointer-events: auto`, so its × can be pressed) and sits at
`z-index: 1200`. The joystick is at `z-index: 1000`, 24px in from the left and
24–144px up (`src/style.css:627`). So the notice covers the lower part of the stick
and catches every touch there. The same happens to any other notice raised while
walking, such as the gyro errors.

`#selection-bar` already solves this: while walking on a coarse pointer, it moves to
154px up, just above the joystick (`src/style.css:650`). Notices should do the same.

## Change

### `src/style.css`

Inside the existing `@media (pointer: coarse)` block that shows the joystick
(`src/style.css:647`), lift the notices over the joystick:

```css
/* Over the joystick, not on it: a notice takes touches, so it blocked the stick. */
#app[data-mode3d='walk'] #notices { bottom: calc(154px + env(safe-area-inset-bottom)); }
/* And over the selection bar, which is lifted to 154px (34px tall) + a 10px gap. */
#app[data-mode3d='walk'][data-selection] #notices { bottom: calc(198px + env(safe-area-inset-bottom)); }
```

The plain walk rule ties with the base `#app[data-selection] #notices` rule (`:670`) on
specificity and loses to it on source order when a trail is selected. That is why the
`[data-selection]` walk rule is needed; its extra attribute wins. The small-screen `#notices { left; right }`
rule only sets the horizontal inset, so it still applies.

Leave the rest alone. The hint still shows for 6 s and can still be closed with ×. It
is just no longer on top of the stick. Desktop has no joystick, so the rules are
scoped to `pointer: coarse`, as the selection bar's are.

### `docs/plans/2026-09-17-19-notices-clear-of-the-joystick.md`

This plan, committed with the CSS change.

## Verification

1. Run `npm run dev`. Open the app in Chrome DevTools device emulation (a phone, so
   `pointer: coarse` matches), or on a real phone.
2. Open 3D and switch to Walk. The hint should appear above the joystick, not over
   it. Drag the joystick right away: the camera should move while the hint is still
   up.
3. Pick a trail with the crosshair so the selection bar shows, then trigger another
   notice (for example, turn on the gyro in a browser without orientation). The
   notice should stack above the bar, not overlap it.
4. Check that orbit, playback, and desktop walk still show notices in their old
   place at the bottom.
5. Run `npm run build` (typecheck + build) to confirm nothing else broke.
