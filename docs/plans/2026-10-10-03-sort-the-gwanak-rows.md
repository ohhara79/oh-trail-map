# Sort the 관악구 rows

## Context

The 관악구 block of `data/national_points_w_name.tsv` (lines 2–171) grew in the order the
signs were named, not in the order they are numbered. The K and M signs are already in
sequence, but the G signs jump around — `G8` sits ahead of `G1`, `G15` before `G13`,
`G9`–`G12` run backwards, `G70` is wedged between `G20` and `G7`, `G21`–`G23` and
`G26`–`G28` trail behind `G34`, `G40` is stranded at the end of the block — and the two
사방댐 are split up, one ahead of the G series and one at the very end.

That makes the file hard to check by eye: to find a G sign, or to see that none is missing,
you have to scan the whole block. Now that every 관악구 row has a name, put the block in
sign order.

This is a reorder only. No row is added, removed or edited, and every other 시/군/구 stays
where it is.

## Change

1. **Keep the three sign series in their existing order:** the 위치안내(표시)판 `K1`–`K84`,
   then the 국가지점번호판 `M1`–`M14`, then the 국가지점번호판 `G` series.

2. **Put the G series in plain number order, `G1` → `G70`.** `G70 파이프 능선(상)` goes
   last, after `G69`, like any other number — not next to the signs it stands among on the
   ridge. Rows that move:

   | Row | Was | Now |
   |---|---|---|
   | G8 | ahead of G1 | after G7 |
   | G7 선유천 헬기장 | after G70 | after G6 |
   | G9–G12 | after G14, reversed | after G8, ascending |
   | G13, G14 | after G15 | after G12 |
   | G15 자라바위(철조망) | after G6 | after G14 |
   | G21–G23 암반계곡 갈림길 | after G28, reversed | after G20, ascending |
   | G25 수영장능선 입구 | before G24 | after G24 |
   | G26–G28 중앙계곡 | after G30 | after G25 |
   | G30, G31 | after G34, reversed | after G29, ascending |
   | G35–G41 | G41, G37, G36, G35, G39, G38 … G40 at the end | G35 → G41 |
   | G47, G48 | reversed | ascending |
   | G52–G54 | G54, G53, G52 | ascending |
   | G58, G59 | reversed | ascending |
   | G62, G63 | after G65, reversed | after G61, ascending |
   | G67 노고리약수터 사거리 | after G69 | after G66 |
   | G70 파이프 능선(상) | between G20 and G7 | after G69 |

3. **Gather the 사방댐 at the end of the block:** `[서울대 연구공원 사방댐]` moves down from
   ahead of the G series to sit just before `[수영장 사방댐]`, after `G70`.

4. **Leave every row byte-identical** — only line order changes. Keep the file clean: one tab
   between columns, no trailing whitespace, LF endings.

## Files

| File | Change |
|---|---|
| `data/national_points_w_name.tsv` | 관악구 rows (lines 2–171) reordered: K, M, G by number, then 사방댐 |

## Verification

1. Same rows, only reordered:
   `diff <(git show HEAD:data/national_points_w_name.tsv | sort) <(sort data/national_points_w_name.tsv)`
   prints nothing; still 282 lines.
2. Nothing outside 관악구 moved:
   `diff <(git show HEAD:data/national_points_w_name.tsv | awk -F'\t' '$2!="관악구"') <(awk -F'\t' '$2!="관악구"' data/national_points_w_name.tsv)`
   prints nothing.
3. 관악구 is still one block at lines 2–171:
   `awk -F'\t' '$2=="관악구"{print NR}' data/national_points_w_name.tsv | sed -n '1p;$p'`
   → `2`, `171`.
4. The sign order reads K1…K84, M1…M14, G1…G70, then the two 사방댐:
   `awk -F'\t' '$2=="관악구"{print $5}' data/national_points_w_name.tsv | cut -d' ' -f1 | paste -sd' '`.
5. No stray whitespace or CR: `grep -nP '[ \t]$|\r' data/national_points_w_name.tsv` prints
   nothing.
6. `npm run build` passes.
7. `npm run preview`, then on the map every 관악구 pin is where it was, with the same name.

## Follow-up

- The other 시/군/구 blocks (금천구, 과천시, 안양시) could get the same treatment.
