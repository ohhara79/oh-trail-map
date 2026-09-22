# Keys to step through trails and national points

## Context

There was no way to go through the trails, or the national points, one after another without clicking each row in the panel. Two key pairs now step through them:

- `[` and `]`: previous and next trail.
- `;` and `'`: previous and next national point.

None of these keys was used before, and they sit next to `,` and `.`, which already step along the profile.

Each step does what clicking the neighbouring row does:

- **Trail:** it is selected and framed.
- **Point:** its popup opens, zoomed in on it in 2D or via `showPoint` in 3D.

Stepping follows the list's current filter and order, skips rows whose checkbox is off, and wraps around at either end. From nothing selected, forward starts at the first row and back at the last.

## Change

1. **`src/ui.ts`: `renderedIds()`.** Made public. It already read the trail ids back off the rows for the master checkbox.
2. **`src/pointsList.ts`: `renderedCodes()`.** Made public, for the same reason: it already read the 지점번호 back off the rows, in list order.
3. **`src/shortcuts.ts`.** Added the `stepTrail` and `stepPoint` callbacks, mapped from `BracketLeft`/`BracketRight` and `Semicolon`/`Quote` (`e.code`). Like every other jump key, a held repeat is ignored.
4. **`src/main.ts`.**
   - Added the `stepIn(ids, current, delta)` helper.
   - `stepTrail` runs `selectTrail` then `zoomToTrail`, as a row click does.
   - The points list's `onSelect` body is lifted into `goToPoint(code)`, so the row and `stepPoint` share one path.
5. **`index.html` and `README.md`.** Both shortcut lists name the new keys.

## Verification

1. `npm run build`: typecheck and bundle pass.
2. In 2D:
   - `]` from nothing selected selects and frames the first visible trail. Pressing it again moves on and wraps at the end, and `[` goes back.
   - Trails with their checkbox off are skipped, and a filter narrows the steps to its matches.
   - `'` and `;` open the next and previous point popups and scroll their rows into view. Hidden points are skipped.
3. The same keys work in 3D orbit.
4. While a filter box has focus, the keys type characters instead of stepping.
