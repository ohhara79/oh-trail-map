# Expand a national point row, and drop the doubled 지점번호

## Context

`2026-09-16-12-national-point-list.md` argued **No Expand all** for the point list, and
`style.css` repeated the argument in a comment. Its load-bearing sentence was *"The 지점번호 line
is fixed-width and never overflows"*. That was true when it was written: the title line was the
bare 지점번호, ten characters wide on every one of the 272 rows.

The very next commit, `2295b65`, put 이름 in front of it. The longest 이름 in
`data/national_points_w_name.tsv` is 14 Hangul characters; with ` - 다사52414090` after it, a
title runs to some 26 characters, which a 320px drawer clips every time. The premise did not
survive the commit that followed it, so neither does the conclusion. This document reverses that
decision on the record rather than quietly.

The same commit is why 128 of the 272 rows read `다사50863802 - 다사50863802`. `PointRow.title`
defended repeating the code so that every row kept the same two-part shape and the 지점번호 — the
one thing a sign in the field actually shows you — always landed in the same place. A row with
nothing before the dash has no two parts to line up, and now that width is what the title runs
out of, the repeat is paying rent twice for the same string.

Two decisions were taken before any of it was written:

1. **Expanding unclamps both lines, not just the title.** `.point-detail` — 사물유형 · 시/도
   시/군/구, up to 44 characters — is clipped as often as the title is. Unclamping only the title
   would leave the row half-readable and send the reader to the popup anyway, which is the
   outcome the button exists to avoid. This is where the point list departs from the trail list,
   whose `.trail-stats` is a short generated line that never needs it.
2. **A title click toggles that one row, and still bubbles.** Exactly what `.trail-name` does in
   `ui.ts`: the row's own handler goes to the point and opens its popup, and the title handler
   adds the unclamp on top. Nothing is scoped away, and nothing calls `stopPropagation`.

The second argument the old decision rested on — that the full text is one hover away in a
`title` attribute — was always weakest exactly where the list is tightest. The drawer is a phone,
and a phone has no hover.

## Change

### `points.ts` — the title of an unnamed row

```ts
const title = (point.name ? `${point.name} - ${point.code}` : point.code).normalize('NFC');
```

The `normalize('NFC')` sits outside the ternary so both arms get it: the indices `highlightName`
computes have to address the string that is drawn, whichever arm produced it.

`haystack` is unchanged and needs no thought — an unnamed row now carries its code once instead
of twice, and `matchesFolded` only ever asked whether a token occurs. Its comment about the
doubling goes with the doubling.

### `index.html` — the button

`#point-expand-all` into `.point-head` after the `<h2>`, mirroring `#trail-expand-all`.

### `pointsList.ts` — the state, the toggle and the button

`private readonly expanded = new Set<string>()`, holding the 지점번호 of every row drawn in full.
Not on the elements: `rebuild()` replaces every `<li>` whenever the filter changes.

**Never pruned**, unlike `ui.ts`'s `expandedNames`. Trails are files that come and go, so a stale
id there is real; `rows` is a module constant fixed at boot, so a code in this set always still
names a row. The trail list's shape invites the question, so the answer is in a comment.

`rebuild()` stamps `li.classList.toggle('expanded', …)` on the row — **one class on the `<li>`**,
not one on each line, so a single CSS rule reaches both and they can never end up half-expanded —
and hangs the toggle off the title, with `ui.ts`'s reasoning for toggling unconditionally rather
than measuring `scrollWidth` first.

`syncExpandAll()` runs at the end of `render()`, after `syncChecks` and on both paths: the filter
changes how many rows are on screen, so the label has to be re-derived even when `sameRows`
skipped the rebuild.

Two deliberate differences from `ui.ts:301-325`, both commented where they land:

- **The count comes from the rendered rows, not `expanded.size`.** With 272 rows and a
  five-column filter it is ordinary to expand three rows and then filter to a fourth; the set's
  size would then offer "Collapse all" over a row that is still clipped. The button acts on what
  is on screen, so it must be labelled from what is on screen.
- **`setAllExpanded` does not `clear()` the set first.** Scoping it to the rendered rows is what
  keeps a row expanded, filtered away and then brought back still expanded — the behaviour
  `ui.ts` describes wanting and gets from its prune instead.

No `PointsListCallbacks` entry and no `main.ts` change: expansion is panel chrome, not state the
map or IndexedDB has any use for. `2026-08-26-01-full-trail-name-on-click.md` made the same call.

### `style.css`

```css
#point-list li.expanded :is(.point-title, .point-detail) {
  white-space: normal; overflow: visible; overflow-wrap: anywhere;
}
```

`anywhere` because a 지점번호 and a 시/군/구 are single unbroken tokens with nowhere else to
break — the same reason `.trail-name.expanded` carries it for the filename fallback.

`.point-head button` joins `.trail-head button` in the two rules that style it, including the
`min-height: 32px` under `@media (pointer: coarse)`. Both selectors already pair the two heads
elsewhere in the file.

`cursor: pointer` goes on `#point-list .point-title` in CSS, where `ui.ts` sets it inline on
`.trail-name`; the rule was being edited anyway.

### `listUi.ts`

Its header listed expand-all among the things that are "the trail list's alone". Now that both
lists have one, it says instead why there is still no shared helper: the trail list clamps one
line and prunes a changing set of ids, the point list clamps two off one class and never prunes a
fixed one. What they share is the label, and a label is not worth a function.

## Verification

`npm run build`, then `npm run dev`:

1. Filter `다사508` — rows read `다사50863802` once, and the `<mark>` still lands on the digits.
2. Click a long title (`학바위`) — both lines unclamp, the map flies there, the popup opens and
   the row takes the `.selected` tint. Click again: it re-clamps, popup stays.
3. **Expand all** with no filter — all 272 unclamp, the panel does not jump to the top, the label
   becomes **Collapse all**.
4. Filter, Expand all, clear the filter — only the matches expanded, they stay expanded, and the
   label is back to **Expand all**.
5. A checkbox click collapses nothing; the master stays tri-state and filter-scoped; Escape in
   the filter still clears it, then closes the drawer.
6. On a coarse pointer, the button is 32px and an expanded row wraps inside the drawer.
