# Match the 3D button's label to the locate icon's size

## Context

`#view3d` and `#locate` already share one 34px box (`src/style.css:202`), so the
difference is the glyph inside. The locate icon is a 20px SVG (`index.html:51`) whose
solid part — the ring — is about 12px across (outer radius 7.4 of 24 units), with thin
tick marks reaching ~17.5px. The 3D label is bold 12px text (`src/style.css:273`),
roughly 16px wide, a solid block that reads visibly larger than the ring. The user wants
them to look the same size.

## Change

1. **`src/style.css:273`** — in `#view3d`, lower `font-size: 12px` to `10px` (keep
   `font-weight: 700` and `letter-spacing: .02em`). At 10px "3D" is ~13px wide, which
   lines up with the locate ring's ~12px and sits inside the crosshair's span. If the
   screenshot check below still shows it larger or clearly smaller, adjust by 0.5–1px.
   No other rules change; the `on` / `loading` / `unavailable` states inherit the size.
2. **Plan doc** — save this plan as `docs/plans/2026-09-15-03-3d-button-label-size.md`.

## Verification

- `npm run build` passes.
- Run `npm run dev`, open the app, and compare the top-right 3D button with the
  bottom-right locate button (desktop and a ~400px mobile viewport): the "3D" glyph
  should appear about the same size as the locate ring/crosshair. Toggle 3D on to check
  the white-on-accent state still reads clearly.
