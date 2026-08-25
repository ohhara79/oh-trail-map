# Filtering the trail list by name

## Context

The sidebar list renders one row per imported GPX, in `addedAt` order, with no
way to narrow it. That is fine at two trails and useless at forty: `.panel-body`
is the panel's only scroller, so finding "the Bukhansan one from May" means
scrolling past everything else, and the row you want may be off-screen while you
are trying to toggle it.

Nothing needed to be fetched. `trails` in `src/main.ts` is already the full
truth, rehydrated from IndexedDB at boot; there is no server to query and no
pagination. `Trail` carries exactly one text field — `name`, resolved by
`readName()` in `src/gpx.ts` from `<trk><name>` or the filename minus `.gpx`. So
the feature is a substring predicate over an in-memory array, plus the UI
consequences of rendering a subset.

Three decisions shape the rest.

**The filter narrows the list only.** Non-matching trails stay drawn on the map.
Search is a lookup tool: nothing you type can change what an export contains,
and the filter never has to be reconciled with the per-trail `visible` flag,
which is the one thing that *does* decide what is on the map.

**Bulk actions scope to what is on screen.** With a query active, the master
checkbox and Expand all act on the matching rows. Filter-then-uncheck becomes
the fast way to hide a group, and the checkbox keeps summarising exactly the
rows beneath it. The alternative — a checkbox labelling three rows but hiding
forty trails — is a trap.

**Matches are highlighted.** Names are frequently the filename fallback, long
and date-stamped, so a match often lands deep inside one; without a mark it is
not obvious why a row survived.

The query is not persisted. `Settings` describes how trails *render*; a filter
restored on boot would present a truncated list as if trails had been lost. Like
panel state, it is per-session chrome.

## Approach

### 1. Matching is a pure helper in `trails.ts`

`searchTokens()` and `matchesTokens()` sit beside `colorOf()` and `weightOf()`,
the file's other "single place that decides X" functions. They are two exports
rather than one predicate so that the list filter and the highlighter tokenise
the query through the same code and can never disagree about what matched.

```ts
function fold(s: string): string {
  return s.normalize('NFC').toLowerCase();
}
```

NFC matters more than case here. `toLowerCase()` is a no-op for Hangul, and the
Latin names it does fold are the easy case. The real failure it prevents is a
GPX exported on macOS: HFS-derived filenames carry decomposed Hangul, so a
stored `북한산` is sixteen code units of jamo and a typed `북한` — six units,
composed — would never substring-match it. Both sides normalise to NFC first.

Matching is token-AND on whitespace, so `bukhan 05` finds
`Bukhansan Ridge Loop 2026-05-14` regardless of order. Deliberately *not*
subsequence/fuzzy matching: at this list size it only invents matches nobody
meant.

### 2. The query lives in the input, and nowhere else

`renderTrails()` reads `this.search.value` at the top of every render. There is
no query field on `Ui`, no filter in `Settings`, and `main.ts` still hands over
the complete `trails` array — the filter is applied at the last possible moment.
A new `onFilterChange` callback points at the existing `refresh()`, so typing
goes through the same path as every other change.

No debounce. `refresh()` also runs `updateEstimate()`, but `planExport()` is
arithmetic over tile counts, and the row rebuild is the same O(n) teardown that
every toggle and recolour already pays.

Four states in `renderTrails()` were derived on the assumption that the array
handed in *is* every trail. Each needed an answer:

- `expandedNames` is still pruned against the **full** array. Pruning against
  the matches would silently forget a name that was expanded and then filtered
  out.
- The search input hides on the **total** count, never the match count.
  Otherwise a query that excludes everything takes its own escape hatch with it.
- `#trail-empty` now carries two messages: `No trails imported yet.` when the
  list is genuinely empty, `No trail matches "…".` when a query emptied it.
- `#trail-count` reads `(3 of 40)` while filtering and `(40)` otherwise, and the
  master checkbox's `checked` / `indeterminate` derive from the matches.

`syncExpandAll()` already counted `this.list.children`, so it followed the
rendered subset with no change at all.

### 3. Bulk toggle reads its ids back off the rows

`onToggleAll` became `(visible, ids)`. The ids are collected from the rendered
`.trail-name` nodes via the `dataset.trailId` that was already there for
`setAllNamesExpanded()` — the same trick, for the same reason: a cached copy of
"what is currently rendered" is a second source of truth waiting to drift from
the DOM it describes.

`main.ts` filters through a `Set` before calling `setVisible()`, whose existing
early return still suppresses redundant IndexedDB writes.

### 4. Escape belongs to the filter first

`Escape` closed the panel from anywhere, so typing a query and reaching for the
usual way to dismiss it would have slammed the whole drawer shut. The handler
now clears a non-empty query when the search input has focus, and only a second
press falls through to `setPanel(false)`.

### 5. Highlighting, and why it renders the NFC form

Folding can change length: NFD→NFC collapses three jamo into one syllable, and a
handful of Latin lowercase mappings grow. Indices taken from the folded haystack
therefore cannot be sliced out of the raw name. So the row renders
`trail.name.normalize('NFC')` — visually identical, and now index-aligned with
its own lowercase copy in every case except the rare length-shifting one (`İ`,
`ẞ`), where `highlightName()` returns plain text rather than mark the wrong
span.

Ranges from all tokens are merged before any `<mark>` is created. Overlapping or
merely touching tokens (`abc` and `bcd` in `abcd`) would otherwise emit two
adjacent marks and draw a seam through contiguous text.

The `title` tooltip and `expandedNames` keep using the raw `trail.name`.

### 6. Markup and styling

One `<input type="search">` above the list — the type earns a native clear
affordance in WebKit and Blink for free. `#trail-search` follows the existing
`select` rule; inside `@media (pointer: coarse)` it grows to `16px`, the
threshold below which iOS Safari zooms the page on focus, which on a phone-first
drawer would be jarring.
