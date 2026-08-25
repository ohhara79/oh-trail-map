# GPX trail map web app with high-resolution export

## Context

`oh-trail-map` started as an empty directory holding only `plan.txt`, which
asked for a browser app that shows an OpenStreetMap basemap with the user's
current location, imports multiple GPX files, overlays and individually toggles
their trails, and exports the current view as a high-resolution PNG or SVG.

The last requirement is the one that shapes the architecture. The obvious
approaches — `html2canvas`, `leaflet-image`, a `preserveDrawingBuffer`
screenshot — are all capped at the device pixel ratio and merely magnify the
blurry tiles already on screen. "High resolution" then means an upscale, not
more detail, which is useless for print.

The approach that actually works is to re-render the visible bounding box
off-screen at a **higher tile zoom level**, so the tile server hands back
genuinely more detailed imagery. That has one hard prerequisite: every tile
source must send `Access-Control-Allow-Origin: *`, or the canvas is tainted and
`toBlob()` throws. This was verified by request before committing to the design
— `tile.openstreetmap.org`, `a.tile.opentopomap.org`, `basemaps.cartocdn.com`,
and `server.arcgisonline.com` all qualify.

Everything runs client-side. No backend, no API keys, `dist/` is static.

Scope beyond the five listed requirements — per-trail colour and stats, browser
persistence, a basemap switcher, and a uniform-colour mode — was requested
during planning and kept deliberately lean (no settings screens, no charts).

## Approach

### 1. Stack

Vite + vanilla TypeScript + Leaflet 1.9. Runtime dependencies: `leaflet` only.
GPX parsing uses the built-in `DOMParser`, persistence a small hand-rolled
IndexedDB wrapper, export a plain `<canvas>`.

### 2. `src/basemaps.ts` — tile source registry

Four keyless, CORS-clean sources: OSM Standard (maxZoom 19, no `{s}`
subdomains — deprecated for OSM), OpenTopoMap (maxZoom 17, subdomains `abc`),
Carto Light (cleanest background for print), and Esri World Imagery. Esri uses
`{z}/{y}/{x}` rather than the usual axis order, so the registry stores whole
templates and `tileUrl()` (`src/basemaps.ts:59`) stays generic. Each entry
carries an `exportCredit` string for burn-in.

### 3. `src/map.ts` — map and geolocation

`createMap()` (`src/map.ts:10`) pins `zoomSnap: 1`. This matters: the exporter
derives its tile zoom as `z + log2(scale)`, and fractional zoom would make "4×"
not mean exactly 4×.

`startLocating()` (`src/map.ts:58`) uses `watchPosition` with a `circleMarker`
plus an accuracy `L.Circle`. Permission denial, a missing API, and an insecure
context each surface a notice and leave the map usable — location never blocks
boot.

### 4. `src/gpx.ts` — parsing, stats, simplification

`parseGpx()` (`src/gpx.ts:124`) checks for `parsererror`, then walks
`trk`/`trkseg`/`trkpt` and also `rte`/`rtept`, since some exporters emit only
routes. All queries use `getElementsByTagNameNS('*', …)` so GPX 1.0 and 1.1
both work regardless of namespace prefix.

`computeStats()` (`src/gpx.ts:77`) accumulates elevation against a *moving
reference* rather than point-to-point, with a 3 m threshold
(`ELE_NOISE_THRESHOLD`, `src/gpx.ts:20`). Without this, barometric jitter is
counted as climbing and the reported ascent is wildly inflated.

`simplify()` (`src/gpx.ts:167`) is Douglas-Peucker on projected pixels with an
explicit stack — recursion blows up on tracks with 100k+ points. Used only for
SVG export; the on-screen polylines keep full fidelity.

### 5. `src/trails.ts` — trail model and the single colour resolver

`colorOf(trail, settings)` (`src/trails.ts:45`) is the **only** place a stroke
colour is decided:

```ts
const colorOf = (t: Trail, s: Settings) =>
  s.uniformColor ? s.uniformColorValue : t.color;
```

The Leaflet layers, the PNG canvas, and the SVG paths all read through it, so
uniform-colour mode cannot drift between what is on screen and what lands in
the exported file. It *overrides* rather than overwrites: each trail keeps its
own `color`, so unchecking the box restores the individual colours.
`restyleTrail()` (`src/trails.ts:90`) reapplies the resolved colour.

### 6. `src/store.ts` — persistence

IndexedDB, two stores (`trails` keyed by id, `settings` under a single key).
localStorage is not viable — its ~5 MB quota is easily blown by a handful of
GPX files, and the raw GPX text is kept verbatim so a trail can be re-parsed
and re-exported exactly as imported.

### 7. `src/export.ts` — the core feature

`planExport()` (`src/export.ts:62`) computes, without doing any work:

    tileZoom      = min(round(map zoom) + log2(scale), source.maxZoom)
    achievedScale = 2 ** (tileZoom - map zoom)
    W, H          = project(SE, tileZoom) - project(NW, tileZoom)

and refuses up front with a specific message when `W`/`H` exceeds the ~16000 px
browser canvas limit (`src/export.ts:15`), when the area is too large, or when
the tile count exceeds 1500 (`src/export.ts:17`) — rather than producing a
blank image. When the requested scale exceeds the basemap's max zoom
(OpenTopoMap stops at 17) it clamps and reports the scale actually achieved.

