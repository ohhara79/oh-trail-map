# Bring back the 12 사방댐 points

## Context

`2026-09-13-04-drop-the-off-mountain-points.md` deleted 65 rows from
`data/national_points_w_name.tsv`. 12 of them were 사방댐 (관악구 2, 과천 4, 안양 만안구 6). A
check dam has a 지점번호 only because a plate is bolted to it, and it sits in a stream bed
rather than on a trail. That was the reason to drop them.

We are no longer sure that was right. A 사방댐 is still a place with a plate someone can
read out in an emergency, and several sit right beside the 삼성산 / 관악산 approaches. They go
back in for now. This is a tentative reversal and can be undone. The other 53 rows the
earlier change dropped (8 과천 전신주 and the signs on other hills) stay out.

## Change

1. **Re-add the 12 rows** exactly as they were: no 이름, sorted into their 시/군/구 blocks.

   | 시/군/구 | 지점번호 |
   |---|---|
   | 관악구 | 다사52334083, 다사51773956 |
   | 과천시 | 다사58263661, 다사58103761, 다사58273791, 다사58303831 |
   | 안양시 만안구 | 다사49003772, 다사49583804, 다사51183613, 다사49133779, 다사49373790, 다사49013778 |

   Rows go from 273 to 285, with 285 unique ids. Unnamed rows go from 49 to 61, so all 12
   are grey pins. `parseNationalPoints` reads whatever rows are there, so no code changes.
2. **Counts in comments.** Several comments still said 272 (and one said 128 unnamed) from
   before `2026-09-26-02`. They now say 285, with 284 for the "re-add" count and 61 unnamed.

## Trade-off

The 4 과천 사방댐 sit at 다사5810–5830, east of the 다사56 cut. They push the point box's
east edge from x 5447 to 5830, so the box is about 10.6 km wide instead of about 7 km. The
관악구 and 만안구 ones fall inside the existing box.

If they turn out to be clutter after all, each one can be unticked in the points list, which
is saved per id. Deleting the rows again is the other option.

## Verification

1. `npm run build` passes.
2. `grep -c $'\t사방댐' data/national_points_w_name.tsv` gives 12.
3. `npm run dev`: the points list has 285 rows. 다사49013778 is a grey pin in 안양 만안구, and
   다사58303831 is a grey pin east of 과천.
