# Name the last 만안구 signs and the 삼막로 사방댐

## Context

After the 육봉 / KTR / 안양 pass, 11 rows are still grey: the 관악구 사방댐 at 다사52334083
and 10 in 안양시 만안구. Five of the 만안구 rows are the 사방댐 strung along the 삼막로
계곡 below 삼성산; the rest are three 위치안내(표시)판 on the 삼성산 ridge and two
국가지점번호판 near the 석수동 / 호압사 갈림길 on the 금천구 boundary.

Naming these leaves no grey pin on the map.

This is a data change only. `parseNationalPoints` (`src/nationalPoint.ts`) already reads the
optional 이름 column; a named row gets the amber pin, sorts above unnamed neighbours and leads
its popup with the name (`src/points.ts`) — no code change.

## Change

1. **Append column 5 (이름) to the eleven remaining rows**, matched by 지점번호. Columns 1–4
   stay byte-identical, so no pin moves and no row appears or disappears.

   | 지점번호 | 시/군/구 | 사물유형 | 이름 |
   |---|---|---|---|
   | 다사52334083 | 관악구 | 사방댐 | (서울대 연구공원 사방댐) |
   | 다사49003772 | 안양시 만안구 | 사방댐 | (삼막로 사방댐 1) |
   | 다사49013778 | 안양시 만안구 | 사방댐 | (삼막로 사방댐 2) |
   | 다사49133779 | 안양시 만안구 | 사방댐 | (삼막로 사방댐 3) |
   | 다사49373790 | 안양시 만안구 | 사방댐 | (삼막로 사방댐 4) |
   | 다사49583804 | 안양시 만안구 | 사방댐 | (삼막로 사방댐 5) |
   | 다사49263872 | 안양시 만안구 | 국가지점번호판(전용지주) | (석수동 갈림길 아래) |
   | 다사49293899 | 안양시 만안구 | 국가지점번호판(전용지주) | (호압사 갈림길) |
   | 다사49533703 | 안양시 만안구 | 위치안내(표시)판 | 학우봉 우회로 |
   | 다사49173671 | 안양시 만안구 | 위치안내(표시)판 | 제1~2전망대 사이 |
   | 다사50583737 | 안양시 만안구 | 위치안내(표시)판 | 통신기지부근 |

   Named rows go from 270 to 281; unnamed rows from 11 to 0.

2. **Number the 삼막로 사방댐 1–5 from the valley mouth upstream** (west to east by
   easting: 49003772 → 49013778 → 49133779 → 49373790 → 49583804). The dams carry no sign
   of their own, so a stable ordinal is the only way to tell them apart in a popup.

3. **Parenthesise names that are not on a sign.** All six 사방댐 and the two
   국가지점번호판 near the 갈림길 are described by the landmark beside them, following
   `(수영장 사방댐)` and `(안양수목원 사방댐)`. Names read off a physical sign stay bare.

4. **Name 다사49293899 on the 만안구 side as `(호압사 갈림길)`.** The same 지점번호 already
   appears as `호압사 갈림길` under 금천구; the post stands on the boundary, so the 만안구
   row reuses the name in parentheses rather than inventing a second one. Likewise
   `(석수동 갈림길 아래)` points at the named 석수동 갈림길 sign just above it.

5. **Keep the `~` form for between-points**: `제1~2전망대 사이`, like `망월암~소공원`.

6. **Write sign names as the signs write them** — `통신기지부근` unspaced, `학우봉 우회로`
   spaced.

7. **Leave rows where they lie.** Nothing reads the file in order; sorting would only add
   noise to the diff.

8. **Store the names clean**: one tab before the name, no trailing whitespace, LF endings.

## Files

| File | Change |
|---|---|
| `data/national_points_w_name.tsv` | 11 rows gain an 이름 |

## Verification

1. Only the name column changed:
   `diff <(git show HEAD:data/national_points_w_name.tsv | cut -f1-4) <(cut -f1-4 data/national_points_w_name.tsv)`
   prints nothing.
2. Row shape: `awk -F'\t' '{print NF}' data/national_points_w_name.tsv | sort | uniq -c`
   → 282 five-field rows (header included); no four-field rows left; still 282 lines.
3. Named count: `awk -F'\t' 'NR>1 && $5!=""' data/national_points_w_name.tsv | wc -l` → 281.
4. No stray whitespace or CR: `grep -nP '[ \t]$|\r' data/national_points_w_name.tsv` prints
   nothing.
5. No duplicate name within a 시/군/구:
   `awk -F'\t' 'NR>1&&$5!=""{print $2"|"$5}' data/national_points_w_name.tsv | sort | uniq -d`
   prints nothing.
6. `npm run build` passes.
7. `npm run preview`, then on the map:
   - No grey pin is left anywhere.
   - Walking up the 삼막로 계곡, the five 사방댐 read (삼막로 사방댐 1) → … → (삼막로 사방댐 5).
   - (석수동 갈림길 아래) sits just below 석수동 갈림길, and (호압사 갈림길) overlaps the
     금천구 호압사 갈림길 pin.
   - 다사52334083 reads **(서울대 연구공원 사방댐)**.

## Follow-up

- 다사49293899 is listed under both 금천구 and 만안구. If the boundary row is ever deduplicated,
  keep the bare 금천구 name and drop the parenthesised one.
- If any 사방댐 turns out to carry a plate with its own name, replace the ordinal with it and
  drop the parentheses.
- `backup/` does not carry these names either; update it too if the merged file is ever
  regenerated from sources.
