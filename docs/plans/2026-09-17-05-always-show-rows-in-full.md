# Always show list rows in full

## Context

Both panel lists, Trails (`src/ui.ts`) and National Points
(`src/pointsList.ts`), clipped each row to one line. Clicking a row unclamped it
and selected it at the same time; a second click clamped it again, and each
heading carried an **Expand all** / **Collapse all** button labelled from that
hidden per-row state. Since `2026-09-17-02-row-click-expands.md` made the whole
row the toggle, every select also resized the row under the pointer, and the
button's label depended on state nothing on screen showed. It read as confusing
more often than it helped.

Rows are now always drawn in full, and the expand/collapse feature is gone from
both lists. A row click keeps its other job: select and zoom (trails), or go to
the point and open its popup (points).

## Approach

### 1. Trail list — `src/ui.ts`

`expandAll`, `expandedNames`, the pruning of it in `renderTrails()`,
`syncExpandAll()` and `setAllNamesExpanded()` are removed. The row click handler
keeps its `closest('input, button')` guard and only calls `onSelect` and
`onZoomTo`. The name's tooltip reads `— click to zoom`.

### 2. Point list — `src/pointsList.ts`

`expandAll`, `expanded`, `syncExpandAll()`, `expandedRowCount()` and
`setAllExpanded()` are removed, along with the `expanded` class on each `<li>`.
The row click only calls `onSelect`. Tooltips read `— click to go there`.

### 3. Markup — `index.html`

`#trail-expand-all` and `#point-expand-all` are removed.

### 4. Styles — `src/style.css`

`.trail-name`, `#point-list .point-title` and `.point-detail` lose their
`nowrap` / `ellipsis` clamp and take `overflow-wrap: anywhere` permanently — the
filename fallback, a 지점번호 and a 시/군/구 are all single unbroken tokens. The
`.expanded` rules and the heading-button rule go with the buttons.

### 5. Comments and docs

The Expand all paragraph in `src/listUi.ts`, the "clipped until expanded" note on
`PointRow.detail` in `src/points.ts`, and the README's point-list paragraph are
updated to match.

## Verification

1. `grep -rn -i expand src index.html README.md` — only the panel's `#expand`
   button remains.
2. `npm run build` — typecheck and bundle clean.
3. `npm run dev`, desktop and a 390×844 drawer:
   - Neither list heading shows an Expand all button.
   - Long trail names and point titles/details wrap instead of clipping.
   - A trail row click selects and zooms; a second click does not change its
     height. The checkbox and ▶ still do only their own thing.
   - A point row click opens its popup; the checkbox only toggles the pin.
