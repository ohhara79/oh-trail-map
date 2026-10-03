# Name G35–G41 관악산 signs, 군부대헬기장(하) and 기상관측소

## Context

Around G36 자운암(상) in the 관악구 block of the file, six 국가지점번호판 rows are still grey,
and one 과천시 위치안내판 below 연주암 is too. Their names are now in hand — the G35 and
G38–G41 signs on the 자운암–돌탑계곡 slope, the unnumbered post below the army helipad, and the
과천 board at the weather station — so the G35–G41 run carries names end to end.

This is a data change only. `parseNationalPoints` (`src/nationalPoint.ts`) already reads the
optional 이름 column; a named row gets the amber pin, sorts above unnamed neighbours and leads
its popup with the name (`src/points.ts`) — no code change.

## Change

1. **Append column 5 (이름) to seven rows**, matched by 지점번호. Columns 1–4 stay
   byte-identical, so no pin moves and no row appears or disappears.

   | 시/군/구 | 지점번호 | 사물유형 | 이름 |
   |---|---|---|---|
   | 관악구 | 다사52263858 | 국가지점번호판(전용지주) | G41 평안의 터 |
   | 관악구 | 다사52503858 | 국가지점번호판(전용지주) | 군부대헬기장(하) |
   | 관악구 | 다사52183869 | 국가지점번호판(전용지주) | G35 파도바위 |
   | 관악구 | 다사52183861 | 국가지점번호판(전용지주) | G39 돌탑계곡 |
   | 관악구 | 다사51843873 | 국가지점번호판(전용지주) | G38 침묵의 얼굴 아래 |
   | 관악구 | 다사52273869 | 국가지점번호판(전용지주) | G40 동굴 |
   | 과천시 | 다사52603852 | 위치안내(표시)판 | 기상관측소 |

   Named rows go from 226 to 233; unnamed rows from 55 to 48.

2. **Keep the 관악구 form**: the sign's G number, a space, then the place as the sign writes
   it. 다사52503858 carries no G number, so it gets the place alone with its `(하)` qualifier,
   as the sign reads — don't invent a number for it.

3. **Keep the 과천시 form**: 위치안내판 names are the bare place, like its neighbours
   연주암 and 연주암헬기장, so 다사52603852 is just `기상관측소`.

4. **Leave rows where they lie.** G40 sits apart from the others near the end of the 관악구
   block, as in the original export; nothing reads the file in order, so sorting would only add
   noise to the diff.

5. **Store the names clean**: one tab before the name, no trailing whitespace, LF endings.

6. **Leave the remaining 48 rows unnamed** — 16 in 관악구, 15 in 과천시, 15 in 만안구, 2 in
   동안구. A guessed name is worse than none on a rescue sign.

## Files

| File | Change |
|---|---|
| `data/national_points_w_name.tsv` | 7 rows gain an 이름; nothing else changes |

## Verification

1. Only the name column changed:
   `diff <(git show HEAD:data/national_points_w_name.tsv | cut -f1-4) <(cut -f1-4 data/national_points_w_name.tsv)`
   prints nothing.
2. Row shape: `awk -F'\t' '{print NF}' data/national_points_w_name.tsv | sort | uniq -c`
   → 48 four-field and 234 five-field rows (header included); still 282 lines.
3. Named count: `awk -F'\t' 'NR>1 && $5!=""' data/national_points_w_name.tsv | wc -l` → 233.
4. No stray whitespace or CR: `grep -nP '[ \t]$|\r' data/national_points_w_name.tsv` prints
   nothing.
5. No duplicate name within a 시/군/구:
   `awk -F'\t' 'NR>1&&$5!=""{print $2"|"$5}' data/national_points_w_name.tsv | sort | uniq -d`
   prints nothing.
6. `npm run build` passes.
7. `npm run preview`, then on the map:
   - 다사52183869 is an amber pin reading **G35 파도바위**, near G36 자운암(상).
   - G38–G41 sit together on the slope west of G36; 다사52503858 reads **군부대헬기장(하)**.
   - 다사52603852 in 과천 reads **기상관측소**, between 연주암 and 연주암헬기장.
   - A still-unnamed 관악구 neighbour stays grey with the code leading.

## Follow-up

- G37 is still missing from the file's names; if it turns out to be one of the 16 unnamed
  관악구 rows, name it the same way — match by 지점번호, keep the 구's form, never guess.
- `backup/national_point_numbers_gwanak.csv` does not carry these names either; update it too
  if the merged file is ever regenerated from sources.
