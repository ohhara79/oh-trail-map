# Removing the on-map attribution control

## Context

A screenshot pointed at the small box in the bottom-right corner of the map —
`Leaflet | © OpenStreetMap contributors`, sitting directly under the zoom
buttons — with the request to take it away.

Two readings of that were possible and they are not equivalent. Leaflet's
attribution control renders two different things in one line: its own
self-promotion link (`Leaflet`, injected by the library with no opt-out short of
`setPrefix('')`), and the credit strings each tile layer contributes through its
`attribution` option. Dropping the prefix is routine housekeeping. Dropping the
credits is a licensing decision — OSM's tile usage policy, and the terms behind
OpenTopoMap (CC-BY-SA), CARTO and Esri, all ask for visible credit where their
tiles are displayed. The choice was put to the user explicitly, and the answer
was the whole box.

What makes that defensible rather than merely requested is that the credit was
never only on screen. The exporter has burned a per-source credit into every
PNG and SVG since [2026-08-25-02](2026-08-25-02-thin-trail-lines-in-export.md)
— `drawAttribution(ctx, source.exportCredit, …)` at `src/export.ts:322` for the
raster path, and the same string escaped into a `<text>` element at
`src/export.ts:347` for the vector one. The artefacts that leave this app and
get shared still carry attribution; it is the live view, which nobody but the
operator sees, that loses it.

## Change

1. `src/map.ts:23` — `attributionControl: true` became `false` in the
   `L.map()` options, with a comment recording where the credit went instead.
   Turning the control off at construction is what removes the box; suppressing
   only the prefix (`map.attributionControl.setPrefix(false)`) would have left
   the OSM half behind, which is the other branch of the decision above.

2. `src/map.ts:42` and `src/map.ts:58` — the `attribution: source.attribution`
   / `attribution: next.attribution` options were deleted from both
   `L.tileLayer()` calls, the initial layer and the one `setBasemap()` swaps in.
   With no control mounted these were inert, and leaving them would have implied
   a box that no longer exists. `crossOrigin: 'anonymous'` stays put in both —
   that one is load-bearing for the export path, which reads the canvas back.

3. `src/basemaps.ts` — the `attribution` field was removed from the `Basemap`
   type and from all four entries. `map.ts` was its only consumer, so after
   step 2 it was dead data; TypeScript would not have flagged it, since an
   unread property on an object literal is perfectly legal.

`exportCredit` was deliberately left alone, field and values both. It is the
surviving record of what each source requires, it is still read by both export
paths, and it is the thing a future restoration of the on-map box would be
rebuilt from.

## Files

| File | Change |
|------|--------|
| `src/map.ts` | `attributionControl: false` plus explanatory comment; `attribution` option dropped from both `L.tileLayer()` calls |
| `src/basemaps.ts` | `attribution` removed from the `Basemap` type and from the `osm`, `topo`, `carto` and `esri` entries |

## Verification

1. `npx tsc --noEmit` — passes. This is the real check on step 3: had anything
   besides `map.ts` read `Basemap.attribution`, removing the field would have
   failed the build rather than silently changing behaviour.
2. `grep -rn attribution src/*.ts` — one hit, `attributionControl: false` at
   `src/map.ts:23`. No stray option survives on either tile layer.
3. In the browser: the bottom-right corner holds the zoom control and nothing
   below it, at both panel-open and panel-collapsed widths. Switching basemaps
   through all four options does not resurrect a box, which is the case
   `setBasemap()` would have broken if only the initial layer had been edited.
4. Export a PNG and an SVG on a non-OSM basemap (Satellite is the clearest, its
   credit differing most from the default) and confirm the credit line is still
   drawn — the on-screen removal must not have reached the file.

## Follow-up

- The live map is now out of compliance with the attribution terms of all four
  tile sources. That is the user's call, made knowingly, but it is worth
  restating if this app is ever put in front of anyone other than its author,
  or if the OSM tiles are hit hard enough for the usage policy to be enforced.
- Restoring it is a small, contained revert: flip `src/map.ts:23`, put the
  `attribution` option back on both tile layers, and re-derive the strings from
  the `exportCredit` values that are still in `basemaps.ts` — with links
  re-added, since `exportCredit` is deliberately plain text for canvas drawing.
- Should a middle ground ever be wanted, `#notices`-style placement or a corner
  affordance that reveals the credit on tap would satisfy the licences with far
  less screen furniture than the always-on box.
