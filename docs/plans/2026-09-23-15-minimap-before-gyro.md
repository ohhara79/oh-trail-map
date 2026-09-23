# Minimap before gyro in the 3D walk bar

## Context

The 3D walk bar (`#mode3d`) read eye height · walk · gyro · minimap. The user
wants the minimap and gyro buttons swapped, so it reads eye height · walk ·
minimap · gyro.

## Change

1. **`index.html`** — move the `#minimap3d` button (and its comment) above
   `#gyro3d` inside `#mode3d`.

Nothing depends on the order: `src/style.css` styles the buttons by id/class
(`#mode3d .hud-icon`, `.walk-only`) with no `:nth-child` or sibling selectors;
`src/hud3d.ts` and `src/ui.ts` look them up by id; the `M` shortcut
(`src/shortcuts.ts:42`) targets `minimap3d` by id.

## Verification

1. `npm run build` passes.
2. Open the 3D view and walk: the bar shows eye · walk · minimap · gyro;
   the minimap button (and `M`) still toggles the corner map, and gyro still
   toggles the phone look.
