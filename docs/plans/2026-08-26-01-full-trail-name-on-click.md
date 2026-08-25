# Reading a trail name that does not fit

## Context

`.trail-name` is clamped to one line with `text-overflow: ellipsis`
(`src/style.css`), which is the right default in a 310 px sidebar — a name is a
row label, not a paragraph. But once clipped, the full text was reachable only
through the native `title` tooltip set in `Ui.renderTrails()` (`src/ui.ts`), and
hover does not exist on touch. This app is deliberately phone-first: a drawer
layout, a `@media (pointer: coarse)` block that enlarges every other target in
the row. So on the primary device there was **no way at all** to read a
truncated name.

Long names are the norm, not the exception. `readName()` in `src/gpx.ts` falls
back to the filename minus `.gpx` when a track carries no `<name>`, and exported
filenames tend to be date- and route-stamped. Korean names make it worse: CJK
offers no word-break opportunities, so the clamp lands mid-word with nothing to
soften it.

## Approach

### 1. Clicking the name unclamps it, and still zooms

The name was already a click target — it calls `onZoomTo`, which is the one
thing a trail row does with the map. Rather than introduce a second affordance
next to it, the same click now does both: it zooms *and* toggles the name
between the clamped single line and the full text wrapped over as many lines as
it needs. Clicking again re-collapses. Re-zooming to a trail you are already
looking at is a no-op in practice, so the double duty costs nothing.

```css
.trail-name.expanded { white-space: normal; overflow: visible; overflow-wrap: anywhere; }
```

`overflow-wrap: anywhere` is for the filename fallback, which is frequently one
unbroken token; Korean wraps on its own. Nothing else in the row needed
changing: `#trail-list li` is `display: flex; align-items: center`, so the
checkbox, swatch and × stay centred against a taller text block.

### 2. Expanded ids live on `Ui`, not on the row

`renderTrails()` opens with `this.list.replaceChildren()`, so per-row state held
in the DOM is destroyed by every visibility toggle, recolor, import and remove —
the same constraint that produced the `scrollTop` save/restore in
`2026-08-25-07-desktop-trail-list-parity.md`. A `Set<string>` of expanded ids on
`Ui` survives the rebuild, and `renderTrails()` reapplies the class as it builds
each row. Ids for trails that no longer exist are pruned at the top of the
rebuild, so a long session of imports and removals cannot accumulate them.

The click handler flips the class on the element directly and updates the `Set`;
it does not re-render. The `Set` is there to reproduce the state next time
something *else* triggers a rebuild.

### 3. One header toggle for the whole list

The list header already carries a whole-list control — the show/hide-all
checkbox — so `#trail-expand-all` sits beside it, at the end of `.trail-head`.
One button rather than a pair: its label states the action it will perform, the
way `#collapse` / `#expand` already do for the panel. Label and visibility are
derived from the rows on every render and every toggle, so they cannot drift
from what is on screen:

```ts
const total = this.list.children.length;
this.expandAll.hidden = total === 0;
this.expandAll.textContent =
  total > 0 && this.expandedNames.size >= total ? 'Collapse all' : 'Expand all';
```

A partly expanded list reads *Expand all* and finishes the job — the same
reading as the tristate master checkbox above it, where `indeterminate` still
means "clicking me shows everything". `setAllNamesExpanded()` walks the rendered
`.trail-name` nodes (each now carrying `dataset.trailId`) rather than
re-rendering, which keeps the panel's scroll offset untouched and spares `Ui`
from caching a copy of the trail array it does not otherwise own.

No callback was added to `UiCallbacks` and `src/main.ts` is untouched: which
names are expanded is panel chrome, not a rendering choice that belongs in
`Settings` or IndexedDB.

## Verification

`npm run build` clean (typecheck + bundle). In the browser with the `samples/`
GPX files plus a copy renamed to a long unbroken filename, at desktop width and
at 390×844 in the drawer: a clipped name wraps to full text on click and the map
zooms to it; a second click re-collapses. Two names stay open at once, and stay
open across a visibility toggle, a color change, an import, and the removal of a
different row, with the panel holding its scroll position. The header button
reads *Expand all* until the last name is open, then *Collapse all*; it
disappears with the master checkbox when the list is empty.
