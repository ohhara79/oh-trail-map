# Turn off text selection outside the panel

## Context

On a phone, a long press on the map chrome selects text and opens the
Copy/Look-up callout: the ▶ on the selection bar, the elevation panel's
bottom-left label, the national point popup. These are controls and read-outs
over a map, not text anyone copies, and the callout gets in the way of the
press (many of them are held or dragged). Only one spot already opted out: the
profile's ◀ ▶. The panel (hamburger menu) is different: its trail and point
names, and the author's email / homepage, are worth copying, so it keeps
selection.

## Change

1. **`src/style.css`**, next to the `#app` rule:
   - `#app { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }`
     — covers the floating buttons, selection bar, playback bar, profile panel,
     readout, notices, Leaflet and MapLibre popups (all inside `#app`).
   - Give it back where text is meant to be read or typed:
     `:is(#sidebar, #shortcuts, input, textarea) { user-select: text; … -webkit-touch-callout: default; }`
     - `#sidebar` — the panel.
     - `#shortcuts` — the `?` sheet, opened from the panel; a reference to read.
     - `input`, `textarea` — iOS Safari can refuse typing under an inherited
       `-webkit-user-select: none`.
2. Drop the now-inherited `user-select … -webkit-touch-callout` line from
   `#profile .profile-side button` (keep `touch-action: none`).
3. README: no user-facing wording to change.

## Verification

1. `npm run build` passes.
2. Headless Chrome over CDP against `vite preview`:
   - computed `user-select` is `none` on `#selection-walk`, `#profile-ele-min`,
     `#readout`, `#map`; `text` on `#trail-list li`, `#about-email`,
     `#trail-search`, `#shortcuts dd`;
   - selecting `#profile-ele-min`'s contents or drag-selecting
     `#selection-stats` gives an empty selection (before: "150 m", "8.5 km");
   - typing in `#point-search` still filters.
