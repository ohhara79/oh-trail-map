# Step through the selected trail's national points with `;` `'`

## Context

With a trail selected, you want to jump between the national points it passes without scrubbing the profile. Until now `;` `'` stepped through the panel's National Points list, which flies the map away from the trail. Now, when a trail is on the profile, `;` `'` step through that trail's own pins, in the order the trail passes them. They move only the profile cursor, as `,` `.` do: the 2D and 3D dots move and the readout names the point, with no fly and no popup. With no trail selected, they step through the list as before.

## Change

1. `src/profilePanel.ts`: `stepPass(delta)` finds the pins that `drawPoints` draws from the passes, leaving out hidden points and a repeat of the point just before it. It then moves the cursor through `onCursor` to the first pin past the cursor in the direction given. With no cursor, it goes to the first or last pin. It stops at the ends, as `step()` does. It reads the passes, not `this.pins`, because `this.pins` stays empty while the panel is put away.
2. `src/main.ts`: `stepPoint` calls `stepPass` whenever `cursorTrail` is set (the playing trail, else the selected one). While a trail plays, the step is a seek. If a trail has no pin that way, nothing happens; the key doesn't fall back to the list.
3. `src/shortcuts.ts`, `index.html` (the `?` sheet) and `README.md` describe the new behaviour.

## Verification

1. `npm run build` passes.
2. Select a trail that passes several national points. `'` puts the cursor on the first pin, and each press after that goes to the next pin in trail order, stopping at the last. `;` goes back. The readout names each point.
3. Hide one of those points in the list, and stepping skips it.
4. On an out-and-back trail, each pass of the same point is visited.
5. During 3D playback, `'` seeks to the next pin.
6. After Esc clears the selection, `;` `'` step through the list, flying to each point and opening its popup, as before.
