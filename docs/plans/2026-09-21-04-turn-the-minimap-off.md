# A button to turn the minimap off

## Context

`2026-09-21-01-2d-minimap-in-3d.md` put the 2D map back on screen as a 100–280px inset
while you walk or play a trail. It is always there, and its only control is a click that
swaps between the two sizes. On a phone that corner is a real slice of the scene, and
nothing gave it back.

The elevation profile already has exactly this affordance — one icon button on a bar,
`aria-pressed` for its state, a flag in `main.ts` behind it — and that is what the user
asked the minimap to have.

Three things were the user's to decide. **One button, on `#mode3d`**: that bar shows in
Walk *and* playback, so one button covers both modes, where the profile needed a pair
(`#selection-profile` is hidden during playback, hence `#playback3d-profile`).
**Per-session state**, a plain flag like `profileOpen` rather than a field in `Settings`
and IndexedDB. **Just the button** — no keyboard shortcut, which the profile has none of
either, and the click-to-enlarge on the inset itself left alone.

## Change

### 1. `index.html` — a fourth button on `#mode3d`

`#minimap3d`, `class="walk-only hud-icon"`, `aria-pressed="true"`, after `#gyro3d`. The
icon is the inset itself: its rounded frame with `#minimap-you`'s arrow at the centre,
the same shape as the arrow's own path. Nothing else in 3D reads like it — the profile
toggle is a mountain and a dashed line, Walk a figure, Gyro a phone.

It goes on the right because `#mode3d`'s offset is measured from the bar's left edge to
Walk's centre, so only what sits left of Walk feeds it: Walk does not move.

### 2. `src/style.css`

1. **`data-minimap` gains an off value.** It meant "absent = small, `large` = large"; it
   is now always written, `'small' | 'large' | 'off'`. The `[data-minimap='large']` size
   rules are untouched.

2. **One new rule**, next to the `data-chrome` restatement:

   ```css
   #app[data-view='3d'][data-minimap='off']:is([data-mode3d='walk'], [data-mode3d='playback'])
     :is(#map, #minimap-you) { visibility: hidden; }
   ```

   `visibility`, with the inset rule above still giving `#map` its size and place, rather
   than the tidier-looking alternative of letting that rule lapse. Lapsing would hand
   `#map` back its full-bleed `inset: 0`, and the `ResizeObserver` in `createMap` would
   fetch a screenful of tiles for a map nobody can see — on a phone, on mobile data, to
   hide something. Off, the inset stays 120px and stays on the eye, so it comes back the
   instant it is asked for rather than sliding into place. It is what a tap on the scene
   during playback already does to it.

   At 2 ids and 3 attributes it outranks the show rule (2 and 2) and ties the
   `data-chrome` rule, which sets the same thing, so neither can lose to the other. No
   transition: like the profile's `hidden` attribute, this is instant.

3. **The `#mode3d` sizing comment** is rewritten. "Eye height and Gyro appear on either
   side of it" is now Eye height left, Gyro and the minimap button right, with a note that
   only what is left of Walk feeds the offset. And the widest bar on touch is 186px, not
   146: 4 border + 6 padding + 56 Eye height + three 36px icons + three 4px gaps. Offset
   83px left of centre it spans 77–263px on a 320px screen, clearing `#expand` (12–46) by
   31px and `#view3d` (276–310) by 13px. On desktop `#gyro3d` is `display: none`, so the
   bar is 130px.

### 3. `src/ui.ts`

`onToggleMinimap` on `UiCallbacks`, the button captured as a field, its click bound, and
`setMinimapShown(shown)` — one `aria-pressed` line, modelled on `setPlaybackProfileShown`.

A `#mode3d` button bound outside `hud3d.ts`, which owns the rest of that bar, for the
reason `#playback3d-profile` already is: `main.ts` owns the flag behind it. `hud3d.ts` and
`view3d.ts` are untouched, and `CHROME` already covers `#mode3d`.

### 4. `src/main.ts`

`minimapOn` (true) and `minimapLarge` (false) beside the profile flags, and one resolver:

```ts
function syncMinimap(): void {
  app.dataset.minimap = !minimapOn ? 'off' : minimapLarge ? 'large' : 'small';
  ui.setMinimapShown(minimapOn);
}
```

`minimapLarge` is a flag rather than the attribute read back, which is what the map's
click handler used to do, so that turning the minimap off and on again brings it back at
the size you left it. Three callers: the new callback, that click handler, and
`setMinimap(true)`, which resets the size for each 3D session but leaves `minimapOn` where
you put it — the same reason `profileOpen` outlives a change of selection.

`followCamera` gains an early return while the minimap is off, after it has recorded
`cameraAt` and written `--yaw` but before the `setView`. Walking it along a map nobody can
see would fetch a tile grid a step at a time, on a phone, to hide it — the same waste the
hiding rule avoids. Keeping the other two lines is what makes the return correct:
`syncMinimap` re-centres from `cameraAt` in the same frame the rule reveals the map, so it
comes back on the eye rather than where you left it, and the arrow is already pointing the
right way — the only thing that can set it while a playback is paused and no frame follows
the button.

### 5. `README.md`

The minimap was never documented at all. A sub-bullet in the 3D section now covers it and
the new button.

## Verification

1. `npm run build` passes.
2. `npm run dev`, desktop: 3D, Walk. The bar is Eye height / Walk / the minimap button
   (no Gyro), pressed, with the inset in the corner. Press it: inset and arrow go, Walk
   does not move. Press again: the inset is back on the eye, not where it was. Enlarge,
   off, on — still large. Leave 3D and come back: off is still off, size back to small.
   Orbit shows no button.
3. Playback: the same button on the same bar, and the playback bar's profile toggle
   unaffected. A tap on the scene takes everything including the button; another brings it
   all back as it was.
4. Headless Chrome against `npm run preview` at 390×844, 844×390 (mobile, touch), 320×568
   and 1280×800. Measured: the bar is 186px on touch and 130px on desktop in Walk and
   playback, 46/40px in orbit where the button is `display: none`, and Walk's centre sits
   on the stage's centre to the pixel in every one of them — the invariant the transform
   encodes, and the one thing a button added on the right could silently break. At 320px
   it spans 77–263, clearing `#expand` by 31px and `#view3d` by 13px. With
   `data-minimap='off'`, `#map` is `visibility: hidden` and still 120/100/180px — not
   full-bleed — and `#minimap-you` is hidden with it; `'large'` is 200/150/280px.
   Clicking the shipped button walks `true/(none)` → `false/off` → `true/small`.
5. `data-chrome='hidden'` still hides the inset and the arrow in all three minimap states,
   the two rules asserting the same thing rather than competing.
6. By hand while walking: turn it off, walk on, turn it back on — it comes back on where
   you now are, not where you left it, and with the arrow already pointing the right way.
   The same with a playback paused, where no camera frame follows the button.
7. 2D is untouched — every new rule is scoped to `#app[data-view='3d']` — and dragging,
   pinching and clicking the full-size map still work after closing 3D.
