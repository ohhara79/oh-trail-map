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

- OSM basemap with your current location (marker + accuracy circle), zoom/pan,
  and a metric scale bar in the bottom-left, in 2D and 3D orbit.
- A small see-through crosshair marks the map centre, and a readout at the top
  centre gives its lat, lon and ground elevation — in 2D (from the same AWS
  terrain tiles 3D uses, fetched as you pan) and in 3D orbit. Walking or playing
  a trail in 3D it gives where you stand instead.
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
  amber where the point has an 이름, grey where it does not; click one for its 지점번호, 사물유형, 시/도 · 시/군/구, lat, lon and 이름.
  The grid codes are decoded to lat/lon at runtime — see
  `docs/plans/2026-09-13-01-national-point-markers.md` for the derivation.
- The control panel lists every point, one row per 지점번호 titled
  `이름 - 지점번호` — just the 지점번호 where the source has no 이름 — with the
  pin's colour and `사물유형 · 시/도 시/군/구` beneath it, then its lat, lon: a
  checkbox each, a master checkbox that shows or hides exactly the rows on
  screen, and a filter that matches every column but lat, lon — `관악 정자` finds
  the 정자 in 관악, `다사524` finds a block of numbers, and a match is marked
  wherever it lands. Every line is always shown in full; clicking a row goes to that point and opens its popup,
  in 2D or 3D. Whichever point has a popup
  open — from a row, a pin in 2D, a tap in 3D, or walking up to one — is the row
  the list highlights, the same light blue as a selected trail.
- Click a trail on the map to select it, or a point to open its popup. While
  either is selected, a click anywhere on the map (2D or 3D orbit) only clears
  it, so a near miss never jumps to a neighbouring trail or point. A row in the
  trail list still selects its trail directly.
- The selection bar's profile button opens the selected trail's elevation
  profile above it, in 2D and 3D, with the name of its GPX file in the chart's
  bottom-right corner. Drag along it — or focus it and use
  ←/→ (Shift for 10, Home/End), or ◀ ▶ — to pick one GPX point: a dot marks it
  on the map, and the panel reads out its lat/lon, elevation, how long after the
  start, its number and how far along the trail. The national points the trail
  passes (within 30 m) sit on the line as small pins, amber for named and grey
  for unnamed — one per visit, so the same point again right after itself (GPS
  jitter) shows only its first pin — and with the cursor on one the readout names it on a line below
  the number and distance. A tap on a pin puts the cursor on its point; a drag
  never snaps, so the GPX points beside a pin stay in reach. The cursor and its dot
  belong to the selected trail, not the panel: they stay with the profile
  closed, and the panel opens on the same point. Deselecting the trail clears the point. A trail playing in 3D
  takes the panel over, whether or not you had it open — see below.
- With a mouse, hovering shows what a click would pick before you click, in 2D
  and 3D orbit: a faint white casing under the trail, or a ring around the
  point, with its name beside the pointer. It follows the click's own rules —
  the nearest trail within reach, a point over a trail, and nothing while
  something is selected, since that click only clears.
- A **3D** button (top-right) turns the map into a MapLibre GL terrain view with
  the same basemap, trails and points:
  - It opens in orbit, to tilt and rotate from above.
  - **Walk** (a toggle; off again is back to orbit): stand at eye height (1.7 m, or 20 m / 80 m) and move with
    W A S D or the arrows, Shift to run. Drag, or click the scene to capture
    the mouse, to look around. Every click captures it, even one that picks
    something, so press Esc to reach a popup or the selection bar.
    Aim the crosshair at a point you can see, or a trail within reach (150 m
    standing, 1 km at 20 m, 5 km at 80 m), and click or tap to open or select it; the selected trail's bar shows while walking too.
    Walking towards a national point you can see (within 100 m) shows its name beside its ball,
    in playback too; it opens only when you aim at it and tap.
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
    The elevation profile rides above the playback bar while it plays, and its
    cursor follows you: it names the GPX point you are standing on — lat/lon,
    elevation, how long after the start, `#842 / 3,000` and how far along.
    Scrubbing the chart, or stepping it with ◀ ▶ or the arrow keys, seeks the
    playback rather than just moving the cursor. Stop, and it stays on the point
    you stepped off at, if you had the panel open to begin with.
    The buttons over the scene stay up: tap or click the scene to put them away
    while you watch, and again to bring them back — a tap with them hidden only
    brings them back, and picks nothing. The profile goes with them. With a
    captured mouse, Esc frees it and brings them back too. Aiming at a trail picks it while walking, not while
    one plays, where a tap is for the controls; a point still opens its popup.
  - **▶ 3D on the selection bar**: clicking a trail on the map (2D or 3D)
    shows its name at the bottom with a ▶ that does the same, no panel needed.
  - **The 2D map as a minimap**: walking or playing a trail, it comes back in the
    top-left corner, north-up, with an arrow at its centre for where you stand and
    which way you face. It is the same map, so the trails, the pins, your location
    and the profile's cursor dot are already on it, and its basemap is see-through
    so the scene still shows underneath. It looks further out the higher your eye.
    Click or tap it to make it bigger, and the map button on the top bar to put it
    away — it starts showing, and stays as you leave it until you reload.
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

## Keyboard shortcuts

On a PC, press `?` for this list in the app (also linked from the panel's footer).
Letters work with the Korean IME on, do nothing while typing in a filter box, and
leave Ctrl/Alt/Cmd combinations to the browser.

| Key | Action |
|---|---|
| `?` | Show or hide the shortcut list |
| `/` | Open the panel and filter trails by name |
| `L` | Show or hide the panel |
| `3` | Switch between 2D and 3D |
| `E` | Elevation profile (the playback one while a trail plays) |
| `,` `.` | Previous / next GPX point on the profile; `Shift` for 10, hold to repeat |
| `Enter` | Walk the selected trail in 3D, from the profile cursor |
| `C` | Zoom to the selected trail |
| `G` | Show and follow your location |
| `B` | Next basemap |
| `H` | Hide or show every national point |
| `Esc` | Step back: filter, selection, playback, walk, panel |
| `+` `-`, arrows | Zoom and pan the 2D map (once it has been clicked) |
| `V` | 3D: walk at eye height, or back to orbit |
| `W` `A` `S` `D`, arrows | 3D walk; `Shift` to run |
| `M` | 3D walk/playback: the 2D minimap |
| `Space`, `P` | Pause or play the trail |
| `X` | Playback speed |

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
