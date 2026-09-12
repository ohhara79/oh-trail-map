# 국가지점번호 markers

## Context

`data/national_points_w_name.tsv` arrived with 338 rows of 국가지점번호 — the numbered
emergency-location signs posted along trails, plus the 사방댐, 정자, 약수터 and 전신주 some
of them are bolted to. Each row is `순번 · 시/도 · 시/군/구 · 지점번호 · 사물유형 · 이름`,
and the 지점번호 is `다사52414090`: a grid reference, not a coordinate. Nothing in the app
could place it.

Decoded, every one of them lands inside a 13 × 13 km box over 관악산 / 삼성산 — lat
37.3596–37.4749, lon 126.8918–127.0423, across 관악구, 금천구, 안양 and 과천. That is the
terrain this app's trails are for, and the reason the feature is worth having is narrow and
practical: standing next to one of these signs is how you tell a rescue dispatcher where you
are. Seeing where the next one is, on the same map as your own track, is the whole point.

The ask was a pin per point and a popup with 지점번호 / 사물유형 / 이름 on click. Settled
with the user before any of it was written: pins rather than dots, a popup anchored to the
pin rather than a toast, a sidebar on/off toggle, the pins burned into the PNG and SVG
exports, no 이름 labels on the map, and no proj4.

One structural fact frames the rest. **Until now this app had no interactive layer at all.**
Every overlay — the halo (`selection.ts:65`), the location marker (`map.ts:117`) — sets
`interactive: false` precisely so that every click reaches the single `map.on('click')`
handler in `main.ts` and `trailAt()` decides what was hit. A pin is the first thing that has
to break that rule, because a pin *is* the thing you are clicking.

## The grid, and how the origin was pinned down

This is the one part of the change nobody can re-derive from reading the code, so it is
written down here rather than left to the comments.

A 국가지점번호 is a grid reference on the EPSG:5179 plane (Korea 2000 / Unified CS, "UTM-K"):

- The alphabet is `가나다라마바사아자차카타파하` — 14 letters, position is the cell index.
  **The first letter is the east axis and the second is the north axis**, which is the
  opposite of the row-then-column order a table would use.
- Each letter pair names a 100 km cell; the eight digits are `EEEE` then `NNNN`, counting
  10 m steps inside it. So

      X = 700000  + col·100000 + EEEE·10
      Y = 1300000 + row·100000 + NNNN·10

- `(700000, 1300000)` is the grid's south-west corner on the EPSG:5179 plane. It is a
  definition, not something the data reveals, so it was checked against the ground before
  anything was drawn: `다사52414090` → 37.46609, 126.96184, the K1 호암생활관 trailhead on
  관악산, and `다사49013778` → 37.43779, 126.92361, the 안양 만안구 사방댐. Either component
  being wrong moves the entire set by a multiple of 100 km, which is why the extent check in
  the verification list below is worth doing.
- From there it is a plain inverse Transverse Mercator on GRS80, `lat0 = 38°`,
  `lon0 = 127.5°`, `k0 = 0.9996`, `FE = 1000000`, `FN = 2000000`.

## Change

### 1. `data/national_points_w_name.tsv` — committed, and imported rather than fetched

`src/points.ts` opens with

```ts
import rawTsv from '../data/national_points_w_name.tsv?raw';
```

`vite build` copies only `public/`, so a repo-root `data/` would have 404'd in `dist/`. The
alternative was a `public/` directory and a `fetch`, which buys a loading state and an error
path for 25 KB of text that never changes at runtime — against an app whose boot has no other
async phase outside IndexedDB. The import also makes a missing file a *build* error rather
than a silent runtime 404, which is the better way to find out.

`src/vite-env.d.ts` already carries `/// <reference types="vite/client" />`, which declares
`*?raw`, so this needed no new `.d.ts`. tsconfig's `include: ["src"]` is not in the way
either: `include` picks root files and everything they import joins the program regardless —
the existing `import './style.css'` in `main.ts` is the same mechanism.

The file had to be `git add`ed. It was untracked only because nobody had staged it —
`.gitignore` is `node_modules` and `dist`, nothing more — and the build now depends on it.

### 2. `src/nationalPoint.ts` (new) — the arithmetic, and nothing else

