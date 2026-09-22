# Hold ◀ ▶ on the profile to keep stepping, faster the longer it's held

## Context

On a phone, long-pressing the elevation profile's ◀ / ▶ (`#profile-prev`,
`#profile-next`) selects the glyph and pops the browser's "Copy" menu instead of
doing anything useful. The buttons step only on `click`, one point per tap, so
crossing a 3000-point trail takes a lot of tapping. Wanted: holding an arrow keeps
stepping, and speeds up the longer it's held (keyboard arrows already auto-repeat;
this is for the buttons).

## Behaviour

- Press ◀/▶ (mouse, touch, pen): one step at once, as today.
- Keep holding: after `HOLD_DELAY_MS` (400 ms) it repeats every `REPEAT_MS` (50 ms),
  1 point per tick for the first second, 5 per tick up to 2.5 s, then 20 per tick
  (~20 → 100 → 400 points/s).
- Stops on release, cancel, the pointer leaving the button, or reaching the trail's
  first/last point (the button goes disabled there).
- No text selection, no callout / "Copy" menu, no context menu on long press.
- Keyboard activation (Enter/Space on a focused button) still steps once.

## Change

1. **`src/profilePanel.ts`**
   - Constants beside the others: `HOLD_DELAY_MS = 400`, `REPEAT_MS = 50`, and a small
     step-size-by-held-time rule (1 → 5 → 20 at 1 s / 2.5 s), with a one-line comment
     in the file's voice.
   - `private holdTimer: number | null = null` and a `stopHold()` that clears it
     (both the delay `setTimeout` and the repeat `setInterval`).
   - `private holdArrow(button, dir)` wiring, used for `prev` (-1) and `next` (+1):
     - `pointerdown` (button 0 only): `setPointerCapture`, `this.step(dir)`, record the
       start time, start the delay timer → then the interval that calls
       `this.step(dir * sizeFor(elapsed))`; stop when the cursor no longer changes
       (end reached). `preventDefault()` so a touch doesn't start a selection.
     - `pointerup`, `pointercancel`, `lostpointercapture` → `stopHold()`.
     - `contextmenu` → `preventDefault()`.
     - `click` → step only when `e.detail === 0` (keyboard activation); pointer clicks
       already stepped on `pointerdown`. Replaces the two current `click` listeners
       at ~line 143.
   - `show(null)` / a new profile also calls `stopHold()` so a hold can't outlive the
     trail. `step()` is reused unchanged; make it return whether the cursor moved so
     the interval knows when to stop.
   - Update the `onCursor` doc comment ("by the chart, a key or ◀ ▶") only if wording
     needs it.
2. **`src/style.css`** (`#profile .profile-side button`, ~line 902): add
   `user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
   touch-action: none;` and extend the section comment: holding one repeats, so it
   must not select its glyph or open the Copy callout.
3. Save this plan as `docs/plans/2026-09-22-11-hold-the-profile-arrows.md`
   (plan-docs convention).

## Verification

1. `npm run build` passes.
2. `npm run dev`, scratchpad playwright script (as in earlier plans) with a trail
   selected and the profile open:
   - Click ▶ once: cursor advances 1.
   - `mouse.down()` on ▶, wait 3 s, `mouse.up()`: cursor advanced by hundreds; after
     release it stops changing.
   - Hold ◀ from near the start: stops at point 0, button disabled, no runaway timer.
   - Touch emulation (`hasTouch`, long press via CDP touch events): no selection
     (`getSelection().toString() === ''`), cursor keeps advancing.
   - Focus ▶ and press Enter: steps exactly 1.
3. Commit with the plan doc.
