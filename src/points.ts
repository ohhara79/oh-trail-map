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
 * The marker is a dot with a white ring, the same in 2D and 3D: scene3d.ts feeds
 * these two numbers straight to MapLibre's circle-radius and circle-stroke-width.
 *
 * MapLibre draws the stroke wholly outside the radius, so the ring's outer edge is
 * at PIN_RADIUS + PIN_STROKE. An SVG stroke straddles the edge instead, so the
 * divIcon below draws it twice as wide under the fill (paint-order in style.css),
 * which leaves the same PIN_STROKE of white showing outside.
 */
export const PIN_RADIUS = 5;
export const PIN_STROKE = 1.5;
/** Just big enough for the ring, rounded up to whole pixels so the centre is too. */
const PIN_BOX = 2 * Math.ceil(PIN_RADIUS + PIN_STROKE);
const PIN_CENTRE = PIN_BOX / 2;
/** Lifts the popup's tail to the dot's top edge — without it Leaflet anchors the
 *  tail on iconAnchor, the centre, and the tail covers the dot it describes. */
const POPUP_ANCHOR: [number, number] = [0, -PIN_CENTRE];
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
export const PIN_COLOR_NAMED = '#b45309';
export const PIN_COLOR_UNNAMED = '#64748b';

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
 * parsed as markup by innerHTML; textContent cannot be. Shared with the 3D view's
 * popups, so a point reads the same in both.
 */
export function popupContent(point: NationalPoint): HTMLElement {
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
    `<svg viewBox="0 0 ${PIN_BOX} ${PIN_BOX}" width="${PIN_BOX}" ` +
    `height="${PIN_BOX}" style="color:${color}" aria-hidden="true">` +
    `<circle class="point-pin-body" cx="${PIN_CENTRE}" cy="${PIN_CENTRE}" ` +
    `r="${PIN_RADIUS}" stroke-width="${2 * PIN_STROKE}"/>` +
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
        iconSize: [PIN_BOX, PIN_BOX],
        // The centre, not a corner: the point is where the dot is.
        iconAnchor: [PIN_CENTRE, PIN_CENTRE],
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
