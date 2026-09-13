# Call 국가지점번호 "National Point Number"

## Context

The code identifiers already speak English (`NationalPoint`, `decodeNationalPoint`,
`loadNationalPoints`, `national_points_w_name.tsv`), but the panel label, README and
code comments still said 국가지점번호. The source now uses the English name, National
Point Number.

Left alone on purpose (same precedent as `2026-09-13-08-generic-point-layer-wording.md`):
- `docs/plans/2026-09-13-0[1-8]*.md` — dated history.
- `data/national_points_w_name.tsv` — the data itself.
- 지점번호, 사물유형, 이름 — the TSV's column names, not the term being renamed.

## Change

1. **`index.html`** — the points checkbox reads `Show National Point Numbers` (not
   "National Point Number points"). The hint `Emergency location markers.` is unchanged.
2. **`README.md`** — the feature bullet says `National Point Number emergency-location
   points`.
3. **`src/nationalPoint.ts`** — the header reads `National Point Number → WGS84.`; the
   `(Korean national point number)` gloss went with the Korean term it explained.
4. **Comments** — `The National Point Number layer/pins` in `src/points.ts`,
   `src/main.ts`, `src/style.css`, `src/trails.ts` and `src/ui.ts`.

## Verification

1. `git grep -n 국가지점번호 -- src index.html README.md` — no output.
2. `npm run build` — typecheck and build pass.
3. `npm run dev`, open the panel: the checkbox reads "Show National Point Numbers";
   toggling it still draws the pins and popups open.
