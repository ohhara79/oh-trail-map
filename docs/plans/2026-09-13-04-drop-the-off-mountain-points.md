
# Drop the 국가지점번호 that are not on 관악산 / 삼성산

## Context

`data/national_points_w_name.tsv` has 338 rows, and the 국가지점번호 layer
(`2026-09-13-01-national-point-markers.md`) puts a pin on every one. Two kinds of row in it do
not belong on a map of 관악산 / 삼성산 trails:

- **Things that are not trail signs.** 12 사방댐 (관악구 2, 과천 4, 안양 만안구 6) and 8 과천
  전신주. They carry a 지점번호 because a plate is bolted to them, but they sit in stream beds
  and along roads, nobody on a ridge is looking for them, and none has an 이름. Now that
  unnamed pins are grey (`2026-09-13-03-grey-unnamed-point-pins.md`), they are exactly the grey
  clutter that crowds the amber landmarks.
- **Signs on other hills.** 26 과천 signs past 다사56xx on the east side of 과천, and 19 안양
  만안구 signs down at 다사46–49 / 29–31, 5–9 km south of the 관악산 ridge. They are real
  signs, but on terrain none of the trails here reach, and they are what stretches the point
  set's box to 13 × 13 km. None has an 이름 either.

Taking both out leaves the signs a hiker on these trails can actually walk to, and the box
shrinks to about 7 × 6 km (grid x 4769–5447, y 3602–4190) — the mountain itself. Every named
row stays, so no popup anyone has already seen changes.

It is a data change only. `parseNationalPoints` (`src/nationalPoint.ts:156`) and the layer
(`src/points.ts`) read whatever rows are there; fewer rows need nothing from the code.

## Change

1. **Delete 65 rows from `data/national_points_w_name.tsv`**, matched by 지점번호. Every other
   row stays byte-identical — no edits, no reordering, no renumbering of 순번.

   | 시/군/구 | Rows removed | What |
   |---|---|---|
   | 관악구 | 2 | 사방댐 (다사52334083, 다사51773956) |
   | 과천시 | 38 | 4 사방댐, 8 전신주, 15 위치안내(표시)판 and 11 국가지점번호판(전용지주) east of 다사56 |
   | 안양시 만안구 | 25 | 6 사방댐, 19 signs south of 다사4x3200 (incl. the lone 국가지점번호판 다사49023168) |

   Rows go from 338 to 273; pins from 337 to 272 (다사49293899 is still filed twice and still
   deduplicated). Named rows stay at 144.

2. **Keep the other small 사물유형 as they are** — 2 가로등, 2 기타, 5 약수터(우물), 9 정자.
   They stand on the trails themselves; a 약수터 or 정자 is a place people stop and can name.

3. **Don't renumber 순번.** The gaps (관악구 72 and 1, 과천 17–37 and 80–87 …) keep each row
   traceable to the source export it came from; the parser ignores 순번 beyond skipping the
   header.

## Files

| File | Change |
|---|---|
| `data/national_points_w_name.tsv` | 65 unnamed rows removed; nothing else changes |

## Verification

1. Deletions only: `git diff --numstat data/national_points_w_name.tsv` → `0	65`.
2. Row shape: `wc -l` → 274 (273 rows + header);
   `awk -F'\t' '{print NF}' data/national_points_w_name.tsv | sort | uniq -c` → 129 five-field
   and 145 six-field rows.
3. Named count unchanged: `awk -F'\t' 'NR>1 && $6!=""' data/national_points_w_name.tsv | wc -l` → 144.
4. No 사방댐 or 전신주 left: `grep -cE $'\t(사방댐|전신주)' data/national_points_w_name.tsv` → 0.
5. Box is the mountain:
   `LC_ALL=C awk -F'\t' 'NR>1{x=substr($4,7,4)+0;y=substr($4,11,4)+0; if(!n++){a=b=x;c=d=y} if(x<a)a=x;if(x>b)b=x;if(y<c)c=y;if(y>d)d=y} END{print a,b,c,d}' data/national_points_w_name.tsv`
   → `4769 5447 3602 4190`.
6. `npm run build` passes (the TSV is imported `?raw`).
7. `npm run preview`:
   - 272 pins; zoomed out, they cover 관악산 / 삼성산 and nothing to the south or east of 과천.
   - No pin at 다사49013778 (the 만안구 사방댐) or 다사56523543 (a 과천 전신주).
   - 다사53873790 still opens **깔딱고개**; 다사52414090 still opens **K1 호암생활관**.
   - Export an SVG and count the pin `<g>` elements: 272.

## Follow-up

- Counts quoted in prose go stale with this change and are left for a separate edit:
  `README.md:25` (337 points), `src/points.ts:93` (238 of 338 unnamed → 129 of 273),
  `src/points.ts:153` and `:168` (337 → 272), and `src/points.ts:30` ("nine" 사물유형 → six).
- `src/nationalPoint.ts:22` confirms the grid origin with 다사49013778, the 안양 만안구 사방댐.
  The decode is still correct, but that point is no longer in the file; swap it for a kept
  point when the comment is next touched.
- `backup/national_points.tsv` and `backup/national_point_numbers_gwanak.csv` still hold the
  full set. If the merged file is ever regenerated from them, re-apply this filter (drop
  사방댐 / 전신주 and anything outside the box above) or the 65 rows come back.
