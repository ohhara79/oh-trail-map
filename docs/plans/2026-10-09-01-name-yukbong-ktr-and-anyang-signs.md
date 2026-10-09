# Name the 육봉 ridge, KTR, 코끼리바위 and the 안양 signs

## Context

After the G57 / 과천 철탑 pass, 26 rows are still grey. The largest cluster is the 육봉능선 on
the 과천 side: 육봉 국기봉 and 팔봉능선입구 are named, but the 6부, 7부 and 8부능선 posts below
them, the two posts where the 육봉능선 trail leaves the valley, and 코끼리바위 next to 육봉 are
not. Further south, the two posts around KTR at the 과천 trailhead are
unnamed, as is the 국가지점번호판 at the 정부과천청사 사방댐.

In 안양, 관상약수터 is the last unnamed 동안구 row, and the 만안구 side of 삼성산 still has
grey pins at 망월암, 천인암 and below 국기봉, plus the 안양수목원 사방댐.

This is a data change only. `parseNationalPoints` (`src/nationalPoint.ts`) already reads the
optional 이름 column; a named row gets the amber pin, sorts above unnamed neighbours and leads
its popup with the name (`src/points.ts`) — no code change.

## Change

1. **Append column 5 (이름) to fifteen rows**, matched by 지점번호. Columns 1–4 stay
   byte-identical, so no pin moves and no row appears or disappears.

   | 지점번호 | 시/군/구 | 사물유형 | 이름 |
   |---|---|---|---|
   | 다사53673634 | 과천시 | 위치안내(표시)판 | KTR |
   | 다사53683639 | 과천시 | 위치안내(표시)판 | KTR뒷길 |
   | 다사52913703 | 과천시 | 위치안내(표시)판 | 육봉6부능선 |
   | 다사52883702 | 과천시 | 위치안내(표시)판 | 육봉7부능선 |
   | 다사52753697 | 과천시 | 위치안내(표시)판 | 육봉8부능선 |
   | 다사54183669 | 과천시 | 국가지점번호판(전용지주) | (정부과청청사 사방댐) |
   | 다사53123707 | 과천시 | 위치안내(표시)판 | (육봉능선 가는길) |
   | 다사53123702 | 과천시 | 위치안내(표시)판 | (육봉능선 입구) |
   | 다사52673695 | 과천시 | 위치안내(표시)판 | 코끼리바위 |
   | 다사52443602 | 안양시 동안구 | 위치안내(표시)판 | 관상약수터 |
   | 다사50913729 | 안양시 만안구 | 국가지점번호판(전용지주) | 망월암~소공원 |
   | 다사51183613 | 안양시 만안구 | 사방댐 | (안양수목원 사방댐) |
   | 다사50283717 | 안양시 만안구 | 위치안내(표시)판 | 국기봉 인근 |
   | 다사50553708 | 안양시 만안구 | 위치안내(표시)판 | (천인암) |
   | 다사50683721 | 안양시 만안구 | 위치안내(표시)판 | 망월암기점 |

   Named rows go from 255 to 270; unnamed rows from 26 to 11.

2. **Write the 육봉 부능선 names unspaced** — `육봉6부능선`, `육봉7부능선`, `육봉8부능선` — as
   the signs write them. Leave `육봉 국기봉` as it is; respelling an already-named row is out
   of scope.

3. **Parenthesise names that are not on a sign.** The two 육봉능선 posts and 천인암 are
   described by where they stand, and the two 사방댐 by the landmark beside them, following
   `(수영장 사방댐)` and `(봉계곡길2)`. Names read off a physical sign stay bare.

4. **Keep the `~` form for between-points**: `망월암~소공원`, like `문원폭포~일명사지절터`.

5. **Leave rows where they lie.** Nothing reads the file in order; sorting would only add
   noise to the diff.

6. **Store the names clean**: one tab before the name, no trailing whitespace, LF endings.

7. **Leave the remaining 11 rows unnamed** — the 관악구 사방댐 at 다사52334083 and 10 in
   만안구. A guessed name is worse than none on a rescue sign.

## Files

| File | Change |
|---|---|
| `data/national_points_w_name.tsv` | 15 rows gain an 이름 |

## Verification

1. Only the name column changed:
   `diff <(git show HEAD:data/national_points_w_name.tsv | cut -f1-4) <(cut -f1-4 data/national_points_w_name.tsv)`
   prints nothing.
2. Row shape: `awk -F'\t' '{print NF}' data/national_points_w_name.tsv | sort | uniq -c`
   → 11 four-field and 271 five-field rows (header included); still 282 lines.
3. Named count: `awk -F'\t' 'NR>1 && $5!=""' data/national_points_w_name.tsv | wc -l` → 270.
4. No stray whitespace or CR: `grep -nP '[ \t]$|\r' data/national_points_w_name.tsv` prints
   nothing.
5. No duplicate name within a 시/군/구:
   `awk -F'\t' 'NR>1&&$5!=""{print $2"|"$5}' data/national_points_w_name.tsv | sort | uniq -d`
   prints nothing.
6. `npm run build` passes.
7. `npm run preview`, then on the map:
   - The 육봉능선 reads (육봉능선 입구) → (육봉능선 가는길) → 육봉6부능선 → 육봉7부능선 →
     육봉8부능선 → 육봉 국기봉 without a grey gap, with 코끼리바위 beside 육봉8부능선.
   - KTR and KTR뒷길 are amber pins at the 과천 trailhead.
   - 다사52443602 reads **관상약수터**; 동안구 has no grey pins left.
   - On 만안구 삼성산, 망월암기점, 망월암~소공원, 국기봉 인근 and (천인암) are amber.

## Follow-up

- `육봉 국기봉` is the only spaced 육봉 name; respell it to `육봉국기봉` if the sign turns out
  to be written unspaced.
- With 관상약수터 named, every 동안구 row has a name. The unnamed rows left are the 관악구
  사방댐 at 다사52334083 and 10 in 만안구.
- `backup/` does not carry these names either; update it too if the merged file is ever
  regenerated from sources.
