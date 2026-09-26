# Name the 목골산 M signs and every 금천구 point

## Context

`2026-09-24-01` left 96 rows unnamed — 36 in 관악구, 30 in 금천구, 16 in 과천시, 12 in 만안구
and 2 in 동안구. Names for 47 of them are now in hand, and they cluster:

- **목골산 (관악구)**: fourteen 국가지점번호판 on the ridge west of 호암산, from 산복터널 over
  목골산 to 한양아파트. They are numbered M1–M14 on the ground, a new series beside K and G.
- **금천구**: all thirty rows — the 석수능선 번호판 toward 호압사, the 약수터, 정자 and
  배드민턴장 on the 금천 side of 삼성산, and two 가로등. This empties 금천구's unnamed list.
- **만안구**: three 위치안내(표시)판 near 석수동 — BAC암벽장, 석수동 갈림길, 불영암.

One existing name also changes: 동안구 `봉계곡길2` becomes `(봉계곡길2)`. That point has
no name of its own, so its label was made up, and it now carries the parentheses like the
made-up 금천구 names.

This is a data change only. `parseNationalPoints` (`src/nationalPoint.ts`) already reads the
optional 이름 column, and `pointRows` / `popupContent` (`src/points.ts`) turn a name into the
amber pin, the list title and the popup lead — no code change.

## Change

1. **Append column 5 (이름) to 47 rows**, matched by 지점번호. Columns 1–4 stay
   byte-identical, so no pin moves and no row appears or disappears.

   목골산, 관악구 국가지점번호판(전용지주):

   | 지점번호 | 이름 | 지점번호 | 이름 |
   |---|---|---|---|
   | 다사48753991 | M1 산복터널 위 | 다사48234084 | M9 목골산 정상 |
   | 다사48543993 | M2 휴먼시아 상 | 다사48294094 | M10 선우테니스장 위 |
   | 다사48463996 | M3 휴먼시아 하 | 다사48334105 | M11 선우공원 위 삼거리 |
   | 다사48383998 | M4 휴먼시아아파트 갈림길 | 다사48204128 | M12 난곡초등학교 위 |
   | 다사48204015 | M5 서울숲 요양원 위 | 다사48174145 | M13 유아숲 체험원 위 |
   | 다사48124060 | M6 목골산 공터 | 다사48244151 | M14 한양아파트 위 |
   | 다사48154083 | M7 목골산 삼거리 | | |
   | 다사47974102 | M8 선우체육관 위 | | |

   금천구:

   | 지점번호 | 사물유형 | 이름 |
   |---|---|---|
   | 다사47903761 | 가로등 | 해솔학교 위 |
   | 다사48403806 | 가로등 | 경인교대 위 |
   | 다사47764190 | 국가지점번호판(전용지주) | (독산자연공원) |
   | 다사47844017 | 국가지점번호판(전용지주) | (신흥초교 위) |
   | 다사48693826 | 국가지점번호판(전용지주) | 신랑각시바위 |
   | 다사48793847 | 국가지점번호판(전용지주) | 석수능선 헬기장 |
   | 다사48983872 | 국가지점번호판(전용지주) | 석구상 |
   | 다사49163884 | 국가지점번호판(전용지주) | 석수동 갈림길 |
   | 다사49293899 | 국가지점번호판(전용지주) | 호압사 갈림길 |
   | 다사49383910 | 국가지점번호판(전용지주) | 삼성산 등산로 기지국 |
   | 다사49293919 | 국가지점번호판(전용지주) | 호압사(상) |
   | 다사48933981 | 국가지점번호판(전용지주) | 산복터널 위 |
   | 다사48343999 | 국가지점번호판(전용지주) | 탑동초교 위 |
   | 다사48214040 | 국가지점번호판(전용지주) | 천불사 위 |
   | 다사48044087 | 기타 | 목골산 |
   | 다사48233990 | 기타 | 오리약수터 |
   | 다사47813756 | 정자 | 남서울약수터 |
   | 다사47693805 | 정자 | 약청수약수터(폐쇄) |
   | 다사48183825 | 정자 | 명승약수터(폐쇄) |
   | 다사48283833 | 정자 | 흥산배드민턴장 |
   | 다사48023847 | 정자 | 삼성약수터 |
   | 다사47953854 | 정자 | 치산약수터 |
   | 다사48403826 | 정자 | 산정배드민턴장 |
   | 다사49083913 | 정자 | 잣나무약수터 |
   | 다사49073927 | 정자 | 호암2약수터 |
   | 다사47913808 | 약수터(우물) | 불로천약수터 |
   | 다사48263823 | 약수터(우물) | 야호배드민턴장 |
   | 다사48463842 | 약수터(우물) | 옹달샘약수터 |
   | 다사48353852 | 약수터(우물) | 산복약수터 |
   | 다사47914001 | 약수터(우물) | 순흥약수터 |

   만안구 위치안내(표시)판:

   | 지점번호 | 이름 |
   |---|---|
   | 다사48673815 | BAC암벽장 인근 |
   | 다사49183889 | 석수동 갈림길 |
   | 다사48903860 | 불영암 부근 |

