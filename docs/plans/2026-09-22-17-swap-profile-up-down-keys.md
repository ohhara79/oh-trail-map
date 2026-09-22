# Swap Up/Down and PageUp/PageDown on the elevation profile

## Context

On the elevation profile chart, `↑` and `PgUp` stepped the cursor forward, toward the trail's end, and `↓` and `PgDn` stepped it back. That follows the ARIA slider convention, but it felt backwards. On a page, down means further along.

## Change

The step table in the chart's `keydown` handler in `src/profilePanel.ts`:

- `↑` steps one point back and `↓` steps one point forward, like `←` and `→`.
- `PgUp` steps 100 points back and `PgDn` steps 100 forward.

`Home`/`End`, `Shift` ×10 and ◀ ▶ are unchanged. The `?` sheet doesn't list the chart's keys.

## Verification

1. `npm run build` passes.
2. With the elevation chart focused:
   - `↓` and `PgDn` move the cursor toward the end.
   - `↑` and `PgUp` move it back.
   - `Shift` multiplies each step by 10.
