# Remove export, Carto Light, the trail-width slider and uniform colour

## Context

Four features are hardly used, and each one drags code and prose through several files:

- **Export (PNG and SVG).** `src/export.ts` (448 lines) plus the Export block in the
  panel, the estimate/progress plumbing in `ui.ts` and `main.ts`, and export-only helpers
  in `points.ts`, `gpx.ts`, `basemaps.ts` and `map.ts`.
- **Carto Light**, one of four basemaps.
- **The "Trail width" slider.** Trails are drawn at a fixed **2 px** instead.
- **"Use one color for all trails".** Every trail keeps its own colour, always.

**No attribution comes back.** Credits were only ever burned into exports (the on-map
control went in [2026-08-26-05](2026-08-26-05-remove-map-attribution-control.md)), so with
export gone the map shows no credit anywhere. `exportCredit` is deleted, not repurposed.

After this, `Settings` is just `{ basemapId, showPoints }`.

## Change

1. **`index.html`** — the uniform-colour / width section and the Export section are gone.
   The panel is Import → Trails → 국가지점번호 → Basemap.

2. **`src/export.ts`** — deleted.

3. **`src/trails.ts`** — `Settings` drops `uniformColor`, `uniformColorValue`,
   `trailWeight`. `DEFAULT_TRAIL_WEIGHT` / `TRAIL_WEIGHT_MIN` / `TRAIL_WEIGHT_MAX` and
   `weightOf()` become `export const TRAIL_WEIGHT = 2`. `colorOf()` is gone; strokes read
   `trail.color`. `buildTrail()` and `restyleTrail()` no longer take `settings`.

4. **`src/selection.ts`** — `Halo.show(trail)` drops `settings` and pads `TRAIL_WEIGHT`
   (casings 12 px and 8 px).

5. **`src/main.ts`** — `onUniformChange`, `onTrailWidthChange`, `onExport`,
   `onExportOptionChange`, `updateEstimate()`, `runExport()` and the
   `zoomend moveend resize` listener removed; call sites follow the new signatures.

6. **`src/ui.ts`** — the matching callbacks, element fields, listeners, `emitUniform()`,
   `exportSelection()`, `showEstimate()`, `setExporting()` and `setProgress()` removed.
   `renderTrails(trails, selectedId)`: the per-row swatch is never disabled.
   `applySettings()` checks the radio for `basemapById(settings.basemapId).id`, so a browser
   that had Carto saved shows OSM checked — the fallback `createMap` actually loads.

7. **`src/basemaps.ts`** — `carto` entry, `exportCredit` and `tileUrl()` (export-only)
   removed.

8. **`src/map.ts`** — `crossOrigin: 'anonymous'` dropped from both tile layers (it was only
   there so the exporter could read tiles back from a canvas); `MapHandle.source` removed,
   nothing reads it. `zoomSnap: 1` stays so zoom behaviour does not change.

9. **`src/points.ts`** — export-only `pinColor`, `namedLast`, `PIN_OUTLINE`,
   `PIN_OUTLINE_WIDTH` removed; the remaining pin constants are module-private.

10. **`src/gpx.ts`** — `simplify()` removed (its only caller was the SVG exporter).

11. **`src/store.ts`** — `loadSettings()` returns only `basemapId` and `showPoints`, so the
    stale keys already in IndexedDB vanish on the next `saveSettings()`.

12. **`src/style.css`** — dead rules removed: range/output in `.row`, `button.primary`,
    `select`, `label.grow`, `input[type='color']:disabled`, `.progress`, and their
    coarse-pointer overrides. Casing comments no longer cite Carto Light.

13. **`README.md`** — export sections, width / uniform / export bullets and the export-scale
    note removed; basemap list is OSM Standard, OpenTopoMap, Esri satellite.

## Files

| File | Change |
|---|---|
| `src/export.ts` | deleted |
| `index.html` | colour/width and Export sections removed |
| `src/trails.ts` | `Settings` slimmed; `TRAIL_WEIGHT = 2`; `colorOf`/`weightOf` gone |
| `src/main.ts`, `src/ui.ts` | export, uniform and width wiring removed |
| `src/selection.ts` | halo uses `TRAIL_WEIGHT` |
| `src/basemaps.ts` | Carto, `exportCredit`, `tileUrl` removed |
| `src/map.ts` | `crossOrigin` and `MapHandle.source` removed |
| `src/points.ts`, `src/gpx.ts` | export-only helpers removed |
| `src/store.ts` | stale settings keys dropped on load |
| `src/style.css` | dead rules removed |
| `README.md` | features updated, export docs removed |

## Verification

1. `npm run build` passes (`noUnusedLocals` / `noUnusedParameters` are on, so every
   orphaned helper and parameter would fail it).
2. `grep -rniE "planExport|exportCredit|carto|uniform|trailWeight|weightOf|colorOf|simplify|namedLast|pinColor|PIN_OUTLINE|trail-width|progress|crossOrigin|tileUrl" src index.html`
   → only the explanatory comment in `store.ts`.
3. Headless Chrome over CDP against `vite preview`, with IndexedDB seeded as
   `{basemapId:'carto', showPoints:true, uniformColor:true, uniformColorValue:'#000000', trailWeight:8}`:
   - Panel sections: Import GPX files, Trails, 국가지점번호, Basemap; no `#export-*`,
     `#uniform-toggle` or `#trail-width` in the DOM.
   - Radios `osm*, topo, esri`; tiles load from `tile.openstreetmap.org`.
   - Importing `samples/bukhansan-loop.gpx` draws `stroke="#e6194b" stroke-width="2"` —
     its own palette colour, not the stored uniform black, at 2 px not 8. Swatch enabled.
   - After toggling points, the stored settings are `{basemapId:'carto', showPoints:true}`.
   - Selecting the trail gives halo casings at 12 / 8 px under the 2 px stroke.
   - No console errors or exceptions.

## Follow-up

- With no credit shown anywhere, OSM / OpenTopoMap / Esri attribution terms are not met.
  If the app is ever published beyond personal use, restore a credit — the old
  `exportCredit` strings are in git history.
- A stored `basemapId: 'carto'` is left as is; it resolves to OSM on every load and is
  overwritten the first time a basemap is picked.