2. **Rename 동안구 다사52053769** from `봉계곡길2` to `(봉계곡길2)`, because the label was
   made up, not taken from the sign.

3. **Keep each 구's form.** 관악구 names lead with the sign's number (`M7 목골산 삼거리`,
   as with K and G); 금천구 and 만안구 signs carry no number, so their names are the place
   alone.

4. **Parenthesise a made-up name.** When a point has no name of its own, it gets one made up
   from what is nearby, wrapped in parentheses: `(독산자연공원)`, `(신흥초교 위)`,
   `(봉계곡길2)`. The parentheses show that the name is a label, not the name on the sign.
   This is different from a suffix like `호압사(상)` or `(폐쇄)`, which is part of a real
   name.

5. **Name by the place, not the 사물유형.** Several 금천구 rows are typed 정자 or 기타 but
   stand at a 약수터 or 배드민턴장; the name says where a hiker is, and the type column stays
   as exported.

6. **Keep closed springs as `(폐쇄)`** (약청수약수터, 명승약수터) so nobody walks there for
   water.

7. **Leave 만안구 다사49293899 blank.** The same 지점번호 is listed under both 금천구 and
   만안구. `호압사 갈림길` comes from 금천구's listing, and 만안구's listing gives no name for
   it, so only the 금천구 row is named. `parseNationalPoints` keeps the first of the two rows,
   which is the 금천구 row, so the map still shows one amber pin with the name.

8. **Accept repeated place names across 구**: 금천구 `산복터널 위` beside 관악구
   `M1 산복터널 위`, and 금천구 / 만안구 `석수동 갈림길`. They are different posts at the
   same landmark, and the 구 in each row's detail tells them apart.

9. **Leave rows where they lie**, and **store the names clean**: one tab before the name, no
   trailing whitespace, LF endings.

10. **Leave the remaining 49 rows unnamed** — 22 in 관악구, 16 in 과천시, 9 in 만안구, 2 in
   동안구. They stay unnamed until a real name is known or one is made up. A made-up name
   always goes in parentheses so it can't be taken for the sign's own text.

## Files

| File | Change |
|---|---|
| `data/national_points_w_name.tsv` | 47 rows gain an 이름, one is renamed; nothing else changes |
| `src/nationalPoint.ts` | Comment only: the 다사49293899 note says the 금천구 row is named |

## Verification

1. Only the name column changes:
   `diff <(git show HEAD:data/national_points_w_name.tsv | cut -f1-4) <(cut -f1-4 data/national_points_w_name.tsv)`
   prints nothing.
2. Row shape: `awk -F'\t' '{print NF}' data/national_points_w_name.tsv | sort | uniq -c`
   → 49 four-field and 225 five-field rows (header included); still 274 lines.
3. Named count: `awk -F'\t' 'NR>1 && $5!=""' data/national_points_w_name.tsv | wc -l` → 224.
4. 금천구 is fully named:
   `awk -F'\t' 'NR>1 && $5=="" {print $2}' data/national_points_w_name.tsv | sort | uniq -c`
   lists no 금천구.
5. No stray whitespace or CR: `grep -nP '[ \t]$|\r' data/national_points_w_name.tsv` prints
   nothing.
6. No duplicate name within a 시/군/구:
   `awk -F'\t' 'NR>1&&$5!=""{print $2"|"$5}' data/national_points_w_name.tsv | sort | uniq -d`
   prints nothing.
7. The only parenthesised names are the three made-up ones:
   `awk -F'\t' '$5 ~ /^\(/' data/national_points_w_name.tsv` lists exactly 다사47764190,
   다사47844017 and 다사52053769.
8. `npm run build` passes.
9. `npm run preview`, then on the map:
   - 목골산 shows fourteen amber pins, 다사48234084 reading **M9 목골산 정상**.
   - 다사49293899 is one amber pin, **호압사 갈림길**, with no grey pin under it.
   - 다사47693805 reads **약청수약수터(폐쇄)**.
   - 다사52053769 reads **(봉계곡길2)**.
   - Filtering the national point list by `목골산` finds the M signs and the 금천구 기타 row.

## Follow-up

- The other 49 unnamed rows wait until their names are known; fill them the same way —
  match by 지점번호, keep the 구's form, put any made-up name in
  parentheses.
- `backup/national_point_numbers_gwanak.csv` does not carry the M names either; update it
  too if the merged file is ever regenerated from sources.
