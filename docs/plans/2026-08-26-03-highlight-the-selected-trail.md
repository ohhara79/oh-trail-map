# Highlighting the selected trail

## Context

The app had no concept of a selected trail. Clicking a name in the sidebar
toggled its line clamp and called `onZoomTo`, which does
`map.fitBounds(trail.bounds, { padding: [30, 30] })` — the view jumped, and then
you were looking at a tangle of lines with nothing saying which one you had just
asked for. Clicking a trail *on the map* did nothing at all: the only
`map.on(...)` in the codebase was `map.on('zoomend moveend resize', updateEstimate)`,
and the polylines built by `buildTrail()` carried no handlers.

Uniform-colour mode sharpens the problem. Every trail is `#e02020` there, so
colour conveys nothing and only an explicit selection treatment can answer
"which one is that?".

Two decisions frame the rest.

**Selection is view state.** Like the filter query and the panel's open/closed
state, it is not persisted. `Settings` describes how trails *render* — a
selection restored on boot would highlight something you had forgotten choosing
and dim everything else on a cold start.

**Selection never reaches an export.** `src/export.ts` reads only `colorOf()`,
`weightOf()` and `trail.segments`, so the dimming and the halo below are
invisible to PNG and SVG output by construction. An export is of the trails, not
of what happened to be clicked, and nothing had to be added to guarantee that.

## Approach

### 1. The treatment: casing, front, dim, pulse

Four things happen at once, because no one of them is enough on its own:

- Two casings are drawn *under* the selected trail — a dark outer ring and a
  white inner one. One colour cannot carry every basemap: white alone washes out
  on Carto Light, dark alone disappears on Esri satellite.
- The selected trail is brought to the front, so an overlapping neighbour cannot
  paint over the thing you just picked.
- Every other visible trail drops to `DIM_OPACITY` (0.3). This is the part that
  works in uniform-colour mode, and the part that survives being panned away
  from and back to.
- The casing pulses twice on selection, so the eye is pulled to the right place
  even when the trail is at the edge of the viewport.

The dimming is the persistent signal and the pulse is the momentary one. Asked
for "clearly, or at least briefly", the honest answer was both — they cost
almost nothing together and fail in different situations.

### 2. Opacity joins `restyleTrail`, which is why it cannot drift

`restyleTrail()` set **only** `color` and `weight`, which meant any style
property set from somewhere else would be silently preserved across a restyle
rather than owned by one place. So opacity had to go through it too, resolved by
a new sibling of the file's existing "single place that decides X" functions:

```ts
export function mapOpacityOf(trailId: string, selectedId: string | null): number {
  return selectedId === null || trailId === selectedId ? 1 : DIM_OPACITY;
}
```

`mapOpacityOf()` sits beside `colorOf()` and `weightOf()` but is deliberately
*not* shared with the exporters, and its doc comment says so — it is the one
style decision the map makes alone.

The concrete regression this prevents: select a trail, then toggle uniform
colour. That path calls `restyleTrail` on every trail; had opacity been applied
anywhere else, every dimmed trail would have snapped back to full strength while
the halo stayed put.

`main.ts` gained `restyleAll()`, which replaced the two hand-rolled
`for (const trail of trails) restyleTrail(...)` loops. Colour, width and
selection now all land through one function.

### 3. The halo is rebuilt, not restyled — and that is what restarts the pulse

`src/selection.ts` is a new module: the halo is decoration *over* the trail
model, and `trails.ts` is about the model.

`Halo.show(trail, settings)` clears its `L.LayerGroup` and rebuilds both casings
from `trail.segments` — the same source `buildTrail()` strokes from, so the halo
can never trace a different line than the trail it marks. Weights are
`weightOf(settings) + 10` and `+ 6`, which is why the trail-width slider also
routes through `restyleAll()`.

Rebuilding rather than restyling buys the animation for free:

```css
@keyframes trail-halo-pulse { 0%, 100% { stroke-opacity: .95; } 50% { stroke-opacity: .2; } }
.trail-halo { animation: trail-halo-pulse .55s ease-in-out 2; }
```

