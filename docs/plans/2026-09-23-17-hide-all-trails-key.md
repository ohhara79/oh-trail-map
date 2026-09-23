# `T` hides or shows every trail

## Context

`H` turns every national point off, or back on if they already are. The user
wants the same for trails. `T` is free, and stands for "trails".

It reads like the list's master checkbox: all off while any is on, else all on.
Like `H`, it reaches every trail, not only the rows the filter shows.

## Change

1. **`src/shortcuts.ts`** — `toggleTrails` in `ShortcutCallbacks`, bound to `KeyT`.
2. **`src/main.ts`** — `toggleTrails` sets every trail's visibility with
   `setVisible`, then `restyleAll()` and `refresh()`, as the list's
   `onToggleAll` does; `refresh()` keeps the master checkbox in step.
3. **`index.html`** — a `T` line on the shortcuts sheet, under `H`.

## Verification

1. `npm run build` passes.
2. `T` hides every trail and clears the list's checkboxes; again shows them all.
3. With some trails off by hand, `T` turns off the rest; again turns all on.
4. Same in 3D; typing `t` in the filter box still types.
5. `?` lists `T`.
