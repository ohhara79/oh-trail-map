# Zooming to a trail from anywhere in its row

## Context

Two clicks in the trail list did different things depending on where in the row
they landed. Clicking the **name** selected the trail and zoomed to it; clicking
the stats line, or the empty space beside it, only selected. Nothing about the
row suggested that boundary — it is one row, with one trail in it, and the tint
plus halo appeared either way, so the missing `fitBounds` read as a bug rather
than a distinction.

The split was an artefact of how the two handlers grew. `.trail-name` is where
the click-to-unclamp behaviour lives (see
[2026-08-26-01](2026-08-26-01-full-trail-name-on-click.md)), and `onZoomTo` was
attached there because at the time the name was the only thing you could click.
The row-level handler arrived later, with
[2026-08-26-03](2026-08-26-03-highlight-the-selected-trail.md), and it only ever
selected:

```ts
li.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('input, button')) return;
  this.cb.onSelect(trail.id);
});
```

So the name kept a capability the row it sits in never got.

## Approach

The zoom moved down to the row, rather than being copied up into it:

```ts
li.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('input, button')) return;
  this.cb.onSelect(trail.id);
  this.cb.onZoomTo(trail.id);
});
```

and `.trail-name` was left with the expand/collapse toggle alone. A name click
bubbles to the row, so the title behaves exactly as it always has — it just gets
its zoom from the same place everything else in the row does. Adding a second
`onZoomTo` call to the row instead would have meant two `fitBounds` per name
click, which is the kind of thing that stays harmless right up until `onZoomTo`
grows an animation.

The guard is what makes "the whole row" safe to say: `closest('input, button')`
still exempts the visibility checkbox, the colour swatch and the `×`, which keep
their own meanings and must not drag the view around as a side effect.

Nothing in `main.ts` changed. `onZoomTo` was already
`map.fitBounds(trail.bounds, { padding: [30, 30] })`, and map clicks still route
through `selectTrail()`, which deliberately does not move the map — the
distinction that matters is list-click versus map-click, not name versus row.
You clicked something you could already see; `fitBounds` would pull it out from
under the pointer.
