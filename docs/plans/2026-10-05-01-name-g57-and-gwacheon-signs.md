# Name G57, the 과천 철탑 ridge signs, 관악산 정상 and 팔봉분기점

## Context

The last pass left 다사50583839 as the only unnumbered 관악구 sign; its name is now known —
G57 제3말바위(하), between G56 관우약수터(상) and G58/G59 at 거북바위. Naming it closes the
관악구 국가지점번호판 run.

On the 과천 side, the 위치안내(표시)판 along the 철탑 ridge read as a patchwork: 철탑 삼거리,
다섯번째 철탑, 두꺼비바위 and 여섯번째철탑 are named, but the posts below them — the second,
third and fourth 철탑, the 암릉 between them and 새바위 — are still grey. The 과천 post at the
summit (다사52603855) is unnamed too, which is the one sign most people will look for. In
동안구, the post where the 팔봉능선 leaves the 봉계곡길 (다사51873738) sits between two named
neighbours.

This is a data change only. `parseNationalPoints` (`src/nationalPoint.ts`) already reads the
optional 이름 column; a named row gets the amber pin, sorts above unnamed neighbours and leads
its popup with the name (`src/points.ts`) — no code change.

## Change

1. **Append column 5 (이름) to eight rows**, matched by 지점번호. Columns 1–4 stay
   byte-identical, so no pin moves and no row appears or disappears.

   | 지점번호 | 시/군/구 | 사물유형 | 이름 |
   |---|---|---|---|
   | 다사50583839 | 관악구 | 국가지점번호판(전용지주) | G57 제3말바위(하) |
   | 다사54163732 | 과천시 | 위치안내(표시)판 | 두번째철탑 |
   | 다사53743761 | 과천시 | 위치안내(표시)판 | 세번째철탑 |
   | 다사53613767 | 과천시 | 위치안내(표시)판 | 암릉길중간 |
   | 다사53433773 | 과천시 | 위치안내(표시)판 | 네번째철탑 |
   | 다사53133794 | 과천시 | 위치안내(표시)판 | 새바위 |
   | 다사52603855 | 과천시 | 위치안내(표시)판 | 관악산 정상 |
   | 다사51873738 | 안양시 동안구 | 국가지점번호판(전용지주) | 팔봉분기점 |

   Named rows go from 247 to 255; unnamed rows from 34 to 26.

2. **Keep the 관악구 sign form** for G57: the G number, a space, then the place as the sign
   writes it, with the `(하)` qualifier unspaced, like G56 관우약수터(상).

3. **Write the 과천 철탑 names unspaced** — `두번째철탑`, `세번째철탑`, `네번째철탑` — as the
   signs write them, matching the existing `여섯번째철탑`. Leave `다섯번째 철탑` as it is;
   respelling an already-named row is out of scope.

4. **No parentheses on these names.** Every one is written on a physical sign, unlike
   `(봉계곡길2)` or the 사방댐 descriptions.

5. **Leave rows where they lie.** Nothing reads the file in order; sorting would only add
   noise to the diff.

6. **Store the names clean**: one tab before the name, no trailing whitespace, LF endings.

7. **Leave the remaining 26 rows unnamed** — the 관악구 사방댐 at 다사52334083, 9 in 과천시,
   15 in 만안구, 1 in 동안구. A guessed name is worse than none on a rescue sign.

## Files

| File | Change |
|---|---|
| `data/national_points_w_name.tsv` | 8 rows gain an 이름 |

## Verification

1. Only the name column changed:
   `diff <(git show HEAD:data/national_points_w_name.tsv | cut -f1-4) <(cut -f1-4 data/national_points_w_name.tsv)`
   prints nothing.
2. Row shape: `awk -F'\t' '{print NF}' data/national_points_w_name.tsv | sort | uniq -c`
   → 26 four-field and 256 five-field rows (header included); still 282 lines.
3. Named count: `awk -F'\t' 'NR>1 && $5!=""' data/national_points_w_name.tsv | wc -l` → 255.
4. No stray whitespace or CR: `grep -nP '[ \t]$|\r' data/national_points_w_name.tsv` prints
   nothing.
5. No duplicate name within a 시/군/구:
   `awk -F'\t' 'NR>1&&$5!=""{print $2"|"$5}' data/national_points_w_name.tsv | sort | uniq -d`
   prints nothing.
6. `npm run build` passes.
7. `npm run preview`, then on the map:
   - 다사50583839 is an amber pin reading **G57 제3말바위(하)**, between G56 and G58/G59.
   - The 과천 ridge reads 두번째철탑 → 세번째철탑 → 암릉길중간 → 네번째철탑 → 철탑 삼거리 →
     다섯번째 철탑 → 새바위 → 두꺼비바위 → 여섯번째철탑 without a grey gap.
   - 다사52603855 reads **관악산 정상**.
   - 다사51873738 reads **팔봉분기점**, between 봉계곡길 and 팔봉능선.

## Follow-up

- `다섯번째 철탑` is the only spaced 철탑 name; respell it to `다섯번째철탑` if the sign turns
  out to be written unspaced.
- With G57 named, the 관악구 국가지점번호판 are complete; the only unnamed 관악구 row left is
  the 사방댐 at 다사52334083.
- `backup/national_point_numbers_gwanak.csv` does not carry these names either; update it too
  if the merged file is ever regenerated from sources.
