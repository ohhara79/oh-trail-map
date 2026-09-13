# oh-trail-map

Browser app for overlaying GPX trails on an OpenStreetMap basemap and exporting
the view as a genuinely high-resolution PNG or SVG. Everything runs client-side
— no backend, no API keys.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + static bundle into dist/
npm run preview
```

## Features

- OSM basemap with your current location (marker + accuracy circle), zoom/pan.
- A locate button in the bottom-right: click to centre on yourself and keep
  following as you move, until you drag the map away or click it again.
- Import multiple GPX files via the file picker or by dropping them on the map.
- Per-trail visibility toggle, colour, and distance / ascent / duration stats.
- Adjustable trail line width, applied to the map and to both export formats.
- "Use one color for all trails" mode that overrides — but never overwrites —
  the individual colours.
- Basemap switcher: OSM Standard, OpenTopoMap, Carto Light, Esri satellite.
- 337 국가지점번호 emergency-location points around 관악산 / 삼성산, drawn as pins —
  amber where the point has an 이름, grey where it does not; click one for its 지점번호, 사물유형 and 이름. Toggled from the control panel and
  included in exports. The grid codes are decoded to lat/lon at runtime — see
  `docs/plans/2026-09-13-01-national-point-markers.md` for the derivation.
- Trails persist in IndexedDB across reloads.
- Export the current view at 1×, 2×, 4×, or 8×.
- Works on a phone: the map stays full-width and the control panel becomes a
  drawer over it, opened with the ☰ button in the top-left.

## How the high-resolution export works

A screenshot-style export is capped at the device pixel ratio and just
magnifies the blurry tiles already on screen. Instead, `src/export.ts` renders
the visible bounding box off-screen at a **higher tile zoom level**:

    tileZoom = round(map zoom) + log2(scale)

so the server returns genuinely more detailed tiles. The map is locked to
integer zoom (`zoomSnap: 1`) so "4×" means exactly 4×. Trails are re-projected
at the same zoom and drawn on top at the width set by the "Trail width" slider —
held constant in output pixels, *not* multiplied by the scale. Those tiles come
back with their roads and labels at native weight, so a scaled stroke would leave
the trail several times thicker than every basemap line it sits on.

- **PNG** — everything flattened onto one canvas.
- **SVG** — the basemap is embedded as a base64 raster `<image>` (raster tiles
  cannot become vectors), but each trail is a real `<polyline>`, so trails stay
  selectable and editable in Inkscape or Illustrator. Paths are simplified with
  Douglas-Peucker to keep the file size sane.

Before exporting, `planExport()` checks the result against browser canvas
limits (~16000 px per side) and a tile-count ceiling, and reports a specific
message rather than producing a blank image. If the requested scale exceeds the
basemap's max zoom (OpenTopoMap stops at 17), it clamps and tells you the scale
it actually achieved.

Every tile source is chosen for `Access-Control-Allow-Origin: *`; without it
the canvas would be tainted and `toBlob()` would throw.

### Tile server etiquette

A 4× export of a 1200×800 view is ~260 tiles. Requests are capped at 6
concurrent, tiles are cached in memory so re-exporting the same view is free,
and the total is capped at 1500. Attribution is burned into every export, as
the ODbL requires. Carto Light is the friendliest choice for large exports.

## Samples

`samples/` holds two synthetic GPX tracks near Bukhansan, Seoul (~6.0 km /
1120 m ascent and ~4.8 km / 310 m ascent) for testing import, toggling, and
export.

## Notes

- Geolocation requires a secure context: `localhost` works in dev, but a
  deployed copy must be served over HTTPS. `npm run dev` binds the LAN address
  as well, so a phone on the same Wi-Fi can load it — but over plain HTTP at a
  LAN IP the browser will refuse geolocation. Everything else (import, the
  drawer, export) works there; testing *location* needs localhost or HTTPS.
- Export scale is capped lower on phones and tablets: they cap canvases near
  16.7 Mpx, and past that `toBlob()` returns a blank image rather than failing,
  so the estimate line reports the limit instead of downloading an empty file.
- `dist/` is fully static and can be hosted anywhere.
