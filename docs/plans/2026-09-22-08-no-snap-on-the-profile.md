# Stop the profile cursor snapping onto national point pins

## Context

Commit 880deaf made a drag on the elevation profile snap the cursor onto a
national point's pin when within 6 px (mouse) / 12 px (touch). In practice it
stops the user from placing the cursor on the exact GPX points near a pin. The
user wants the snap gone: a drag follows the pointer freely. Pins and the
point-name readout (commits 3d5c10b, 1c45820) stay.

## Change

1. **`src/profilePanel.ts`**
   - Delete `SNAP_PX_MOUSE` / `SNAP_PX_TOUCH` and their doc comment (~lines 30–33).
   - `scrubTo(clientX)`: drop the `pointerType` parameter and the pass loop;
     back to `const index = indexAtDistance(profile, t * profile.total);`.
     Replace its doc comment with a one-liner ("The cursor to where the pointer
     is along the chart.").
   - `pointerdown` / `pointermove` handlers (~lines 94, 97): call
     `this.scrubTo(e.clientX)`.
   - Leave `this.passes` / `hiddenPoints` alone — drawing pins and the readout
     still use them (confirm with grep that nothing else was snap-only).
2. **`README.md`** (~line 60): remove "Dragging near a pin snaps the cursor onto
   it; the keys and ◀ ▶ still step one GPX point at a time." Keep the rest of the
   sentence flow intact.
3. Save this plan as `docs/plans/2026-09-22-08-no-snap-on-the-profile.md`.

## Verification

1. `npm run build` passes (no unused-variable errors).
2. With `npm run dev`, adapt the scratchpad playwright script on
   `ohhara_10959058.gpx` with the profile open:
   - Drag to a few px beside a pin: the cursor lands on the GPX point under the
     pointer, not on the pin.
   - Drag exactly onto a pin: the readout still names the point.
3. Commit with the plan doc.
