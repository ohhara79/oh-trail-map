# Tap a pin on the profile to jump onto its point

## Context

The user wants a quick way onto a national point on the elevation profile. Snapping
the drag (commit 880deaf) was taken out again (plan 08) because it stole precise
placement near pins. Long-pressing the arrows was weighed and dropped: holding an
arrow already auto-repeats the step, and phones have no arrow keys. Chosen: a
**tap right on a pin** puts the cursor on that pin's GPX point; a drag stays free,
and the arrows, ◀ ▶, Shift and PageUp/PageDown are unchanged.

## Behaviour

- Pointer down within a pin's hit radius (2D distance to the drawn circle's centre,
  8 px mouse / 14 px touch-pen), nearest pin wins → the cursor goes to that pin's
  `index` (the first pass of the visit, same one `drawPoints` draws).
- Down anywhere else → scrubs exactly as today.
- After a pin press, the cursor stays put until the pointer has moved more than
  `TAP_SLOP_PX` (5 px) horizontally from where it went down; from then on the drag
  follows the pointer freely, as today. So finger jitter doesn't knock it off the pin,
  and a press-and-drag that starts on a pin still scrubs.
- Escape hatch for a GPX point right next to a pin: press away from the line at that
  x (above or below it — 2D distance means that misses the pin), or step with ◀ ▶ / arrows.
- Hidden points have no drawn pin, so they aren't hit.

## Change

1. **`src/profilePanel.ts`**
   - Constants beside `PASS_RADIUS`: `PIN_HIT_PX_MOUSE = 8`, `PIN_HIT_PX_TOUCH = 14`,
     `TAP_SLOP_PX = 5`, with a short comment in the file's voice.
   - `private pins: { index: number; x: number; y: number }[] = []` — filled in
     `drawPoints()` alongside each circle it appends (cleared at the top with
     `replaceChildren()`), so hits match exactly what is drawn.
   - `private pinAt(x: number, y: number, pointerType: string): number | null` —
     nearest pin within the radius, returning its GPX `index`. The SVG's viewBox is the
     chart's pixel size (`draw()`), so `clientX - rect.left` / `clientY - rect.top`
     are already in pin coordinates.
   - `private heldPinX: number | null = null` — the clientX a pin press started at.
   - `pointerdown`: after setting `dragging` / capture, `const pin = this.pinAt(...)`;
     if found, `heldPinX = e.clientX` and `if (pin !== this.cursor) this.cb.onCursor(pin)`;
     else `heldPinX = null` and `scrubTo(e.clientX)`. Update its comment.
   - `pointermove`: when dragging, if `heldPinX !== null && Math.abs(e.clientX - heldPinX) <= TAP_SLOP_PX`
     return; otherwise `heldPinX = null` and `scrubTo(e.clientX)`.
   - `release`: also clear `heldPinX`.
   - File header doc: add a clause that a tap on a pin puts the cursor on its point.
2. **`README.md`** (~lines 54–61): "Hover or drag" → "Drag" (stale since plan 07),
   and add that tapping a pin puts the cursor on its point.
3. **`src/style.css`** ~857: the pins' comment says they "take no pointer, so the
   chart scrubs over them" — still true (hit-testing is done by the chart), keep it;
   optionally note the chart hit-tests them.
4. Save this plan as `docs/plans/2026-09-22-10-tap-a-pin-to-jump.md` (plan-docs convention).

## Verification

1. `npm run build` passes.
2. `npm run dev`, scratchpad playwright script (as in plans 04/08) on
   `ohhara_10959058.gpx` with the profile open:
   - Click a few px off a pin's centre: cursor is on the pin's index, readout names the point.
   - Click ~20 px above the line at the pin's x: cursor on the GPX point under the
     pointer (no jump).
   - Press on a pin and drag 3 px: stays on the pin; drag 30 px: follows the pointer.
   - Touch emulation (`hasTouch`, `pointerType: 'touch'`): the larger radius applies.
   - Arrows / ◀ ▶ still step one point.
3. Commit with the plan doc.
