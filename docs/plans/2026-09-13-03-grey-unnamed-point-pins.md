# Grey out the unnamed 국가지점번호 pins

## Context

Every 국가지점번호 pin was the same amber (`PIN_COLOR = '#b45309'`, `points.ts`), so on the
map the 144 signs with an 이름 (K1 호암생활관, 깔딱고개, 연주암 …) looked exactly like the
193 bare 전신주, 사방댐 and unnamed signs until each one was clicked. A name is what marks a
sign a hiker would say to a dispatcher, so it should be visible before the click.

Scheme: **named pins keep the amber `#b45309`; unnamed pins turn slate grey `#64748b`**, so
the landmarks stand out and the rest recede. Grey is outside trails.ts `PALETTE` and far from
the `--accent` blue location dot. `NationalPoint.name` is already parsed (empty string when
absent, `nationalPoint.ts:181`), so this is rendering only — no data change.

## Change

1. **`src/points.ts` — colour per point, one source of truth.**
   - `PIN_COLOR` becomes `PIN_COLOR_NAMED` / `PIN_COLOR_UNNAMED`, read through
     `pinColor(point)`.
   - `namedLast(points)` returns unnamed first, named last, so renderers that paint in array
     order put named pins on top where they overlap along the ridge.
   - `createPointsLayer` builds the icon SVG once per colour, with the colour inline on the
     `<svg>`; the body already fills `currentColor`.
   - Named markers get `zIndexOffset: 1000` (the map's equivalent of `namedLast`), and every
     marker gets `riseOffset: 2000` so hovering a grey pin still lifts it above an amber
     neighbour — Leaflet's default rise of 250 would not clear the 1000 gap.
2. **`src/style.css`** — `.point-pin` no longer sets `color`; it comes from points.ts, so CSS
   and TS cannot drift.
3. **`src/export.ts`** — `pins = namedLast(points)`; the PNG `fillStyle` and SVG `fill` read
   `pinColor` per pin.
4. **`README.md`** — the feature line says what the two colours mean.

## Files

| File | Change |
|---|---|
| `src/points.ts` | two colours, `pinColor`, `namedLast`, per-colour icon html, z-order |
| `src/style.css` | remove the hard-coded pin colour |
| `src/export.ts` | per-pin fill in PNG and SVG, named drawn last |
| `README.md` | mention the colour meaning |

## Verification

1. `npm run build` passes.
2. `grep -rn 'PIN_COLOR\b\|b45309' src` finds only `PIN_COLOR_NAMED` in points.ts.
3. Headless Chrome on a bare Leaflet map with the real layer: 337 pins, 144 with
   `color: #b45309` and 193 with `#64748b`; `pinColor` gives amber for 다사52414090
   (K1 호암생활관) and grey for 다사52603852; `namedLast` puts every named point after every
   unnamed one; the screenshot shows amber over grey where they overlap.
4. Still wants a real browser: `npm run preview`, hover a grey pin tucked under an amber one
   and check it rises; click pins for popups and a trail under a pin for selection; export an
   SVG and check named `<g>` elements carry `fill="#b45309"` and come after the grey ones.
