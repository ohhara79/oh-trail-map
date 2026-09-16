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
  panel heading — `oh-trail-map (관악산)`. Bundled at build time; an
  empty file leaves just `oh-trail-map`.
- `data/name.txt`, `data/email.txt` and `data/homepage.txt` are shown at the end of
  the panel, the email as a mailto link and the homepage opening in a new tab.
  Bundled at build time; an empty file drops its line.
- Per-trail visibility toggle, a distinct colour, and distance / ascent / duration stats.
- Basemap switcher: OSM Standard, OpenTopoMap, Esri satellite.
- National Point Number emergency-location points from `data/national_points_w_name.tsv`, drawn as circles —
  amber where the point has an 이름, grey where it does not; click one for its 지점번호, 사물유형, 시/도 · 시/군/구 and 이름.
  The grid codes are decoded to lat/lon at runtime — see
  `docs/plans/2026-09-13-01-national-point-markers.md` for the derivation.
- The control panel lists every point, one row per 지점번호 titled
  `이름 - 지점번호` — just the 지점번호 where the source has no 이름 — with the
  pin's colour and `사물유형 · 시/도 시/군/구` beneath it: a checkbox each, a
  master checkbox that shows or hides exactly the rows on screen, and a filter
  that matches every column — `관악 정자` finds the 정자 in 관악, `다사524` finds a
  block of numbers, and a match is marked wherever it lands. Both lines are
  clipped to one row; clicking a row shows them in full — or **Expand all** in
  the heading does every row — and goes to that point and opens its popup, in
  2D or 3D. Whichever point has a popup
  open — from a row, a pin in 2D, a tap in 3D, or walking up to one — is the row
  the list highlights, the same light blue as a selected trail.
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
    Walking past a national point (within 25 m) opens its popup on its own, in
    playback too; points hidden in the panel are skipped.
    The locate button takes you to your location and keeps following as you
    move, until you walk away or click it again. During playback it leaves the
    trail first. While following, you also face the way you are facing (the
    compass, or your GPS course while moving); looking around drifts back to it
    after 2 s.
    A disc above the locate button, where orbit keeps its compass, shows which
    way you are facing and whether you are looking up or down: the card turns to
    north, and the horizon slides as you raise or lower your gaze. Click it to
    swing back round to north and level — in playback that holds for 2 s before
    the trail takes the direction back.
  - **▶ on a trail row**: plays that trail at eye height, with pause, speed
    (1×–50× walking pace) and a scrubber.
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
- Each trail's visibility persists in IndexedDB across reloads, and so does the
  set of hidden national points. The single "Show National Point Numbers" toggle
  the list replaced is not carried over, so a browser that had it switched off
  gets its pins back once.
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