`exportView()` (`src/export.ts:249`) composites tiles at 6 concurrent
(`TILE_CONCURRENCY`, `src/export.ts:18`) with one retry, drawing a light-grey
square for a tile that never arrives so one dead tile cannot kill the export.
Tiles are memoised in a module-level cache (`src/export.ts:47`), making a
repeat export of the same view free. Trails are re-projected at `tileZoom` and
drawn with `lineWidth = 4 * achievedScale` so relative stroke weight matches
the screen.

- **PNG** — everything flattened onto one canvas.
- **SVG** — the basemap is composited on a *separate* canvas and embedded as a
  base64 `<image>` (raster tiles cannot become vectors), while each trail is a
  real `<polyline>` with a `<title>`, so trails stay selectable and editable in
  Inkscape or Illustrator. Paths run through `simplify()` at 0.4 px
  (`src/export.ts:20`) to keep the file size sane; base64 still makes the SVG
  roughly a third larger than the equivalent PNG.

Attribution is burned into every export, bottom-right. This is an ODbL
requirement, not a nicety.

**Tile server etiquette.** A 4× export of a 1200×800 view is ~260 tiles, which
is exactly the pattern the OSM tile usage policy asks people not to hammer. The
concurrency cap, the tile-count ceiling, and the cache keep it well-behaved;
Carto Light is the friendliest choice for large exports.

### 8. `src/ui.ts`, `src/main.ts` — sidebar and wiring

Collapsible panel: file picker plus whole-window drag-and-drop (depth-counted,
since `dragenter` refires per child element); a trail list with visibility
checkbox, colour input, name (click to zoom), stats line and remove button; the
uniform-colour row; basemap radios; and an export section whose estimate line
updates live on `zoomend moveend resize`. Per-trail colour inputs are
*disabled* while uniform mode is on rather than silently doing nothing.

## Files

| File | Purpose |
|------|---------|
| `index.html`, `src/style.css` | Static sidebar markup and styling |
| `src/basemaps.ts` | Tile source registry, URL templating |
| `src/map.ts` | Leaflet init, basemap swap, geolocation watch |
| `src/gpx.ts` | GPX parse, stats, Douglas-Peucker |
| `src/trails.ts` | Trail model, layers, `colorOf` resolver |
| `src/store.ts` | IndexedDB persistence |
| `src/export.ts` | Off-screen tile compositor → PNG / SVG |
| `src/ui.ts` | Sidebar rendering and event binding |
| `src/main.ts` | Wiring, import, restore, export orchestration |
| `samples/*.gpx` | Two synthetic tracks near Bukhansan for testing |

## Verification

Verified headlessly:

- `npm run build` — `tsc --noEmit` plus the Vite bundle, both clean.
- Export geometry, run against Leaflet's real `CRS.EPSG3857` in Node with a
  simulated 1200×800 view at z13. Scale factors come out exact:
  1×→1200×800 (20 tiles), 2×→2400×1600 (70), 4×→4800×3200 (260),
  8×→9600×6400 (1014). This invariant is the whole feature.
- The exact tile URLs the exporter computes, fetched from all four sources —
  all return 256×256 images, including Esri with its swapped axis order.
- `Access-Control-Allow-Origin: *` on all four sources.
- GPX maths: haversine gives 111.20 km per degree of latitude; the 3 m
  threshold filters the samples' ±1.2 m jitter, yielding 1120 m ascent on a
  track built with exactly 2×560 m of climb; Douglas-Peucker collapses a
  straight line to 2 points and preserves a 50-point zigzag.

Still requires a manual browser pass — nothing in the browser runtime is
covered above:

1. `npm run dev`, open `http://localhost:5173`.
2. Allow location → marker and accuracy circle appear; deny once → the app
   still loads with a notice.
3. Zoom, pan, scroll.
4. Import both `samples/*.gpx` at once → two coloured trails, view fits both,
   sidebar shows ~6.0 km / ↑1120 m and ~4.8 km / ↑310 m.
5. Uncheck one → it leaves the map and the next export; recheck → returns.
6. Check "Use one color for all trails" → both switch live, per-trail swatches
   disable; change the shared colour → both follow; uncheck → originals return.
7. Reload → trails, colours, visibility, basemap and uniform setting all
   restored from IndexedDB.
8. Export PNG at 4× → downloaded dimensions are exactly 4× the map div's CSS
   pixel size, and zooming in shows *sharper labels and more road detail*, not
   blocky upscaling. This is the pass/fail test for the whole approach.
9. Export with uniform colour on and off → file strokes match the screen.
10. Export SVG → trails select as individual vector paths over the raster
    basemap in Inkscape.
11. 8× at a large window → the guard message, not a crash or blank file.
12. OpenTopoMap at z14, export 8× → clamps and reports the achieved scale.
13. `npm run build && npm run preview` → production build serves correctly.

## Follow-up

Out of scope here, but worth noting:

- A truly vector SVG basemap would need vector tiles (MapLibre GL + MapTiler or
  Stadia) and an API key, plus a hand-written vector-tile → SVG renderer. The
  current SVG is vector *trails* over a raster basemap.
- Geolocation needs a secure context. `localhost` works in dev; any deployed
  copy must be served over HTTPS.
- The export always uses the exact current viewport. Exporting an arbitrary
  bounding box, a fixed paper size, or a chosen DPI would be a natural
  extension of `planExport()`.