Fresh `<path>` elements start their animation from scratch on every selection,
so re-selecting pulses again with no class-toggle-plus-forced-reflow dance.
Leaflet writes `stroke-opacity` as a *presentation attribute*
(`path.setAttribute('stroke-opacity', …)`), which loses to any author rule, so
the keyframes apply while they run and the attribute's own `.95` takes back over
once they finish — no `animation-fill-mode` needed. The rule joins the existing `prefers-reduced-motion` block
at the bottom of `style.css` — reduced motion keeps the halo and drops only the
pulse.

Z-order is three lines and one ordering:

```ts
this.group.eachLayer((l) => (l as L.Polyline).bringToFront());
trail.layer.eachLayer((l) => (l as L.Polyline).bringToFront());
```

Every vector layer shares one `<g>` in Leaflet's `overlayPane`, so front/back is
DOM order within it: the halo rises above the other trails, then the selected
trail's own stroke rises above its halo. A custom pane could not express
"between two layers that both live in `overlayPane`". Re-applied on every
`restyleAll()`, since adding or removing a trail perturbs the order.

### 4. Map clicks are hit-tested geometrically

No listener is attached to the polylines. One `map.on('click')` handler answers
every click, using `trailAt(map, point, trails)` in `selection.ts`.

Handling the click on the stroke itself would leave a 1–10 px target, and
widening it with an invisible wide "hit" polyline per segment would permanently
double the SVG node count for every trail — a cost paid on every pan and zoom to
save arithmetic that only runs on click. (The paths do stay `interactive`, which
is worth keeping for the `cursor: pointer` Leaflet gives them; with no listener
of their own they do not swallow the event, and `_findEventTargets` falls
through to the map.) Nearest-wins also settles overlapping trails
by proximity rather than by whichever happens to be drawn last, which matters
exactly where two trails share a ridge.

Each visible trail is bbox-rejected first — its `bounds` projected to container
points and inflated by the tolerance — so most trails never have their geometry
touched. Survivors are walked segment by segment through
`L.LineUtil.pointToSegmentDistance()` over container-point projections. The
tolerance is 15 px, or 22 under `(pointer: coarse)`: the line is what you aim
for, not what you can realistically hit.

Deselection then falls out of one expression rather than needing its own paths:

```ts
const hit = trailAt(map, e.containerPoint, trails);
selectTrail(hit && hit.id !== selectedId ? hit.id : null, true);
```

Bare map and a second click on the selected trail both clear it.

**A map click does not move the map.** You clicked something you could already
see, and `fitBounds` would pull it out from under the pointer. Clicking a name in
the list still zooms, as it always did — that click is a request to *go* there.

### 5. The list is the other half of the link

The selected row gets `.selected` and `aria-current="true"`, styled as a tint
plus an `inset 3px 0 0 var(--accent)` bar. To let the tint reach the edge of the
block's own padding rather than leaving a white stripe beside it, every row now
carries `padding: 6px 8px; margin: 0 -8px` — the negative margin cancels the
padding, so unselected rows look exactly as they did.

A row-level click handler selects, guarded by
`if ((e.target as HTMLElement).closest('input, button')) return;` so the
checkbox, colour swatch and remove button keep their own meaning. The existing
`.trail-name` handler is untouched: a name click still expands and zooms, then
bubbles to the row handler, which selects.

Scrolling the selected row into view had to happen **after** `renderTrails`
restores `panelBody.scrollTop`, or the two fight — the restore exists so that
toggling a trail does not snap the panel to the top. `Ui` keeps a
`lastSelectedId` so it fires only on an actual change, and
`scrollIntoView({ block: 'nearest' })` is a no-op for a row already on screen. A
selection whose trail the filter is hiding simply has no row, which needed no
special case.

**Escape gained a middle rung**: clear a non-empty query → else clear the
selection → else close the panel. Same reasoning already recorded for the query
branch — Escape undoes the most local thing first, so dismissing a highlight
never costs you the drawer. `Ui` reads `lastSelectedId` for the condition rather
than being told about the selection twice.

**A toast covers the closed drawer.** On a phone the panel starts closed, and on
desktop it can be collapsed, so a map click may have no row to highlight at all.
Selections that originate from the map show a 3-second notice naming the trail
and its distance, through the existing notice stack and `formatDistance()`.
List-originated selections do not — you can see the row you just clicked.

### 6. Selection cannot outlive its trail

`setVisible()` clears the selection when it hides the selected trail; a halo
tracing a trail that is no longer drawn is worse than no halo. `onRemove` does
the same. Both already funnel into `restyleAll()` and `refresh()`.
