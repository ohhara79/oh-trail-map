# Name nine more 관악산 signs

## Context

`2026-09-20-03` left K53, K54, K63, K65, K70 and K77 grey among otherwise named 관악구
위치안내(표시)판, and several G signs around 제1깔딱고개 unnamed. Nine of those names are now
in hand. Five are K signs: K53 and K54 between K52 제3말바위 and K55 제2깔딱고개, K63 and K65
between K62 생수천 and K66 유정약수터, and K70 and K77 — the last gaps in the K66–K84 run
toward 호암산. Four are 국가지점번호판: G61, G64 and G66 fill in the 제1깔딱고개 and 돌탑정원
stretch beside the already-named G60 and G62.

This is a data change only. `parseNationalPoints` (`src/nationalPoint.ts`) already reads the
optional 이름 column; a named row gets the amber pin, sorts above unnamed neighbours and leads
its popup with the name (`src/points.ts`) — no code change.

## Change

1. **Append column 5 (이름) to nine rows**, matched by 지점번호. Columns 1–4 stay
   byte-identical, so no pin moves and no row appears or disappears.

   | 시/군/구 | 지점번호 | 사물유형 | 이름 |
   |---|---|---|---|
   | 관악구 | 다사50713875 | 위치안내(표시)판 | K53 관우약수터 |
   | 관악구 | 다사50593877 | 위치안내(표시)판 | K54 도사바위 |
   | 관악구 | 다사50063932 | 위치안내(표시)판 | K63 곰바위 |
   | 관악구 | 다사50383922 | 위치안내(표시)판 | K65 노고리약수터 |
   | 관악구 | 다사50333976 | 위치안내(표시)판 | K70 무궁화동산 |
   | 관악구 | 다사49863942 | 위치안내(표시)판 | K77 제2야영장 |
   | 관악구 | 다사50363823 | 국가지점번호판(전용지주) | G61 49암장 사잇길 |
   | 관악구 | 다사50343828 | 국가지점번호판(전용지주) | G64 제1깔딱고개 암반 위 |
   | 관악구 | 다사50173913 | 국가지점번호판(전용지주) | G66 돌탑정원 아래 |

   Named rows go from 168 to 177; unnamed rows from 105 to 96.

2. **Keep the 관악구 form**: the sign's K/G number, a space, then the place as the sign
   writes it.

3. **Leave rows where they lie.** G64 sits before G62 and G66 after it, as in the original
   export; nothing reads the file in order, so sorting would only add noise to the diff.

4. **Accept K53 관우약수터 beside G56 관우약수터(상).** They are two signs at the same spring,
   and the K/G prefix and `(상)` already keep the names distinct.

5. **Store the names clean**: one tab before the name, no trailing whitespace, LF endings.

6. **Leave the remaining 96 rows unnamed** — 36 in 관악구, 30 in 금천구, 16 in 과천시, 12 in
   만안구, 2 in 동안구. A guessed name is worse than none on a rescue sign.

## Files

| File | Change |
|---|---|
| `data/national_points_w_name.tsv` | 9 rows gain an 이름; nothing else changes |

## Verification

1. Only the name column changed:
   `diff <(git show HEAD:data/national_points_w_name.tsv | cut -f1-4) <(cut -f1-4 data/national_points_w_name.tsv)`
   prints nothing.
2. Row shape: `awk -F'\t' '{print NF}' data/national_points_w_name.tsv | sort | uniq -c`
   → 96 four-field and 178 five-field rows (header included); still 274 lines.
3. Named count: `awk -F'\t' 'NR>1 && $5!=""' data/national_points_w_name.tsv | wc -l` → 177.
4. No stray whitespace or CR: `grep -nP '[ \t]$|\r' data/national_points_w_name.tsv` prints
   nothing.
5. No duplicate name within a 시/군/구:
   `awk -F'\t' 'NR>1&&$5!=""{print $2"|"$5}' data/national_points_w_name.tsv | sort | uniq -d`
   prints nothing.
6. `npm run build` passes.
7. `npm run preview`, then on the map:
   - 다사49863942 is an amber pin reading **K77 제2야영장**, and K66–K84 run with no grey pin
     between them.
   - 다사50713875 → **K53 관우약수터**, 다사50593877 → **K54 도사바위**, between K52 and K55.
   - 다사50363823 → **G61 49암장 사잇길**, next to G60 제1깔딱고개 사거리.
   - The national point list shows these nine as named rows.
   - A still-unnamed neighbour (e.g. 다사50193887) stays grey with the code leading.

## Follow-up

- The other 96 unnamed rows wait until their names are known; fill them the same way — match
  by 지점번호, keep the 구's form, never guess.
- `backup/national_point_numbers_gwanak.csv` does not carry these names either; update it too
  if the merged file is ever regenerated from sources.
