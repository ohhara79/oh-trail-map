# Name nine more 관악구 K/G signs

## Context

The 관악구 위치안내(표시)판 run K45–K71 and the 국가지점번호판(전용지주) run G52–G59 in
`data/national_points_w_name.tsv` still have holes: K48, K49, K50, K52, K66, K67, K69, G55
and G56 carry only a code. Their neighbours are named (K47 거북바위, K51 용천수, K68 제2광장,
G54 평지사거리 위 암반, G59 거북바위 삼거리), so on the map these nine read as grey pins with a
bare `다사50343809` in the middle of an otherwise amber, named ridge — on 국기봉 and the 팔봉
viewpoint, exactly where a hiker is most likely to call one in.

The names for these nine signs are now in hand. This is a data change only:
`parseNationalPoints` (`src/nationalPoint.ts:167`) already reads the optional 이름 column,
trims and NFC-folds it; a row that gains a name gets the amber pin (`src/points.ts:136`),
leads its popup with the name (`src/points.ts:157`) and carries it in the hover/SVG title
(`src/points.ts:127`) with no code change.

## Change

1. **Append column 5 (이름) to nine 관악구 rows**, matched by 지점번호. Columns 1–4
   (시/도, 시/군/구, 지점번호, 사물유형) stay byte-identical, so no pin moves and no row
   appears or disappears.

   | 지점번호 | 사물유형 | 이름 |
   |---|---|---|
   | 다사50343809 | 위치안내(표시)판 | K48 국기봉 |
   | 다사50503829 | 위치안내(표시)판 | K49 암벽 |
   | 다사50553823 | 위치안내(표시)판 | K50 제5팔봉전망대 |
   | 다사50573835 | 위치안내(표시)판 | K52 제3말바위 |
   | 다사50603968 | 위치안내(표시)판 | K66 유정약수터 |
   | 다사50783956 | 위치안내(표시)판 | K67 장수교 |
   | 다사50693981 | 위치안내(표시)판 | K69 성주암(위) |
   | 다사51023879 | 국가지점번호판(전용지주) | G55 수중동산 |
   | 다사50803868 | 국가지점번호판(전용지주) | G56 관우약수터(상) |

   Named rows go from 144 to 153.

2. **Keep the house naming form**: the sign's own K/G number, a space, then the place —
   the same shape as the existing 관악구 names (`K47 거북바위`, `G52 삼거리계곡(상)`).
   Parenthesised qualifiers such as `(위)` and `(상)` are kept as written on the sign.

3. **Store the names clean**: a single tab before the name, no trailing whitespace, LF line
   endings, so the diff shows only the nine real edits.

4. **Leave the remaining gaps unnamed** (K53, K54, K65, K70, G57, G58 and the rest) — an empty
   이름 is handled; a guessed one is worse than none on a rescue sign.

## Files

| File | Change |
|---|---|
| `data/national_points_w_name.tsv` | 9 관악구 rows gain an 이름; nothing else changes |

## Verification

1. Only the name column changed:
   `diff <(git show HEAD:data/national_points_w_name.tsv | cut -f1-4) <(cut -f1-4 data/national_points_w_name.tsv)`
   prints nothing.
2. Row shape: `awk -F'\t' '{print NF}' data/national_points_w_name.tsv | sort | uniq -c`
   → 120 four-field and 154 five-field rows (header included); still 274 lines.
3. Named count: `awk -F'\t' 'NR>1 && $5!=""' data/national_points_w_name.tsv | wc -l` → 153.
4. No stray whitespace or CR: `grep -nP '[ \t]$|\r' data/national_points_w_name.tsv` prints
   nothing.
5. No duplicate names: `awk -F'\t' 'NR>1&&$5!=""{print $5}' data/national_points_w_name.tsv | sort | uniq -d`
   prints nothing.
6. `npm run build` passes (the TSV is imported `?raw`, so this confirms it still bundles).
7. `npm run preview`, zoom to 관악산's 팔봉능선 / 국기봉 area and check:
   - 다사50343809 is now an amber pin whose popup leads with **K48 국기봉**.
   - 다사50553823 → **K50 제5팔봉전망대**; 다사50693981 → **K69 성주암(위)**.
   - 다사51023879 → **G55 수중동산**.
   - The national point list shows these nine as named rows.
   - A still-unnamed neighbour (e.g. 다사50713875) stays grey with the code leading.

## Follow-up

- K53, K54, K65, K70, G57, G58 and the other unnamed 관악구 signs wait until their names are
  known; fill them the same way — match by 지점번호, keep the K/G prefix, never guess.
- `backup/national_point_numbers_gwanak.csv` does not include these nine names. If the merged
  file is ever regenerated from sources, update that source too or they will be lost.
