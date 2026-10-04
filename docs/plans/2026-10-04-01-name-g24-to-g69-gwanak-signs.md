# Name G24–G34 and G63–G69 관악산 signs, G37 and 수영장 사방댐

## Context

Most of the 관악구 block in `data/national_points_w_name.tsv` is named now, but thirteen
국가지점번호판 rows are still grey — on the 수영장능선, around 자운암, up the 중앙계곡, on the
학바위능선 and across the 삼거리–전암–용암천 side — and so is the 수영장 사방댐. Their names are
now in hand, so the 관악구 signs read as a near-continuous G run instead of a patchwork.

G37 also turns out to be the unnumbered post below the army helipad (다사52503858), which the
last pass left as plain `군부대헬기장(하)` rather than invent a number. That number can now go on.

This is a data change only. `parseNationalPoints` (`src/nationalPoint.ts`) already reads the
optional 이름 column; a named row gets the amber pin, sorts above unnamed neighbours and leads
its popup with the name (`src/points.ts`) — no code change.

## Change

1. **Append column 5 (이름) to fourteen rows**, matched by 지점번호. Columns 1–4 stay
   byte-identical, so no pin moves and no row appears or disappears.

   | 지점번호 | 사물유형 | 이름 |
   |---|---|---|
   | 다사52043953 | 국가지점번호판(전용지주) | G24 수영장능선 끝 |
   | 다사52023947 | 국가지점번호판(전용지주) | G25 수영장능선 입구 |
   | 다사52053938 | 국가지점번호판(전용지주) | G26 중앙계곡 초입 |
   | 다사52383898 | 국가지점번호판(전용지주) | G27 중앙계곡(중) |
   | 다사52523875 | 국가지점번호판(전용지주) | G28 중앙계곡(상) |
   | 다사51753919 | 국가지점번호판(전용지주) | G33 자운암 사잇길 |
   | 다사51833919 | 국가지점번호판(전용지주) | G34 자운암장 아래 |
   | 다사51413789 | 국가지점번호판(전용지주) | G51 학바위능선 가는길 |
   | 다사50233901 | 국가지점번호판(전용지주) | G63 전암 암장 |
   | 다사50193887 | 국가지점번호판(전용지주) | G65 삼거리 윗터 |
   | 다사50373936 | 국가지점번호판(전용지주) | G67 노고리약수터 사거리 |
   | 다사50353956 | 국가지점번호판(전용지주) | G68 용암천 아래 삼거리 |
   | 다사50423954 | 국가지점번호판(전용지주) | G69 유정약수 지름길 |
   | 다사51773956 | 사방댐 | (수영장 사방댐) |

   All are 관악구. Named rows go from 233 to 247; unnamed rows from 48 to 34.

2. **Number G37**: 다사52503858 changes from `군부대헬기장(하)` to `G37 군부대헬기장(하)`.
   The place part stays as the sign writes it, including the `(하)` qualifier.

3. **Keep the 관악구 sign form**: the sign's G number, a space, then the place as the sign
   writes it, with `(중)`/`(상)` qualifiers unspaced, like G22 암반계곡 갈림길(중).

4. **Parenthesise the 사방댐 name.** The dam carries no sign of its own, so its name is a
   description, not a label — wrap it in parentheses as with `(독산자연공원)` and
   `(봉계곡길2)`, so it doesn't read as an official name.

5. **Leave rows where they lie.** Nothing reads the file in order; sorting would only add
   noise to the diff.

6. **Store the names clean**: one tab before the name, no trailing whitespace, LF endings.

7. **Leave the remaining 34 rows unnamed** — 2 in 관악구 (다사50583839 and the 사방댐 at
   다사52334083), 15 in 과천시, 15 in 만안구, 2 in 동안구. A guessed name is worse than none
   on a rescue sign.

## Files

| File | Change |
|---|---|
| `data/national_points_w_name.tsv` | 14 rows gain an 이름, 1 row's 이름 gains its G number |

## Verification

1. Only the name column changed:
   `diff <(git show HEAD:data/national_points_w_name.tsv | cut -f1-4) <(cut -f1-4 data/national_points_w_name.tsv)`
   prints nothing.
2. Row shape: `awk -F'\t' '{print NF}' data/national_points_w_name.tsv | sort | uniq -c`
   → 34 four-field and 248 five-field rows (header included); still 282 lines.
3. Named count: `awk -F'\t' 'NR>1 && $5!=""' data/national_points_w_name.tsv | wc -l` → 247.
4. No stray whitespace or CR: `grep -nP '[ \t]$|\r' data/national_points_w_name.tsv` prints
   nothing.
5. No duplicate name within a 시/군/구:
   `awk -F'\t' 'NR>1&&$5!=""{print $2"|"$5}' data/national_points_w_name.tsv | sort | uniq -d`
   prints nothing.
6. `npm run build` passes.
7. `npm run preview`, then on the map:
   - 다사52503858 reads **G37 군부대헬기장(하)**, next to G36 자운암(상).
   - G24/G25 sit on the 수영장능선 near G29; G26–G28 climb the 중앙계곡.
   - G63/G65 and G67–G69 fill the west side around G62 and G66.
   - 다사51773956 is an amber pin reading **(수영장 사방댐)**.
   - 다사50583839 stays grey with the code leading.

## Follow-up

- 다사50583839 is the last unnamed 관악구 sign; once its name is known, name it the same way.
- `backup/national_point_numbers_gwanak.csv` does not carry these names either; update it too
  if the merged file is ever regenerated from sources.
