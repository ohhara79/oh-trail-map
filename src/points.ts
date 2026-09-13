/**
 * The National Point Number layer: one pin per row of data/national_points_w_name.tsv, each
 * with a popup naming the 지점번호, the 사물유형 and — where the source has one —
 * the 이름.
 *
 * The data is imported rather than fetched. `vite build` copies only public/, so a
 * repo-root data/ would 404 in dist/; `?raw` makes it part of the bundle instead,
 * which also spares the app a loading state and an error path for 25 KB of text that
 * never changes at runtime.
 */
import L from 'leaflet';
import rawTsv from '../data/national_points_w_name.tsv?raw';
import { parseNationalPoints, type NationalPoint } from './nationalPoint';

/**
 * The pin drawn by the divIcon below: an 18x24 teardrop whose tip
 * is at (9, 24) — hence PIN_ANCHOR — around a circle of radius 8 centred on
 * (9, 8.5), which is also where the white hole goes.
 */
const PIN_PATH = 'M9 24C9 24 17 14 17 8.5A8 8 0 1 0 1 8.5C1 14 9 24 9 24Z';
const PIN_SIZE: [number, number] = [18, 24];
const PIN_ANCHOR: [number, number] = [9, 24];
/** Lifts the popup's tail clear of the pin's head — without it Leaflet anchors the
 *  tail on iconAnchor, which is the tip, and the bubble covers the pin it describes. */
const POPUP_ANCHOR: [number, number] = [0, -22];
const PIN_HOLE = { x: 9, y: 8.5, r: 3 };
/**
 * Two colours, split on whether the row has an 이름 — not one per 사물유형. There
 * are nine of those, a nine-swatch legend has nowhere to live in the panel, and the
 * popup already names the type. A name is the one distinction worth seeing before
 * the click: it is what marks a sign a hiker would say aloud (깔딱고개, K1 호암생활관)
 * against the bare 전신주 and unnamed signs, so named pins keep the amber and the
 * rest recede to slate grey. Both are deliberately outside trails.ts PALETTE and
 * nowhere near the --accent blue of the location dot, so a pin can never be
 * mistaken for either.
 */
const PIN_COLOR_NAMED = '#b45309';
const PIN_COLOR_UNNAMED = '#64748b';

/**
 * The pins get a pane of their own, wedged between overlayPane (400, every trail
 * and the halo) and markerPane (600, your own location). Sharing markerPane would
 * have worked only for as long as createPointsLayer kept being called before
 * startLocating — an ordering nothing in the code enforces and nobody editing
 * main.ts would think to preserve. A z-index states it instead.
 *
 * createPane assigns no z-index of its own; leaflet.css only styles the panes it
 * knows by name, so the number has to be set here or the pane defaults to auto.
 */
const PIN_PANE = 'points';
const PIN_PANE_Z_INDEX = '580';

let cached: NationalPoint[] | null = null;

/** Parsed once: the file is a module constant, so re-parsing could only ever
 *  produce the same array. */
export function loadNationalPoints(): NationalPoint[] {
  cached ??= parseNationalPoints(rawTsv);
  return cached;
}

/**
 * Builds the popup body as DOM rather than an HTML string. 이름 and 사물유형 are
 * arbitrary text from a file dropped into data/, and a name containing `<` would be
 * parsed as markup by innerHTML; textContent cannot be.
 */
function popupContent(point: NationalPoint): HTMLElement {
  const root = document.createElement('div');
  root.className = 'point-popup';
  // Without it a browser whose default stack has no Korean face falls back to a
  // CJK font and renders the Hangul beside Japanese glyph shapes.
  root.lang = 'ko';

  // The name leads when there is one — it is the thing a person recognises. The
  // line is left out entirely rather than rendered empty for the 238 of 338 rows
  // that have no name, where a blank bold line would read as a bug.
  if (point.name) {
    const title = document.createElement('strong');
    title.textContent = point.name;
    root.append(title);
  }

  const code = document.createElement('div');
  code.className = 'point-code';
  code.textContent = point.code;

  const kind = document.createElement('div');
  kind.className = 'muted';
  kind.textContent = point.kind;

  root.append(code, kind);
  return root;
}

/**
 * The pins as one group, so main.ts can add and remove the whole layer with the
 * sidebar toggle.
 *
 * These markers are the one layer in the app that is deliberately interactive.
 * Everywhere else — the halo (selection.ts), the location marker (map.ts) — opts
 * out so that clicks reach the single map handler in main.ts and trailAt() decides
 * what was hit. Here bindPopup makes each marker listen for 'click', and Leaflet's
 * _findEventTargets only falls back to the map when no layer listened, so a click
 * on a pin opens its popup and leaves the trail selection exactly as it was. That
 * is the wanted behaviour, not an accident: picking a landmark out of the map is a
 * different gesture from picking a trail.
 */
export function createPointsLayer(map: L.Map, points: NationalPoint[]): L.LayerGroup {
  map.createPane(PIN_PANE).style.zIndex = PIN_PANE_Z_INDEX;
  const group = L.layerGroup();

  // The colour goes inline on the <svg>, where the body's currentColor picks it up,
  // so the two constants above stay the only place it is decided — style.css names none.
  const iconHtml = (color: string) =>
    `<svg viewBox="0 0 ${PIN_SIZE[0]} ${PIN_SIZE[1]}" width="${PIN_SIZE[0]}" ` +
    `height="${PIN_SIZE[1]}" style="color:${color}" aria-hidden="true">` +
    `<path class="point-pin-body" d="${PIN_PATH}"/>` +
    `<circle class="point-pin-hole" cx="${PIN_HOLE.x}" cy="${PIN_HOLE.y}" r="${PIN_HOLE.r}"/>` +
    '</svg>';
  const namedHtml = iconHtml(PIN_COLOR_NAMED);
  const unnamedHtml = iconHtml(PIN_COLOR_UNNAMED);

  for (const point of points) {
    L.marker([point.lat, point.lon], {
      pane: PIN_PANE,
      icon: L.divIcon({
        // Replaces Leaflet's own 'leaflet-div-icon', whose white box and grey
        // border would frame every pin.
        className: 'point-pin',
        html: point.name ? namedHtml : unnamedHtml,
        iconSize: PIN_SIZE,
        iconAnchor: PIN_ANCHOR,
        popupAnchor: POPUP_ANCHOR,
      }),
      // Leaflet gives every marker a tabindex by default. Hundreds of them between the
      // map and the rest of the page is a tab trap, and the pins carry no
      // information the popup does not repeat on click.
      keyboard: false,
      // Where the points are dense they overlap heavily, so the one under the cursor
      // has to come to the front to be clickable at all.
      riseOnHover: true,
      // Leaflet stacks markers by screen y plus this offset, so every named pin sits
      // over every unnamed one it overlaps — where pins crowd together, the named one
      // is the one worth seeing. The rise has
      // to clear that gap, or a grey pin under an amber one could never be hovered
      // to the front: Leaflet's default riseOffset is only 250.
      zIndexOffset: point.name ? 1000 : 0,
      riseOffset: 2000,
      title: point.name || point.code,
    })
      // The function form: the popup DOM trees are built on first open rather than
      // at boot, when almost none of them will ever be looked at.
      .bindPopup(() => popupContent(point), { closeButton: true, autoPan: true })
      .addTo(group);
  }

  return group;
}
