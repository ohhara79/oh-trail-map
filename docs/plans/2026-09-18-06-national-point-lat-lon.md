# Show a national point's lat, lon

## Context

Every `NationalPoint` has carried `lat`/`lon` since `decodeNationalPoint` first turned a
지점번호 into a position, but the app only used them to place the pin. There was no way to read
the position off a point to compare it with a GPS app, another map, or the GPX point readout on
the profile.

Three decisions were taken before writing it:

1. **Both the popup and the list row.** The popup is the one render site for 2D and 3D (orbit
   click, walk tap, the 25 m auto-open), so one line there covers every view. The list gets it
   too, as a third line, since rows are always shown in full (`2026-09-17-05`).
2. **Five decimals**, `37.46609, 126.96184`, about 1 m. The profile readout uses six
   (`profilePanel.ts:264`), but that is a GPS fix. A 지점번호 only resolves to 10 m, so a sixth
   digit would claim precision the source does not have.
3. **Plain text.** It can be selected and copied by hand. No copy button and no link out.

## Change

### `src/points.ts`

- `formatLatLon(point)` is the one formatter, so the popup and the list cannot disagree. Lat
  first, then comma and space, the same order and separator as the profile readout.
- `popupContent` adds a last line, `div.muted.point-code`. It goes last and muted for the same
  reason the region line does: it is the line the eye can skip. `.point-code` gives it the
  tabular figures the 지점번호 already has. The existing `.point-popup .muted` rule makes it 12px.
- `PointRow.coords` holds the formatted string. **It is not in `haystack`.** It is all digits,
  so a 지점번호 query like `5241` would start matching unrelated rows through their lat/lon.
  The `haystack` docstring used to say "both drawn lines"; it now says title and detail, and
  explains why.

### `src/pointsList.ts`

`rebuild()` adds a third line, `div.point-detail.point-code`, under the detail line. It uses
plain `textContent` without `highlightName`, because the filter never searches it and so never
produces a `<mark>` there.

### `README.md`

The pin bullet and the list bullet both mention lat, lon. The list bullet also says the filter
matches every column except lat, lon.

### Untouched

- `src/style.css`: `.point-detail` (11px muted) and `.point-code` (tabular-nums) combine without
  a new rule. So do `.point-popup .muted` and `.point-code`.
- `src/nationalPoint.ts`: the numbers were already there.

## Verification

1. `npm run build` passes.
2. Under `tsx` against the real TSV: all 272 points format as `dd.ddddd, ddd.ddddd`.
   `다사52414090` → `37.46609, 126.96184` and `다사49013778` → `37.43779, 126.92361`, the two
   landmarks `nationalPoint.ts` documents.
3. `npm run dev`: the popup shows the new line under the region in 2D and in 3D orbit/walk.
   List rows show a third line. Filtering `5241` matches the same rows it did before.
