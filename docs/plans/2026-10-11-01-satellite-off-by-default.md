# Satellite off by default

## Context

The Satellite basemap streams Esri World Imagery from `server.arcgisonline.com`.
Its terms don't fit a public release, so the public build should not offer it.
It should come back by flipping one setting, not by restoring deleted code.
OSM Standard and OpenTopoMap are already local tiles (see
`2026-10-10-04-local-map-tiles.md`), so they are unaffected.

## Change

1. **`src/basemaps.ts`:** add `export const SATELLITE_ENABLED = false;`. Rename the
   list to `ALL_BASEMAPS` and leave the Esri entry in it. Export
   `BASEMAPS = ALL_BASEMAPS.filter((b) => b.id !== 'esri' || SATELLITE_ENABLED)`.

2. **No other code changes.** Everything reads `BASEMAPS` or goes through `basemapById`:
   - The basemap radios (`src/ui.ts:88`) loop over `BASEMAPS`.
   - The keyboard cycle (`nextBasemap`, `src/main.ts:429`) indexes `BASEMAPS`.
   - A saved `basemapId: 'esri'` resolves to `BASEMAPS[0]` (OSM) through `basemapById`.
     This applies in the radios (`src/ui.ts:170`), the 2D map (`src/map.ts:65`) and the 3D view.

3. **`README.md`:** the basemap-switcher bullet says Satellite is off by default and
   names the switch.

## Files

| File | Change |
|---|---|
| `src/basemaps.ts` | `SATELLITE_ENABLED` flag; `BASEMAPS` filters out `esri` while it is false |
| `README.md` | Says how to turn Satellite back on |

## Verification

1. `npm run build` passes.
2. `npm run dev`: the basemap panel lists only OSM Standard and OpenTopoMap, and the basemap
   shortcut cycles between those two. The Network tab shows no requests to `arcgisonline.com`.
3. In a browser whose saved basemap was Satellite, reload. You get OSM, with its radio checked, in 2D and 3D.
4. Set `SATELLITE_ENABLED = true` and reload. Satellite is back in the radios and the cycle, and it loads.

## Follow-up

- The Esri URL string still ships in the bundle. It is just never requested. To drop it from
  the build entirely, make the flag a build-time define (e.g. `import.meta.env`) so the
  bundler removes the dead entry.
