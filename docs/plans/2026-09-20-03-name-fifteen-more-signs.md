# Name fifteen more 관악산 signs

## Context

`2026-09-19-01` closed nine holes in the 관악구 K45–K71 and G52–G59 runs, and left the rest
waiting on names. Fifteen of those are now in hand, and they sit where the map most needs
them. Twelve are 관악구 위치안내(표시)판: K46 on the 제2삼거리 shoulder, K60 and K62 on the
삼성산 side, and the unbroken K72–K84 stretch over 돌산, the 활터, the 야영장 and the four
약수터 above 호압사 — the whole 호암산 end of the ridge, which until now drew as a line of grey
pins reading `다사49253940`. One is the 국가지점번호판 G58 by 거북바위. Two are across the
city line in 안양시 만안구, at 깔딱고개 and 찬우물 on the 안양 approach.

This is a data change only. `parseNationalPoints` (`src/nationalPoint.ts:167`) already reads
the optional 이름 column, trims it and folds it to NFC; a row that gains a name gets the amber
pin (`src/points.ts:136`), sorts above its unnamed neighbours (`src/points.ts:289`), leads its
popup with the name (`src/points.ts:157`) and carries it in the hover label
(`src/points.ts:127`) — no code change.

## Change

1. **Append column 5 (이름) to fifteen rows**, matched by 지점번호. Columns 1–4 (시/도,
   시/군/구, 지점번호, 사물유형) stay byte-identical, so no pin moves and no row appears or
   disappears.

   | 시/군/구 | 지점번호 | 사물유형 | 이름 |
   |---|---|---|---|
   | 관악구 | 다사50863802 | 위치안내(표시)판 | K46 제2삼거리(상) |
   | 관악구 | 다사50153877 | 위치안내(표시)판 | K60 삼거리(상) |
   | 관악구 | 다사49823873 | 위치안내(표시)판 | K62 생수천 |
   | 관악구 | 다사50624028 | 위치안내(표시)판 | K72 돌산 |
   | 관악구 | 다사49883994 | 위치안내(표시)판 | K74 활터 |
   | 관악구 | 다사49663897 | 위치안내(표시)판 | K78 제1야영장 |
   | 관악구 | 다사49583876 | 위치안내(표시)판 | K79 찬우물 |
   | 관악구 | 다사49483915 | 위치안내(표시)판 | K80 민주동산 |
   | 관악구 | 다사49253940 | 위치안내(표시)판 | K81 호압사 |
   | 관악구 | 다사49193986 | 위치안내(표시)판 | K82 만년약수 |
   | 관악구 | 다사49583976 | 위치안내(표시)판 | K83 삼호약수터 |
   | 관악구 | 다사49653926 | 위치안내(표시)판 | K84 송암약수터 |
   | 관악구 | 다사50263794 | 국가지점번호판(전용지주) | G58 거북바위 사잇길 |
   | 안양시 만안구 | 다사50253816 | 위치안내(표시)판 | 깔딱고개 |
   | 안양시 만안구 | 다사49543882 | 국가지점번호판(전용지주) | 찬우물 |

   Named rows go from 153 to 168; unnamed rows from 120 to 105.

2. **Keep each 시/군/구's own naming form.** The thirteen 관악구 rows take the house shape —
   the sign's own K/G number, a space, then the place, with the sign's parenthesised
   qualifiers (`(상)`) kept as written. The two 만안구 rows take a bare place name, because
   those signs carry no K/G number and the file's other 경기도 rows (과천시 `깔딱고개`, 동안구
   `제2국기봉`) are already named that way. The prefix rule is a 관악구 rule, not a global one.

3. **Leave G58 where it lies in the file.** Its row sits after G59, out of numeric order, as
   it has since the original export. Sorting it would be a second, unrelated change in the
   same diff, and nothing reads the file in order — `parseNationalPoints` dedupes by 지점번호
   and the list sorts on its own.

4. **Accept the two names that repeat.** 깔딱고개 is now on both a 과천시 sign
   (다사53873790, the 연주암 approach) and a 만안구 one (다사50253816, the 안양 approach);
   `찬우물` and `K79 찬우물` are two different signs either side of the same spring. They are
   distinct places that hikers call the same thing, and renaming one to disambiguate would put
   a name on a sign that the sign does not carry. Uniqueness is therefore checked per 시/군/구,
   not across the file — `2026-09-19-01`'s global check is superseded.

5. **Store the names clean**: a single tab before the name, no trailing whitespace, LF line
   endings, so the diff shows only the fifteen real edits.

6. **Leave the remaining 105 rows unnamed** — 45 in 관악구 (including K63, K65, K68, K70, K77
   and the 금천구-bound G runs), 30 in 금천구, 16 in 과천시, 12 in 만안구, 2 in 동안구. An
   absent 이름 is handled everywhere; a guessed one is worse than none on a rescue sign.

## Files

| File | Change |
|---|---|
| `data/national_points_w_name.tsv` | 15 rows gain an 이름; nothing else changes |

## Verification

1. Only the name column changed:
   `diff <(git show HEAD:data/national_points_w_name.tsv | cut -f1-4) <(cut -f1-4 data/national_points_w_name.tsv)`
   prints nothing.
2. Row shape: `awk -F'\t' '{print NF}' data/national_points_w_name.tsv | sort | uniq -c`
   → 105 four-field and 169 five-field rows (header included); still 274 lines.
3. Named count: `awk -F'\t' 'NR>1 && $5!=""' data/national_points_w_name.tsv | wc -l` → 168.
4. No stray whitespace or CR: `grep -nP '[ \t]$|\r' data/national_points_w_name.tsv` prints
   nothing.
5. No duplicate name within a 시/군/구:
   `awk -F'\t' 'NR>1&&$5!=""{print $2"|"$5}' data/national_points_w_name.tsv | sort | uniq -d`
   prints nothing. The same query without `$2` prints `깔딱고개` and nothing else — the one
   accepted cross-구 repeat.
6. `npm run build` passes (the TSV is imported `?raw`, so this confirms it still bundles).
7. `npm run preview`, then check on the map:
   - 호암산: 다사49253940 is an amber pin whose popup leads with **K81 호압사**, and its
     neighbours run **K78 제1야영장 … K84 송암약수터** with no grey pin between them.
   - 다사50863802 → **K46 제2삼거리(상)**; 다사50263794 → **G58 거북바위 사잇길**, beside the
     already-named G59 거북바위 삼거리.
   - 안양 side: 다사50253816 → **깔딱고개**, 다사49543882 → **찬우물**, both amber and with no
     K/G prefix, like their 과천시 neighbours.
   - The national point list shows these fifteen as named rows.
   - A still-unnamed neighbour (e.g. 다사49863942, K77) stays grey with the code leading.

## Follow-up

- K63, K65, K68, K70, K77, G57 and the other 105 unnamed signs wait until their names are
  known; fill them the same way — match by 지점번호, keep the 구's naming form, never guess.
- `backup/national_point_numbers_gwanak.csv` does not carry these fifteen names either. If the
  merged file is ever regenerated from sources, update that source too or they will be lost.
