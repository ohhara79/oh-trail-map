# Drop 순번 from the national points TSV

## Context

`data/national_points_w_name.tsv` arrived from its source export with a leading 순번 column.
Nothing ever read it as data: it restarts at 1 per 시/군/구, so it is useless as a key, and
the app's only use for it was a heuristic — `parseNationalPoints` skipped the header row by
noticing that its first cell was not a number. The column has now been deleted from the file.

`cut -f2-` of the old file is byte-identical to the new one, so only column 1 went: no
reordering, no renumbering, no line-ending change. 274 lines = 1 header + 273 data rows, and
a row is now 4 or 5 cells (129 without an 이름, 145 with) instead of 5 or 6. The columns are
`시/도 · 시/군/구 · 지점번호 · 사물유형 · 이름`.

The whole blast radius is one function. 시/도 and 시/군/구 were never read either, and
everything downstream — `points.ts`, `main.ts`, `view3d.ts`, `scene3d.ts` — sees only the
parsed `NationalPoint` record (`code`, `kind`, `name`, `lat`, `lon`), which has no field for
the deleted column and needed no change.

## Change

### `src/nationalPoint.ts` — `parseNationalPoints`

1. Field indices shift down one: `code = fields[2]`, `kind = fields[3]`, `name = fields[4]`.
2. The arity guard goes `fields.length < 5` → `< 4`. It means the same thing it always did —
   "the row reaches 사물유형" — and without the change every one of the 129 rows that stop
   there would have been dropped.
3. **The header check is deleted, not ported.** `if (!/^\d+$/.test(fields[0].trim()))` could
   not survive the column: 시/도 is non-numeric on every row, so it would have rejected the
   entire file. Nothing replaces it, because nothing has to — the header's 지점번호 cell is
   the literal text `지점번호`, `CODE_PATTERN` does not match it, and the existing
   `if (!at) continue;` after `decodeNationalPoint` already drops the row. That guard sits
   before `seen.add(code)`, so the header never reaches the dedup set either. The comment
   moves onto the decode to say so, and the property the old comment claimed still holds: a
   file exported without a header parses just the same.

Untouched on purpose: the CRLF and blank-line tolerance, the NFC fold on 이름, and the
first-row-wins dedup — `다사49293899` is still in the file twice, still one sign on the
금천구 / 안양시 만안구 boundary filed under each.

### `src/points.ts` — a stale count, riding along

The popup comment said the name line is omitted "for the 238 of 338 rows that have no name".
Both numbers have been wrong since the off-mountain drop (it is 129 of 273 now), and they were
wrong before this change, not because of it. They are gone rather than corrected, the same
call `2026-09-13-08` made for the counts in the README.

### Earlier plan docs

`2026-09-13-01`, `-02` and `-04` describe the six-column layout and tell you not to renumber
순번. They stay as they are: dated history of what the file was when they were written.

## Verification

1. `npm run build` — `tsc --noEmit` and `vite build` both pass.
2. **Old parser on the old file vs new parser on the new file, compared directly.** Both were
   bundled with esbuild and run under Node; `JSON.stringify(a) === JSON.stringify(b)` is
   `true`. 272 points either way — 273 rows less the one duplicate — 144 named, 128 not.
3. The parsed set on its own: first point `다사52414090 / 위치안내(표시)판 / K1 호암생활관(위)`
   at 37.46609, 126.96184; no point whose `code` is `지점번호` or whose `kind` is `사물유형`;
   6 distinct 사물유형; extent lat 37.4221–37.4749, lon 126.9087–126.9854, which is the
   13 km box and not a multiple of 100 km away from it.
4. `npm run dev`, points layer on: pins draw across the extent in 2D and 3D, clicking one
   shows 지점번호 / 사물유형, and the bold name line appears only on the named points.
