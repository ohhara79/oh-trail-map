# Desktop: one panel scroller, like the drawer

## Context

Two complaints, both desktop-only, both from the same pair of rules:

* Picking a trail scrolled the list back to the top. `Ui.renderTrails()` starts
  with `this.list.replaceChildren()` (`src/ui.ts`), and on desktop `#trail-list`
  was itself a scroll container (`overflow-y: auto`). Emptying a scroll container
  drops its `scrollTop` to 0, so every re-render — visibility checkbox, show/hide
  all, uniform-color toggle, remove — snapped the list to the top. The drawer
  never showed it because there `#trail-list` is `overflow-y: visible` and
  `.panel-body` is the only scroller, which the rebuild does not touch.
* Only a row or two of the list was visible behind a scrollbar, where the drawer
  shows the whole list. `.grow-block { flex: 1; min-height: 0 }` expands to
  `flex-grow: 1; flex-shrink: 1; flex-basis: 0%`, so the trails section
  contributed *nothing* to layout and received only the height left over by the
  import, colors, basemap and export blocks — a few dozen pixels on a laptop.
  (That shorthand also re-introduced `flex-shrink: 1` over the `flex-shrink: 0`
  from `2026-08-25-05-small-screen-trail-list.md`, so the guard that plan added
  never reached the one element it was written for.)

`2026-08-25-05-small-screen-trail-list.md` gave the drawer a single scroller and
justified keeping the nested one on desktop as absorbing *spare* height. In
practice there is no spare height: the fixed blocks run to roughly 500 px against
a ~700 px viewport. The drawer's layout is simply the better one, so this plan
promotes it to every width and drops the desktop special case.

## Approach

### 1. The trails section renders at its natural height everywhere

```css
.grow-block { flex: 0 0 auto; display: flex; flex-direction: column; }
#trail-list { list-style: none; margin: 0; padding: 0; }
```

Both rules move out of `@media (max-width: 720px), (max-height: 480px)` and into
the base layer, and the drawer's now-duplicate overrides are deleted. With
`flex: 0 0 auto` the section neither grows nor shrinks, so `.panel-body` —
already `flex: 1; min-height: 0; overflow-y: auto` — is the one scroller in the
panel, and Basemap and Export sit below the full list instead of pinning it into
a sliver. `DRAWER_QUERY` in `src/ui.ts` still matches the query it documents; the
drawer keeps its slide and overlay rules.

### 2. The panel keeps its scroll offset across a re-render

```ts
const scroll = this.panelBody.scrollTop;
this.list.replaceChildren();
// … rebuild rows …
this.panelBody.scrollTop = scroll;
```

Removing the nested scroller already fixes the reported jump, but the invariant
is worth stating rather than inheriting: a rebuild that shortens the list still
moves the panel otherwise. An offset past the new end is clamped by the browser,
which is what a shorter list should do. `.panel-body` gains an `id` in
`index.html` so it can be looked up with the existing `el()` helper like every
other node in `Ui`.

## Verification

`npm run build` clean. In the browser at desktop width with several `samples/`
GPX files imported: the whole list renders, the panel scrolls as one, and
toggling or removing a row mid-list leaves the view where it was. Under 720 px
the drawer is unchanged.
