# Preview the national point that `;` `'` step onto

## Context

With a trail selected, `;` `'` move the profile cursor from one of the trail's national point pins to the next. Only the cursor dot moved and the readout named the point, so the map didn't show which pin you were on. Now that pin gets the same preview a mouse hover gives: its ring, and its name beside it. The preview lasts only while the cursor stays on that pin. Scrubbing, `,` `.`, deselecting or stepping again moves it or clears it. The map still doesn't fly.

## Change

1. `src/profilePanel.ts`: `stepPass` returns the pass it moved to, or null.
2. `src/main.ts`: `stepPoint` keeps that pass as `steppedPass`. `steppedPoint()` returns its point only while the cursor is still on it and the point isn't hidden. The preview comes from the cursor, so whatever moves the cursor ends it, and nothing has to clear it. `syncHover()` shows it when the mouse picks nothing. It rings the pin with `setHovered` and shows the hover label beside the pin while the pin is on screen. A map `move` keeps the label on the pin. `applySteppedPoint()` runs from `applyCursor()` and from `syncPoints()`, and hands the point to 3D.
3. `src/view3d.ts`: `setSteppedPoint`. When the mouse picks nothing, orbit's `syncHover` rings that dot and labels it. The label is repositioned after each frame drawn. Walk and playback keep `syncNearby` as they are.
4. `README.md` describes the preview.

## Verification

1. `npm run build` passes.
2. Select a trail and press `'`. The first pin is ringed and named. Each later `'` / `;` moves both.
3. Scrub the profile, press `,` `.` or press Esc, and the preview disappears.
4. Pan or zoom the map, and the label stays on the pin. With the pin off screen, no label shows.
5. With no trail selected, mouse hover and `;` `'` work as before.
6. In 3D orbit, `'` rings the dot and names it. In walk mode and during playback, nothing changes.
