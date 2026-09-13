# Name the 과천 and 안양 동안구 국가지점번호

## Context

The 국가지점번호 layer (`2026-09-13-01-national-point-markers.md`) put a pin on every row of
`data/national_points_w_name.tsv`, but only 100 of the 338 rows carry an 이름 — and those 100
all came from one source, `national_point_numbers_gwanak.csv`, which covers the 관악구 K/G
signs. Every sign on the 과천 side of 관악산 and the 안양 동안구 flank is unnamed, so its popup
leads with a bare `다사53873790` and its hover `title` is the same code.

That is exactly the half of the mountain where a name matters: 깔딱고개, 연주암, 마당바위,
the 국기봉 on 팔봉능선 are the words a hiker says to a dispatcher, and the popup is built to
lead with the name when there is one (`points.ts:73-78`). The names for 44 of these signs
are now in hand. This change fills them in.

It is a data change only. `parseNationalPoints` (`nationalPoint.ts:156`) already reads an
optional sixth column, trims it and NFC-folds it, and a row that gains a name needs nothing
from the code.

## Change

1. **Fill column 6 (이름) for 44 rows of `data/national_points_w_name.tsv`**, matched by
   지점번호. Columns 1–5 (순번, 시/도, 시/군/구, 지점번호, 사물유형) stay byte-identical, so
   no pin moves and no row appears or disappears.

   | 시/군/구 | Rows named | Examples |
   |---|---|---|
   | 과천시 | 33 (all 위치안내(표시)판) | 관악산입구, 깔딱고개, 연주암, 마당바위, 육봉 국기봉, 용마골삼거리 |
   | 안양시 동안구 | 10 | 불성사 방향 갈림길, 팔봉능선, 제1국기봉, 구 국기봉 / 팔봉 제2국기봉 |
   | 관악구 | 1 | 다사53544086 → `G4 관음사 국기봉 아래`, the gap in the G1–G6 run |

   Named rows go from 100 to 144.

2. **Disambiguate repeated place names with a numeric suffix**, not by dropping one:
   `깔딱고개` / `깔딱고개2`, `연주암` / `연주암2`, `봉계곡길` / `봉계곡길2`, `헬기장2`.
   Two different signs a few hundred metres apart on the same landmark should not produce
   two identical popups — the suffix is what lets someone reading a code back over the phone
   tell them apart.

3. **Store the names clean**: no trailing spaces (the working copy of `불성사 밑` arrived
   with one), tabs only as separators, LF line endings. The parser would trim anyway, but the
   file is the source of truth and diffs of it should show only real edits.

4. **Leave the other ~194 rows unnamed** — the 전신주, 사방댐, and the 과천/동안 signs whose
   names are not known. An empty 이름 is handled (`points.ts:73-75`); a guessed one is worse
   than none on a rescue sign.

## Files

| File | Change |
|---|---|
| `data/national_points_w_name.tsv` | 44 rows gain an 이름; nothing else changes |

## Verification

1. Only the name column changed:
   `diff <(git show HEAD:data/national_points_w_name.tsv | cut -f1-5) <(cut -f1-5 data/national_points_w_name.tsv)`
   prints nothing.
2. Row shape: `awk -F'\t' '{print NF}' data/national_points_w_name.tsv | sort | uniq -c`
   shows only 5- and 6-field rows (194 and 145, header included); still 339 lines.
3. Named count: `awk -F'\t' 'NR>1 && $6!=""' data/national_points_w_name.tsv | wc -l` → 144.
4. No stray whitespace or CR: `grep -nP '[ \t]$|\r' data/national_points_w_name.tsv` prints
   nothing.
5. No two rows share a name: `awk -F'\t' 'NR>1&&$6!=""{print $6}' … | sort | uniq -d` prints
   nothing.
6. `npm run build` passes (the TSV is imported `?raw`, so this confirms it still bundles).
7. `npm run preview`, zoom to 과천 관악산 and click:
   - 다사53873790 → popup leads with **깔딱고개**, then the code and 위치안내(표시)판.
   - 다사52373742 → **구 국기봉 / 팔봉 제2국기봉** (the `/` renders as text).
   - 다사53544086 on the 관악구 side → **G4 관음사 국기봉 아래**.
   - A still-unnamed 과천 sign (e.g. 다사52603852) → code leads, no blank bold line.
8. Export an SVG over 연주암 and check the pin `<title>` carries `연주암` alongside the code.

## Follow-up

- The remaining unnamed 과천 / 동안구 위치안내판 (e.g. 다사52603852, 다사53673634) and every
  안양 만안구 / 금천구 row are left for when names exist for them. When they arrive, apply the
  same rule: match by 지점번호, suffix repeats, never guess.
- `backup/national_point_numbers_gwanak.csv` covers only the original 100 names. If the
  merged file is ever regenerated from sources, these 44 need a source file of their own or
  they will be lost.
