# Name G14 and G15 관악산 signs

## Context

Among the 관악구 국가지점번호판 in the G4–G13 block of the file, two rows are still grey:
다사53494022, just above G13 벙커지대, and 다사53644014, just below it. Their names are now in
hand — G15 자라바위(철조망) and G14 사방댐 — so the G10–G15 signs all carry names.

This is a data change only. `parseNationalPoints` (`src/nationalPoint.ts`) already reads the
optional 이름 column; a named row gets the amber pin, sorts above unnamed neighbours and leads
its popup with the name (`src/points.ts`) — no code change.

## Change

1. **Append column 5 (이름) to two rows**, matched by 지점번호. Columns 1–4 stay
   byte-identical, so no pin moves and no row appears or disappears.

   | 시/군/구 | 지점번호 | 사물유형 | 이름 |
   |---|---|---|---|
   | 관악구 | 다사53494022 | 국가지점번호판(전용지주) | G15 자라바위(철조망) |
   | 관악구 | 다사53644014 | 국가지점번호판(전용지주) | G14 사방댐 |

   Named rows go from 224 to 226; unnamed rows from 57 to 55.

2. **Keep the 관악구 form**: the sign's G number, a space, then the place as the sign writes
   it — including the `(철조망)` qualifier on G15, as with `G56 관우약수터(상)`.

3. **Leave rows where they lie.** G15 sits before G13 and G14 after it, as in the original
   export; nothing reads the file in order, so sorting would only add noise to the diff.

4. **Accept G14 사방댐 beside G12 사방댐 계곡** and the unnamed rows whose 사물유형 is
   `사방댐` (e.g. 다사52334083). G14 is the sign at the dam, G12 the one down its valley, and
   the 사방댐 rows are the dams themselves; the G prefix and `계곡` keep the names distinct.

5. **Store the names clean**: one tab before the name, no trailing whitespace, LF endings.

6. **Leave the remaining 55 rows unnamed** — 22 in 관악구, 16 in 과천시, 15 in 만안구, 2 in
   동안구. A guessed name is worse than none on a rescue sign.

## Files

| File | Change |
|---|---|
| `data/national_points_w_name.tsv` | 2 rows gain an 이름; nothing else changes |

## Verification

1. Only the name column changed:
   `diff <(git show HEAD:data/national_points_w_name.tsv | cut -f1-4) <(cut -f1-4 data/national_points_w_name.tsv)`
   prints nothing.
2. Row shape: `awk -F'\t' '{print NF}' data/national_points_w_name.tsv | sort | uniq -c`
   → 55 four-field and 227 five-field rows (header included); still 282 lines.
3. Named count: `awk -F'\t' 'NR>1 && $5!=""' data/national_points_w_name.tsv | wc -l` → 226.
4. No stray whitespace or CR: `grep -nP '[ \t]$|\r' data/national_points_w_name.tsv` prints
   nothing.
5. No duplicate name within a 시/군/구:
   `awk -F'\t' 'NR>1&&$5!=""{print $2"|"$5}' data/national_points_w_name.tsv | sort | uniq -d`
   prints nothing.
6. `npm run build` passes.
7. `npm run preview`, then on the map:
   - 다사53494022 is an amber pin reading **G15 자라바위(철조망)**, just above G13 벙커지대.
   - 다사53644014 → **G14 사방댐**, between G13 벙커지대 and G12 사방댐 계곡.
   - The national point list shows these two as named rows.
   - A still-unnamed 관악구 neighbour stays grey with the code leading.

## Follow-up

- The other 55 unnamed rows wait until their names are known; fill them the same way — match
  by 지점번호, keep the 구's form, never guess.
- `backup/national_point_numbers_gwanak.csv` does not carry these names either; update it too
  if the merged file is ever regenerated from sources.
