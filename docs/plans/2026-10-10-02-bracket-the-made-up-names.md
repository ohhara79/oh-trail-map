# Bracket the made-up names

## Context

Every row in `data/national_points_w_name.tsv` now has an 이름. Most are read off a physical
sign; 17 are names we made up from the landmark beside the post — the 사방댐, a few
국가지점번호판 without a plate of their own, and signs whose face is unreadable. Those were
marked by wrapping the whole name in parentheses: `(수영장 사방댐)`.

Parentheses are already part of the real sign text, though: `K10 헬기장(하)`,
`G36 자운암(상)`, `호압사(상)`, `약청수약수터(폐쇄)` — 38 sign names carry them. On the map
a made-up name and a sign name with a suffix look alike, and a reader can't tell at a glance
which pins are on a sign and which are our description.

Switch the made-up names to square brackets: `[수영장 사방댐]`. No sign in the file uses
`[` or `]`, so the brackets mean one thing only.

This is a data change only. Nothing in `src/` treats a leading `(` specially; the name is
shown and sorted as-is.

## Change

1. **Replace the wrapping `(` … `)` with `[` … `]` on the 17 made-up names**, matched by
   지점번호. Columns 1–4 stay byte-identical; only the outer pair changes, the text inside
   is untouched.

   | 지점번호 | 시/군/구 | 이름 |
   |---|---|---|
   | 다사52334083 | 관악구 | [서울대 연구공원 사방댐] |
   | 다사51773956 | 관악구 | [수영장 사방댐] |
   | 다사47764190 | 금천구 | [독산자연공원] |
   | 다사47844017 | 금천구 | [신흥초교 위] |
   | 다사54183669 | 과천시 | [정부과청청사 사방댐] |
   | 다사53123707 | 과천시 | [육봉능선 가는길] |
   | 다사53123702 | 과천시 | [육봉능선 입구] |
   | 다사52053769 | 안양시 동안구 | [봉계곡길2] |
   | 다사49003772 | 안양시 만안구 | [삼막로 사방댐 1] |
   | 다사49013778 | 안양시 만안구 | [삼막로 사방댐 2] |
   | 다사49133779 | 안양시 만안구 | [삼막로 사방댐 3] |
   | 다사49373790 | 안양시 만안구 | [삼막로 사방댐 4] |
   | 다사49583804 | 안양시 만안구 | [삼막로 사방댐 5] |
   | 다사49263872 | 안양시 만안구 | [석수동 갈림길 아래] |
   | 다사51183613 | 안양시 만안구 | [안양수목원 사방댐] |
   | 다사49293899 | 안양시 만안구 | [호압사 갈림길] |
   | 다사50553708 | 안양시 만안구 | [천인암] |

2. **Leave parentheses inside sign names alone.** `(상)`, `(하)`, `(중)`, `(위)`,
   `(폐쇄)`, `(철조망)` and the like are what the sign says; only a name that is wrapped
   in parentheses end to end is ours.

3. **Leave rows where they lie** and keep the file clean: one tab before the name, no
   trailing whitespace, LF endings.

## Files

| File | Change |
|---|---|
| `data/national_points_w_name.tsv` | 17 made-up names go from `( )` to `[ ]` |

## Verification

1. Only the name column changed:
   `diff <(git show HEAD:data/national_points_w_name.tsv | cut -f1-4) <(cut -f1-4 data/national_points_w_name.tsv)`
   prints nothing; still 282 lines.
2. No name starts with `(` any more:
   `cut -f5 data/national_points_w_name.tsv | grep -c '^('` → 0.
3. Seventeen bracketed names, and brackets appear nowhere else:
   `cut -f5 data/national_points_w_name.tsv | grep -c '^\['` → 17, and
   `cut -f5 data/national_points_w_name.tsv | grep -c '\['` → 17.
4. The text inside is unchanged — turning the brackets back into parentheses gives HEAD:
   `diff <(git show HEAD:data/national_points_w_name.tsv) <(LC_ALL=C awk -F'\t' -v OFS='\t' '$5 ~ /^\[.*\]$/ {$5 = "(" substr($5, 2, length($5) - 2) ")"} 1' data/national_points_w_name.tsv)`
   prints nothing.
5. No stray whitespace or CR: `grep -nP '[ \t]$|\r' data/national_points_w_name.tsv` prints
   nothing.
6. `npm run build` passes.
7. `npm run preview`, then on the map:
   - The 삼막로 계곡 dams read [삼막로 사방댐 1] → … → [삼막로 사방댐 5].
   - `K10 헬기장(하)` still reads with its parentheses.

## Follow-up

- If a made-up name is later confirmed on a sign, drop the brackets and use the sign's text.
- Note the `[ ]` convention in the README if the 이름 column is ever documented there.
