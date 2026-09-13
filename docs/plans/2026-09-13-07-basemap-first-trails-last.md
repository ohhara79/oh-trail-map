# Put Basemap first and Trails last in the panel

## Context

The control panel's sections ran Trails → Show 국가지점번호 points → Basemap. They now run
Basemap → Show 국가지점번호 points → Trails, so the two short controls sit at the top and
the long trail list is last.

## Change

1. **`index.html`** — inside `#panel-body`, the three `<section class="block">` elements
   are reordered: Basemap, then `#points-toggle`, then the `grow-block` Trails section.
   Markup moved verbatim; no ids, classes or text change.

   Nothing else needs touching:
   - `src/style.css` — `.block:last-child { border-bottom: 0 }` is positional, so it now
     drops the border under Trails instead of Basemap. No other rule depends on order.
   - `src/ui.ts` — looks everything up by id; `renderTrails` preserves
     `panelBody.scrollTop`, which still works with the list lower down.

## Verification

1. `npm run build` — typecheck and build pass.
2. In the browser (desktop width and ≤720px drawer): panel reads BASEMAP, Show
   국가지점번호 points, TRAILS; no border under the Trails block; basemap radios, the
   points toggle, and trail checkboxes/filter/row-click still work.
