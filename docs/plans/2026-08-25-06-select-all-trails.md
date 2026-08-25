# Select all / deselect all in the trail list

## Context

Every trail in the sidebar list has its own visibility checkbox, and that was
the only way to change what the map shows. With several GPX files imported,
isolating one trail — or clearing the map before an export — meant clicking each
row in turn, and the count of clicks grew with the import. The app had no bulk
action of any kind.

There is no separate "selection" concept here to hang this off: the per-trail
`visible` flag (`src/trails.ts:9`) is what drives the map layer, `visibleBounds()`
and the export's `trails.filter((t) => t.visible)` alike. So the bulk control
toggles `visible`, and everything downstream keeps working untouched.

The chosen shape is one tri-state master checkbox in the `TRAILS` heading,
sitting in the same column as the per-row checkboxes: checked = all shown,
unchecked = all hidden, dash = mixed. Clicking it while mixed shows all, which
is what a native checkbox does anyway.

## Change

### 1. A header row for the master checkbox

`index.html` — the bare `<h2>` in the trails section becomes a flex row built
from the existing `.row` / `.grow` utilities:

```html
<div class="row trail-head">
  <input id="trail-all" type="checkbox" title="Show or hide every trail" ... />
  <h2 class="grow">Trails <span id="trail-count" class="muted"></span></h2>
</div>
```

The checkbox lives in the static markup rather than inside `<ul id="trail-list">`
deliberately: `renderTrails` calls `this.list.replaceChildren()` on every render
(`src/ui.ts:161`), so a control built into the list would be destroyed and lose
focus on each toggle — the very interaction it exists to serve.

### 2. Styling

```css
.trail-head { margin-bottom: 8px; }
.trail-head h2 { margin: 0; }
```

`.block h2` carries `margin: 0 0 8px`, which inside a flex row with
`align-items: center` unbalances the row; the spacing moves to the row itself.
`.row`'s `8px` gap already matches `#trail-list li`'s, so the master checkbox
lands in the same column as the per-row ones with no extra rule.

The `@media (pointer: coarse)` arm sized only `#trail-list li input`, so
`.trail-head input[type='checkbox']` joins that selector and gets the same 20 px
touch target.

The row adds ~20 px inside `.grow-block`. That is safe since
`2026-08-25-05-small-screen-trail-list.md` made `.block` `flex-shrink: 0` — the
panel scrolls instead of crushing the list.

### 3. Tri-state, derived not tracked

`src/ui.ts` gains `onToggleAll: (visible: boolean) => void` on `UiCallbacks`, a
`toggleAll` element handle, and a `change` listener that forwards
`this.toggleAll.checked`.

The state of the master checkbox is computed at the top of `renderTrails()`,
alongside the existing `trail-count` / `trail-empty` updates, from the same
`trails` array the rows are built from — so the header cannot drift from what is
below it:

```ts
const shown = trails.filter((t) => t.visible).length;
this.toggleAll.hidden = trails.length === 0;
this.toggleAll.checked = trails.length > 0 && shown === trails.length;
this.toggleAll.indeterminate = shown > 0 && shown < trails.length;
```

`indeterminate` is assigned on every render, including back to `false`: it is a
DOM property rather than an attribute, and does not clear itself when `checked`
changes. `hidden` rather than `disabled` when the list is empty — the section
already says "No trails imported yet.", and a dead checkbox above that line
reads as broken.

### 4. One visibility mutation, two callers

The body of the `onToggle` handler moved into a `setVisible(trail, visible, map)`
helper in `src/main.ts`, so the single-row checkbox and the master checkbox share
one definition of what "visible" means:

```ts
function setVisible(trail: Trail, visible: boolean, map: L.Map): void {
  if (trail.visible === visible) return;
  trail.visible = visible;
  if (visible) trail.layer.addTo(map);
  else map.removeLayer(trail.layer);
  void putTrail(toRecord(trail));
}
```

The new handler follows the shape of the other whole-list handlers
(`onUniformChange`, `onTrailWidthChange`): loop, then a **single** `refresh()`,
rather than re-rendering the list once per trail.

```ts
onToggleAll: (visible) => {
  for (const trail of trails) setVisible(trail, visible, map);
  refresh();
},
```

The early return matters for the bulk path: `putTrail` opens one IndexedDB
transaction per record (`src/store.ts:64-66`), so skipping trails that already
agree keeps "show all" free when only one row was off.

## Files

| File | Change |
| --- | --- |
| `index.html` | `.trail-head` row wrapping `#trail-all` and the `Trails` heading |
| `src/style.css` | `.trail-head` alignment; master checkbox in the `pointer: coarse` arm |
| `src/ui.ts` | `onToggleAll` callback, `#trail-all` binding, tri-state sync in `renderTrails` |
| `src/main.ts` | `setVisible()` helper; `onToggle` reuses it; `onToggleAll` handler |

## Verification

1. `npm run build` — `tsc --noEmit` passes. `UiCallbacks` is strictly typed, so
   a `main.ts` that forgot `onToggleAll` would fail the build.
2. `npm run dev`, import both files from `samples/`.
3. Uncheck one row — the master checkbox shows the indeterminate dash.
4. Click the master checkbox — both trails appear, both rows check.
5. Click again — both trails leave the map, both rows uncheck, and the export
   estimate still renders.
6. Reload — the hidden/shown state survives IndexedDB, and the master checkbox
   returns in the matching state.
7. Remove every trail — the master checkbox disappears, leaving only
   "No trails imported yet." under the heading.
8. At 390×844 and in a ~560 px-tall desktop window, confirm the extra header row
   did not re-collapse the list: rows still visible, panel still scrolls to the
   Export button.
