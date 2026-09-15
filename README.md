# oh-trail-map

Browser app for overlaying GPX trails on an OpenStreetMap basemap. Everything
runs client-side — no backend, no API keys.

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
- Trails are the `.gpx` files in `data/gpx/`, bundled at build time (one lazy
  chunk per file). No files, no trails; the set cannot be changed from the
  browser — add or remove files and restart `npm run dev` or rebuild.
- `data/title.txt` names the area, shown after the app name in the tab title and
  panel heading — `oh-trail-map (Gwanaksan Mountain)`. Bundled at build time; an
  empty file leaves just `oh-trail-map`.
- Per-trail visibility toggle, a distinct colour, and distance / ascent / duration stats.
- Basemap switcher: OSM Standard, OpenTopoMap, Esri satellite.
- National Point Number emergency-location points from `data/national_points_w_name.tsv`, drawn as circles —
  amber where the point has an 이름, grey where it does not; click one for its 지점번호, 사물유형 and 이름. Toggled from the control panel.
  The grid codes are decoded to lat/lon at runtime — see
  `docs/plans/2026-09-13-01-national-point-markers.md` for the derivation.
- Click a trail on the map to select it, or a point to open its popup. While
  either is selected, a click anywhere on the map (2D or 3D orbit) only clears
  it, so a near miss never jumps to a neighbouring trail or point. A row in the
  trail list still selects its trail directly.
- A **3D** button (top-right) turns the map into a MapLibre GL terrain view with
  the same basemap, trails and points:
  - It opens in orbit, to tilt and rotate from above.
  - **Walk** (a toggle; off again is back to orbit): stand at eye height (1.7 m, or 20 m / 80 m) and move with
    W A S D or the arrows, Shift to run. Drag, or click to capture the mouse,
    to look around.
    Aim the crosshair at a point or a trail and click or tap to open or select
    it; the selected trail's bar shows while walking too.
  - **▶ on a trail row**: plays that trail at eye height, with pause, speed
    (1×–50× walking pace) and a scrubber.
    Walking past a national point (within 25 m) opens its popup on its own.
    While it plays, the buttons over the scene fade out after 3 s; tap or click
    the scene to bring them back, or again to hide them.
  - **▶ 3D on the selection bar**: clicking a trail on the map (2D or 3D)
    shows its name at the bottom with a ▶ that does the same, no panel needed.
  - **On a phone**: a joystick moves you, dragging looks around, and **Gyro**
    turns the view with the phone.
  - **Esc**: steps back from playback to walk, then to orbit.

  Terrain comes from AWS Terrain Tiles (SRTM, ~30 m), so the mountain has its
  true shape but no cliffs or trees, and the ground near your feet is soft. 3D
  loads far more tiles than 2D does — worth keeping in mind with the OSM tile
  usage policy. MapLibre (~1.5 MB) is only downloaded the first time 3D is opened.
- Each trail's visibility persists in IndexedDB across reloads.
- Works on a phone: the map stays full-width and the control panel becomes a
  drawer over it, opened with the ☰ button in the top-left.

## Samples

`samples/` holds two synthetic GPX tracks near Bukhansan, Seoul (~6.0 km /
1120 m ascent and ~4.8 km / 310 m ascent) for testing — copy them into
`data/gpx/` to load them.

## Notes

- Geolocation requires a secure context: `localhost` works in dev, but a
  deployed copy must be served over HTTPS. `npm run dev` binds the LAN address
  as well, so a phone on the same Wi-Fi can load it — but over plain HTTP at a
  LAN IP the browser will refuse geolocation. Everything else (the trails,
  the drawer) works there; testing *location* needs localhost or HTTPS.
- `dist/` is fully static and can be hosted anywhere.
