# Show 시/도 and 시/군/구 in the national point popup

## Context

A National Point Number popup named the 이름, the 지점번호 and the 사물유형. It now also names
the 시/도 and 시/군/구 the point is filed under.

No new data was needed. `data/national_points_w_name.tsv` has been
`시/도 · 시/군/구 · 지점번호 · 사물유형 · 이름` since `2026-09-16-10` dropped the 순번 column, and
all 273 rows have both cells filled in. `parseNationalPoints` simply started at `fields[2]` and
threw the first two away — that plan doc said outright that "시/도 and 시/군/구 were never read
either". So this change reads two columns that were already sitting in the file.

Five pairs occur: 서울특별시 관악구 (168 rows), 경기도 과천시 (49), 서울특별시 금천구 (30),
경기도 안양시 만안구 (14), 경기도 안양시 동안구 (12).

The region goes on a muted line of its own, below 사물유형:

```
K1 호암생활관(위)      <strong>, only for the rows that have an 이름
다사52414090          .point-code
위치안내(표시)판       .muted
서울특별시 관악구       .muted   ← new
```

## Change

### `src/nationalPoint.ts` — carry the two columns

1. `NationalPoint` gains `province` and `district`, placed before `code` so the type reads in the
   file's own column order. Two fields rather than one precomposed `region`: the type is a
   transcription of the row, and joining them with a space is a popup decision that belongs in
   the popup. `district` is two words for the 안양시 rows (안양시 동안구, 안양시 만안구) — that
   space comes out of the cell, it is not a join.
2. `parseNationalPoints` reads `fields[0]` and `fields[1]`, trimmed. The `fields.length < 4` guard
   is unchanged and had to be: a row that reaches 사물유형 already has fields 0 and 1, so the 129
   rows that stop before 이름 keep parsing exactly as they did.
3. **No NFC fold on either**, unlike `name`. The fold on 이름 exists for *matching* — a
   decomposed name would not match anything typed (the same reason trails.ts folds). Region is
   only ever rendered, like 사물유형, which has never been folded. Measured: 0 of 273 rows have a
   decomposed 시/도 or 시/군/구 cell. Folding region but not 사물유형 would have been a third
   rule for one kind of text.
4. **The dedup docstring is corrected, not just reworded.** It argued the duplicate 다사49293899
   was harmless because the two rows are "identical in 지점번호, 사물유형 and 이름 alike". That
   was true, and displaying the region makes it misleading: the one field the two rows disagree
   on is now on screen. First-row-wins is unchanged, so the popup reads 서울특별시 금천구 and
   never 경기도 안양시 만안구 — which is the order of the file, not a fact about which side of
   the boundary the sign stands on. The comment now says so.

### `src/points.ts` — the new line

`popupContent` appends a third `div.muted` after `kind`, built with `textContent` like its
siblings for the injection reason the docstring already gives. The two halves are joined with
`filter(Boolean).join(' ')` rather than a template, so a row missing one half — none today, but
the parser accepts one — reads as the half it has instead of `서울특별시 ` with a trailing space
that looks like a truncation. The whole line is omitted if both are empty, the same call the
이름 line already makes.

This is the only render site: 2D (`openPointPopup`) and 3D (`view3d.ts` — orbit click, walk tap,
and the auto-open-within-25 m path) all call `popupContent`, so a point reads the same everywhere.

The module docstring and the `popupContent` docstring both list what the popup names; both now
include the region, and the injection note covers four file-sourced cells rather than two.

### `README.md`

The feature bullet says `click one for its 지점번호, 사물유형, 시/도 · 시/군/구 and 이름`. The
column names stay Korean, on the precedent `2026-09-13-09` set: 국가지점번호 became "National
Point Number", but the TSV's own column names were left alone.

### Untouched

- **`src/style.css`** — nothing to add. `.point-popup .muted { font-size: 12px }` already targets
  any `.muted` in the popup, and neither it nor `.muted` sets a margin, so the new div stacks
  under 사물유형 at the popup's line-height exactly as 사물유형 stacks under 지점번호. The
  longest line, 경기도 안양시 동안구, is far inside both Leaflet's 300px default and the 3D
  popup's `maxWidth: '240px'`.
- **`src/scene3d.ts`** — `pointsGeoJson` puts only `{ index, named }` in the features and carries
  no text; the index leads back to the same `NationalPoint` the 2D view holds.
- **`src/main.ts`, `src/view3d.ts`** — they only pass points around.
- The pin `title` attribute (`points.ts`) stays 이름-or-지점번호. It is a hover tooltip on a 13px
  dot, not a second popup.
- `src/nationalPoint.ts` is the only place a `NationalPoint` is constructed in `src/`, so two new
  required fields could not break the typecheck anywhere else.

## Verification

1. `npm run build` — `tsc --noEmit` and `vite build` both pass.
2. **The parser, run under Node against the real file.** 272 points (273 rows less the one
   duplicate) and 144 named, both unchanged from before the change. 0 points with an empty
   시/도 or 시/군/구. No point whose 시/도 is the literal `시/도`, so the header is still
   dropped. Counts per region: 관악구 168, 과천시 49, 금천구 30, 안양시 만안구 13, 안양시
   동안구 12 — 만안구 is 13 and not 14 because the deduplicated row was one of its own.
3. **`popupContent` rendered under a DOM stub**, to read the lines it actually emits:
   - `다사52414090` → `K1 호암생활관(위)` / `다사52414090` / `위치안내(표시)판` / `서울특별시 관악구`
   - `다사50863802` (unnamed) → three lines, no empty bold row, region still last
   - `다사49293899` → `서울특별시 금천구`, the documented first-row-wins side
   - `다사51733698` → `경기도 안양시 동안구`, three words
   - Across all 272 points, no popup line has a leading or trailing space.
4. `npm run dev`, 2D: the four lines appear on click, the new one in the same 12px muted grey as
   사물유형 and flush under it, and the popup has not widened. 3D: the same popup in orbit mode
   at 240px without wrapping, and while walking within 25 m of a point — the same
   `popupContent`, so a regression check rather than a separate path.
