# Round National Point markers in 2D, matching 3D

## Context

The National Point Number markers look different in the two views. 2D (`src/points.ts`)
draws an 18x24 teardrop pin with a white hole, anchored at its tip; 3D (`src/scene3d.ts:205`)
draws a MapLibre `circle` layer — radius 5, amber/grey fill, 1.5px white stroke. The user
wants one look in both, and a circle is fine. So 2D switches to the circle; 3D keeps its
circle but reads its size from the same constants, so the two cannot drift again.

## Change

1. **`src/points.ts` — the divIcon becomes a circle.**
   - Replace `PIN_PATH`, `PIN_SIZE`, `PIN_ANCHOR`, `PIN_HOLE`, `POPUP_ANCHOR` with exported
     `PIN_RADIUS = 5` and `PIN_STROKE = 1.5` (the 3D values), plus a derived icon box:
     MapLibre draws `circle-stroke-width` wholly *outside* `circle-radius`, so the outer edge
     is at 6.5px. In SVG the stroke straddles the edge, so the `<circle>` gets `r=5`,
     `stroke-width=3` and the existing `paint-order: stroke` — the fill covers the inner half,
     leaving exactly 1.5px of white outside, same as 3D. Box 14x14, centre (7, 7),
     `iconAnchor` [7, 7] (centre, not tip — the point is now at the middle of the marker),
     `popupAnchor` [0, -7].
   - `iconHtml` emits one `<circle class="point-pin-body" …/>`; drop the hole.
   - Update the doc comment above the constants. Keep colours, pane, `zIndexOffset`,
     `riseOnHover`/`riseOffset`, `keyboard: false`, `title` and the popup untouched.
2. **`src/scene3d.ts:211`** — import `PIN_RADIUS`, `PIN_STROKE` and use them for
   `circle-radius` / `circle-stroke-width` instead of the literals `5` / `1.5`.
3. **`src/style.css:291-321`** — the `.point-pin-body` stroke width moves to the SVG
   attribute (so points.ts owns the size) or becomes `3`; delete `.point-pin-hole` from the
   pointer-events rule and its `fill` rule. Keep the "only the ink takes the click" rule — a
   circle in a square still leaves empty corners. Reword the comments that mention the
   18x24 pin.
4. **`README.md:26`** — "drawn as pins" → "drawn as circles".
5. **Plan doc** — save this plan as `docs/plans/2026-09-15-01-round-point-markers.md`.

## Files

| File | Change |
|---|---|
| `src/points.ts` | circle icon, exported `PIN_RADIUS` / `PIN_STROKE`, centre anchor |
| `src/scene3d.ts` | 3D circle layer reads the shared constants |
| `src/style.css` | drop hole rules, stroke width, comments |
| `README.md` | "pins" → "circles" |
| `docs/plans/2026-09-15-01-round-point-markers.md` | this plan |

## Verification

1. `npm run build` passes (type-check + bundle).
2. `grep -rn 'PIN_PATH\|PIN_HOLE\|point-pin-hole' src` finds nothing.
3. `npm run preview` (or dev), with Show National Point Numbers on:
   - 2D: markers are amber/grey dots with a white ring, centred on the location (zoom in
     and out — they must not shift the way a tip-anchored pin would); named dots sit over
     grey ones; hovering a grey dot under an amber one raises it; clicking a dot opens its
     popup just above it; clicking a trail next to a dot still selects the trail.
   - Switch to 3D at the same spot: the dots look the same size and colour as in 2D, and
     clicking one opens the same popup.
