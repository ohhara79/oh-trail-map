# Click "Trails (#)" to toggle every trail

## Context

Clicking the text "Show National Point Numbers" toggles its checkbox, because the
text and the checkbox share a `<label>`. The "Trails (#)" heading beside the
show/hide-all checkbox (`#trail-all`) was a plain `<h2>`, so clicking it did nothing.
Now it behaves like the points label.

## Change

1. **`index.html`**: the heading's contents are wrapped in
   `<label for="trail-all">`. The label sits inside the `<h2>` rather than around it,
   because a `<label>` may only contain phrasing content. A click on the label goes
   to the checkbox and fires its existing `change` listener (`src/ui.ts`), so the
   click only affects the rows the filter shows. An indeterminate checkbox becomes
   fully checked, the same as clicking the box. No TypeScript changes.
   - The checkbox keeps its `aria-label`, which says more than "Trails (12)".
   - When nothing matches, the checkbox is `hidden`. A click on the label then calls
     `onToggleAll` with no ids, which does nothing.
2. **`src/style.css`**: unchanged. The points label has no pointer cursor either.

## Verification

1. `npm run build`: the typecheck and build pass.
2. `npm run dev`, open the panel:
   - Click "Trails (#)": every trail hides. Click again: they all come back.
   - Uncheck one trail, then click the heading: all trails show.
   - Type a filter, then click the heading: only the matching trails change.
   - "Expand all" still only expands names.
