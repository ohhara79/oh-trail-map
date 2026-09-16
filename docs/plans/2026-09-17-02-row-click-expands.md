# One click, one behaviour, anywhere on a list row

## Context

Both panel lists answered a click differently depending on which line of the
row it landed on. The title (`.trail-name` in `src/ui.ts`, `.point-title` in
`src/pointsList.ts`) had its own listener that toggled the row's clamp, then
bubbled to the row, which selected it. The line beneath (`.trail-stats`,
`.point-detail`) and the swatch reached only the row: selected, not expanded.

Nothing on screen marks that boundary. The detail line reads as part of the same
entry, and on a phone, where the tooltip explaining the title's extra job cannot
be reached, there is no way to discover it. In the point list it was actively
backwards: an expanded row unclamps *both* lines, so tapping the clipped detail
to read it was exactly the tap that did not.

## Approach

### 1. The toggle moves from the title to the row

In both lists the body of the title's click listener — flip the id in the
expanded set, toggle `expanded` on the name (trails) or the `<li>` (points),
`syncExpandAll()` — now runs at the top of the row's existing click handler,
ahead of `onSelect` / `onZoomTo`. The title's own listener is gone.

The row handler's `closest('input, button')` guard already exempts the
visibility checkbox and the trail list's ▶ button, so those still do only their
own thing. Everything else on the row — title, detail, swatch, padding — now
does what a title click used to.

It stays a toggle. A second click on an expanded row collapses it and selects it
again, as the title did, which keeps a per-row way to close one besides
**Collapse all**.

### 2. Cursor and hints follow the click target

`cursor: pointer` moves from `#point-list .point-title` (and the inline style on
`.trail-name`) to `#trail-list li, #point-list li` in `src/style.css`. The point
detail's `title` tooltip gains the same "click to go there and show the full
text" suffix as the title, and the comments and `README.md` say "row" where they
said "title".

## Verification

1. `npm run build` — typecheck and bundle clean.
2. Trail list, desktop and a 390×844 drawer: the name, the stats line, the swatch
   and the row's padding each expand, select and zoom; a second click collapses
   and stays selected. The checkbox and ▶ do not expand.
3. Point list: the title, the detail and the swatch each unclamp both lines and
   open the popup; a second click collapses. The checkbox does not expand.
4. **Expand all** / **Collapse all** relabels after row clicks in both lists, and
   an expanded row survives a filter change and a visibility toggle.
