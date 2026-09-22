# List the elevation chart's keys in the `?` sheet

## Context

The elevation profile chart answers its own keys once it has focus (`src/profilePanel.ts`), but the `?` sheet only listed the global `,` `.` stepping. The chart's keys get their own section.

## Change

1. `index.html` (the `?` sheet): an "Elevation profile" section between "Anywhere" and "2D map":
   - `←` `→` (or `↑` `↓`): previous / next GPX point, `Shift` for 10
   - `PgUp` `PgDn`: back / forward 100 points, `Shift` for 1000
   - `Home` `End`: first / last point
2. `README.md`: a matching row in the shortcut table.

## Verification

1. `npm run build` passes.
2. `?` shows the new section, laid out like the others.
3. With the chart clicked, each listed key does what the sheet says.