Leaflet-free and DOM-free, like `heading.ts`, which is what let it be bundled with esbuild and
driven from Node to check the two reference codes before a single pin existed.

`decodeNationalPoint(code)` unpacks the grid and runs Snyder's TM inverse (USGS PP 1395,
eqs. 3-20..3-26) in its series form. No iteration: Korea is within ~200 km of the 127.5°
central meridian, so the sixth-order terms are already at the millimetre — two orders of
magnitude finer than the 10 m the code itself resolves. Hand-rolled rather than proj4 because
proj4 is ~40 KB for one projection out of its hundreds, against Leaflet as this app's only
other runtime dependency.

It returns `null`, never throws, for anything that is not two grid letters and eight digits.
The letters are matched with `indexOf` into the 14-letter alphabet rather than a `[가-하]`
range, which spans some 11,000 syllables and would cheerfully accept `갹`.

`parseNationalPoints(tsv)` is tolerant of exactly what the file actually contains, and nothing
more:

- **238 of the 338 rows stop after 사물유형** with no trailing tab, so a row is 5 *or* 6
  cells and `name` has to be optional-chained into existence.
- The header is skipped by its non-numeric 순번, so a file exported without one still parses.
  (순번 is useless as a key besides — it restarts at 1 per 시/군/구.)
- CRLF and a trailing blank line.
- `다사49293899` appears twice and is deduplicated, first row wins. It is **not** two signs:
  it is one sign on the 금천구 / 안양시 만안구 boundary, filed once under each, identical in
  지점번호, 사물유형 and 이름 alike. Keeping both would have stacked two markers on the same
  coordinate, the lower one permanently unclickable, to say the same thing twice. **337 points
  reach the map.**

### 3. `src/points.ts` (new) — the pin, the layer, the popup

**One shape, three renderers.** `PIN_PATH` is an 18 × 24 teardrop with its tip at `(9, 24)`
and a hole at `(9, 8.5)`. The divIcon drops it into `<path d>`, the PNG exporter hands it to
`new Path2D(PIN_PATH)`, and the SVG exporter re-emits it as markup. Canvas and SVG have no
other shared vocabulary, and that is the whole reason the pin is one path rather than a
composed circle and triangle — the three can now never drift apart.

**One colour, not nine.** The 사물유형 distribution is 182 / 117 / 12 / 9 / 8 / 5 / 2 / 2 / 1;
the bottom four kinds are seven pins in total, and telling 위치안내(표시)판 from
국가지점번호판(전용지주) by hue would need a legend the panel has no room for. Colour in this
app is already spoken for — `PALETTE` assigns trail colours, uniform mode overrides them, and
`--accent` is the location dot — so a second scheme would read as "this pin belongs to that
trail". The amber `#b45309` is outside both. The white casing under it is there for the same
reason the halo has two rings: no single colour survives both Carto Light and Esri satellite.
`paint-order: stroke` puts the casing entirely outside the silhouette instead of letting the
fill eat 0.75 px into it from every edge.

**The popup is built from DOM nodes, never an HTML string.** 이름 and 사물유형 are free text
from a file dropped into `data/`, and Leaflet's `setContent` feeds a string straight to
`innerHTML`; a 이름 containing `<img onerror=…>` would execute. `textContent` cannot, and
`bindPopup` takes an `HTMLElement` natively, so nothing is given up for it. It is passed as a
*function*, so 337 popup bodies are built on first open rather than at boot. The 이름 element
is absent rather than blank for the 238 points that have none — an empty bold line on two
thirds of the popups would read as a rendering bug.

**The pins get their own pane**, `points`, at z-index 580 — between `overlayPane` (400: every
trail and the halo) and `markerPane` (600: your own location). Sharing `markerPane` would have
worked only for as long as `createPointsLayer` kept being called before `startLocating`, an
ordering nothing enforces and nobody editing `main.ts` would think to preserve. `createPane`
assigns no z-index of its own, so the number is set explicitly or the pane defaults to `auto`.

`keyboard: false`, because Leaflet otherwise gives every marker a tabindex and 337 tab stops
between the map and the rest of the page is a trap. `riseOnHover: true`, because they overlap
heavily along the ridge and the one under the cursor has to come forward to be clickable.

### 4. The click, and the one thing it costs

