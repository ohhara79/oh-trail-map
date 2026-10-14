# Fix the 과천 사방댐 name typo

## Context

The made-up name on 다사54183669, the 국가지점번호판 beside the dam below the
government complex in 과천시, reads `[정부과청청사 사방댐]`. 청 appears twice. The
complex is 정부과천청사, as it is spelled everywhere else in the repo (the
`ohhara_10933944.gpx` track name, the context of
`2026-10-09-01-name-yukbong-ktr-and-anyang-signs.md`). The typo came in with that
plan and was carried over unchanged when `2026-10-10-02-bracket-the-made-up-names.md`
switched the parentheses to brackets.

The wrong name shows in the point popup, the national point list and the list
filter, so searching for "과천청사" doesn't find the point.

This is a data change only.

## Change

1. **Fix the name on 다사54183669** in `data/national_points_w_name.tsv:238`:

   | 지점번호 | 시/군/구 | 이름 |
   |---|---|---|
   | 다사54183669 | 과천시 | `[정부과청청사 사방댐]` → `[정부과천청사 사방댐]` |

   Keep the brackets, since it is still a made-up name. Columns 1–4 and every other
   row stay byte-identical.

2. **Leave the old plans alone.** `2026-10-09-01` and `2026-10-10-02` record what
   was done at the time. This plan records the fix.

## Files

| File | Change |
|---|---|
| `data/national_points_w_name.tsv` | 1 name: 과청 → 과천 |

## Verification

1. Only that one row changed:
   `git diff --stat HEAD -- data/national_points_w_name.tsv` shows
   `1 insertion(+), 1 deletion(-)`, and
   `diff <(git show HEAD:data/national_points_w_name.tsv | cut -f1-4) <(cut -f1-4 data/national_points_w_name.tsv)`
   prints nothing.
2. The typo is gone: `grep -c 과청 data/national_points_w_name.tsv` → 0, and
   `grep -c '\[정부과천청사 사방댐\]' data/national_points_w_name.tsv` → 1.
3. Still 17 bracketed names: `cut -f5 data/national_points_w_name.tsv | grep -c '^\['` → 17.
4. No stray whitespace or CR: `grep -nP '[ \t]$|\r' data/national_points_w_name.tsv`
   prints nothing.
5. `npm run build` passes.
6. `npm run preview`: filtering the national point list for "과천청사" finds
   `[정부과천청사 사방댐]`, and its popup shows the same name.