`bindPopup` registers a `click` listener on the marker, and Leaflet's `_findEventTargets`
(`leaflet-src.js:4466-4492`) walks up from `e.target`, pushes the first layer that listens,
and only falls back to `[map]` when none did. `L.layerGroup()` is a plain `LayerGroup`, not a
`FeatureGroup`, so it does not re-parent events either. **So a click on a pin opens its popup
and the trail selection is left exactly as it was** — which is what we want: picking a landmark
out of the map is a different gesture from picking a trail.

The cost is that a pin's pixels are dead to the trail underneath. The icon is an 18 × 24 box
and the pin fills maybe half of it, so the empty corners would have swallowed clicks meant for
a trail passing through — and that trail would simply have been unselectable there, with no
visible reason. `style.css` therefore takes the box out of hit-testing and puts only the ink
back in:

```css
.leaflet-marker-icon.point-pin { pointer-events: none; }
.point-pin-body, .point-pin-hole { pointer-events: auto; }
```

Leaflet still finds the marker — `_findEventTargets` starts at the `<path>` and walks
`parentNode` up to the icon element it registered. The doubled class is not decoration: it is
the `0,2,0` specificity needed to beat leaflet.css's own
`.leaflet-marker-icon.leaflet-interactive { pointer-events: auto }`.

### 5. `src/trails.ts`, `index.html`, `src/ui.ts` — the toggle

`Settings` gains `showPoints: boolean`, defaulting to `true`. `loadSettings` already spreads
`{ ...DEFAULT_SETTINGS, ...stored }`, so every saved record picks the default up with no
migration. It defaults on because a layer that has to be found behind a checkbox will not be
found, and anyone looking anywhere but this one 13 km square sees nothing either way.

`index.html` gets a `<section class="block">` above the Basemap block with the checkbox and a
`.hint` naming where the points are, so an empty map elsewhere does not read as a broken
toggle. `ui.ts` gets `onPointsChange` on `UiCallbacks`, a cached `pointsToggle`, a listener in
`bind()` and a line in `applySettings()` — the same four places every other setting touches.

### 6. `src/main.ts`

`loadNationalPoints()` and `createPointsLayer(map, points)` next to `createMap`, added when
`settings.showPoints`. `onPointsChange` flips the setting, adds or removes the layer, and
persists — the same shape as `onBasemapChange`. `points` is passed through to `exportView`.

### 7. `src/export.ts` — pins in both formats

`ExportOptions` gains `points`, required rather than optional so a caller cannot silently ship
an export that disagrees with the screen. Whether any are drawn is read from
`settings.showPoints`, which keeps the switch in one place.

`projectPins()` reuses the existing `projectSegment` — a `NationalPoint` is structurally
`{lat, lon}` with extras — offsets each result by `PIN_ANCHOR` to land the tip on the point,
and culls anything outside the canvas plus one pin box. The point travels with its corner
through that filter rather than being indexed back out afterwards, which would have been off
by however many were culled.

**Pins are drawn at their on-screen size and never multiplied by `achievedScale`** — the rule
this module's header states for trail strokes, for the same reason: the tiles come back with
their labels at native weight, so a 4× pin would be a 96 px monument standing over 12 px
labels. They are drawn *after* the trails, matching the pane order on screen.

PNG strokes the path then fills over it, which is how canvas spells `paint-order: stroke`.
SVG emits one `<g transform="translate(…)">` per pin — inline geometry rather than
`<defs>` + `<use>`, so every pin arrives in Inkscape as editable geometry, at ~150 bytes each
against a base64 basemap measured in megabytes — each carrying a `<title>` of the code and,
where there is one, the 이름. Popups, the hover `title` and 이름 labels reach neither format.

## Notes

- The decode is verified against two hand-checked codes and a bounding-box sanity check, not
  against an authoritative reference implementation. That is the honest limit of the
  confidence here — though a wrong grid origin or a swapped letter order is a 100 km error,
  not a subtle one.
- The pins are always drawn when the toggle is on, with no zoom floor. All 337 sit in one
  13 km square, so at a country-wide zoom they collapse into a smudge — but a checkbox that
  reads "on" while the map shows nothing is a worse answer than a dense one. If this dataset
  is ever extended nationwide, the thing to add is clustering, not a zoom threshold.
- The duplicate row is a property of the source, not a parser bug. If the dataset is
  regenerated, re-count it.
