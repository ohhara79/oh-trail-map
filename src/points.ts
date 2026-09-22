/**
 * The National Point Number layer: one pin per row of data/national_points_w_name.tsv, each
 * with a popup naming the 지점번호, the 사물유형, the 시/도 and 시/군/구 it is filed
 * under, its lat, lon, and — where the source has one — the 이름.
 *
 * The data is imported rather than fetched. `vite build` copies only public/, so a
 * repo-root data/ would 404 in dist/; `?raw` makes it part of the bundle instead,
 * which also spares the app a loading state and an error path for 25 KB of text that
 * never changes at runtime.
 *
 * It also builds the panel list's rows (pointRows), because the named/unnamed colour
 * split the swatches show is decided here and nowhere else.
 */
import L from 'leaflet';
import rawTsv from '../data/national_points_w_name.tsv?raw';
import { parseNationalPoints, type NationalPoint } from './nationalPoint';
import { pinReach } from './selection';
import { fold } from './trails';

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
/** Lifts the popup's tail to the dot's top edge — without it the tail sits on the
 *  point itself, the dot's centre, and covers the dot it describes. The 7 is
 *  Leaflet's default popup offset, which an explicit offset replaces. */
const POPUP_OFFSET: [number, number] = [0, 7 - PIN_CENTRE];
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

/** One point as the panel list draws and filters it. */
export type PointRow = {
  /**
   * 지점번호: the row's identity and what Settings.hiddenPoints stores.
   * Deliberately not normalised — it has to stay the same string as
   * NationalPoint.code, or a hidden-set key would not match the point it hides.
   */
  code: string;
  /**
   * The row's primary line: 이름 - 지점번호, or the 지점번호 alone for the 128 rows
   * the source gives no 이름. The code was once repeated on those rows to give every
   * row the same two-part shape, but a row with nothing before the dash has no two
   * parts to line up — and since the 이름 moved in front, the width that repeat
   * spent is the width the title now runs out of.
   */
  title: string;
  /** 사물유형 · 시/도 시/군/구. 이름 leads the title now, and an 11px line under it
   *  should not spend its width repeating it. */
  detail: string;
  /** lat, lon — see formatLatLon. A third line, drawn as plain text. */
  coords: string;
  /** Title and detail joined, for the panel filter. Built from the strings that
   *  are actually drawn, so what a query matches is what gets a <mark> over it.
   *  `coords` is left out: it is all digits, and a 지점번호 query like 5241 would
   *  start matching unrelated rows through their lat/lon. */
  haystack: string;
  /** The pin's colour, so a row's swatch and its pin can never disagree. */
  color: string;
};

/**
 * A point's position as the popup and the list both print it: lat first, comma and
 * space, like the GPX point readout on the profile. Five decimals (~1 m) where that
 * readout has six, because a 지점번호 only resolves to 10 m — a sixth digit would claim
 * precision the source does not have.
 */
export function formatLatLon(point: NationalPoint): string {
  return `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`;
}

/**
 * The list's rows, built once at boot rather than per keystroke: normalising,
 * joining and folding 272 rows on every character typed into the filter is work
 * with a fixed answer.
 *
 * The NFC normalise is the same one renderTrails applies to a trail name before
 * highlighting it — indices into the folded haystack have to address the string
 * that is drawn. Measured: no cell in the file is decomposed today, so this is
 * insurance against a future TSV rather than a fix.
 */
export function pointRows(points: readonly NationalPoint[]): PointRow[] {
  return points.map((point) => {
    const region = [point.province, point.district].filter(Boolean).join(' ');
    // Outside the ternary, so both arms get it: the indices highlightName computes
    // have to address the string that is drawn, whichever arm produced it.
    const title = (point.name ? `${point.name} - ${point.code}` : point.code).normalize('NFC');
    const detail = [point.kind, region].filter(Boolean).join(' · ').normalize('NFC');
    return {
      code: point.code,
      title,
      detail,
      coords: formatLatLon(point),
      // The two lines as drawn, so a match is always somewhere a <mark> can go.
      haystack: fold(`${title} ${detail}`),
      color: point.name ? PIN_COLOR_NAMED : PIN_COLOR_UNNAMED,
    };
  });
}

/**
 * Builds the popup body as DOM rather than an HTML string. 이름, 사물유형 and the two
 * region cells are all arbitrary text from a file dropped into data/, and a name
 * containing `<` would be parsed as markup by innerHTML; textContent cannot be. Shared
 * with the 3D view's popups, so a point reads the same in both.
 */
export function popupContent(point: NationalPoint): HTMLElement {
  const root = document.createElement('div');
  root.className = 'point-popup';
  // Without it a browser whose default stack has no Korean face falls back to a
  // CJK font and renders the Hangul beside Japanese glyph shapes.
  root.lang = 'ko';

  // The name leads when there is one — it is the thing a person recognises. The
  // line is left out entirely rather than rendered empty for the rows that have
  // no name, where a blank bold line would read as a bug.
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

  // 시/도 and 시/군/구 last, and muted: by the time you are reading a popup you know
  // roughly where you are, so this is the line the eye is free to skip — it earns its
  // place only when the point sits near one of the boundaries the set crosses
  // (관악구 / 금천구, and the 서울 / 경기 line into 과천시 and 안양시).
  //
  // Joined rather than templated so a row missing one half — none in the file today,
  // but the parser accepts one — reads as the half it has, not as "서울특별시 " with a
  // trailing space that looks like something got cut off. Where the line runs to three
  // words, 경기도 안양시 동안구, the second space came out of the 시/군/구 cell itself.
  const region = [point.province, point.district].filter(Boolean).join(' ');
  if (region) {
    const where = document.createElement('div');
    where.className = 'muted';
    where.textContent = region;
    root.append(where);
  }

  // Last and muted for the same reason as the region, and .point-code for the
  // tabular figures, so the digits sit in columns like the 지점번호's.
  const at = document.createElement('div');
  at.className = 'muted point-code';
  at.textContent = formatLatLon(point);
  root.append(at);

  return root;
}

/**
 * Opens the popup for `point`, replacing any other open on the map.
 *
 * closeOnClick is off because main.ts decides what a click closes: a click while
 * the popup is open only closes it, and Leaflet's own close runs on 'preclick' —
 * before the click is handled — which would leave nothing to tell that a popup
 * had been open.
 */
export function openPointPopup(map: L.Map, point: NationalPoint): L.Popup {
  return L.popup({ closeButton: true, autoPan: true, closeOnClick: false, offset: POPUP_OFFSET })
    .setLatLng([point.lat, point.lon])
    .setContent(popupContent(point))
    .openOn(map);
}

export type PointsLayer = {
  /** Added to the map once and never removed — see createPointsLayer. */
  layer: L.LayerGroup;
  /** Adds and removes markers until exactly the points not in `hidden` are drawn. */
  sync(hidden: ReadonlySet<string>): void;
  /** Rings the pin a click would open, or no pin for null. */
  setHovered(code: string | null): void;
  /** The drawn pin a click at `at` (container pixels) opens, or null. */
  pinAt(at: L.Point): NationalPoint | null;
};

/**
 * The pins as one group, added to the map once at boot and never removed: which
 * pins are drawn is decided by what is in the group, which sync() sets from the
 * panel list's hidden set.
 *
 * The markers are not interactive. A click on one reaches the single map handler
 * in main.ts like any other, which asks pinAt() before trailAt(): picking is
 * geometric for pins as it is for trails, so the reach is pinReach() whatever the
 * dot's drawn size, and where pins crowd the nearest one wins rather than whichever
 * happens to be stacked on top. No bindPopup: its click listener opens the popup
 * unconditionally, where main.ts only opens one when nothing is selected yet.
 */
export function createPointsLayer(map: L.Map, points: NationalPoint[]): PointsLayer {
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

  // Keyed on 지점번호, which parseNationalPoints has already deduplicated, so it is
  // unique by construction — and it is the same string Settings.hiddenPoints holds.
  const markers = new Map<string, { marker: L.Marker; point: NationalPoint }>();
  let hoveredCode: string | null = null;

  for (const point of points) {
    const marker = L.marker([point.lat, point.lon], {
      pane: PIN_PANE,
      icon: L.divIcon({
        // Replaces Leaflet's own 'leaflet-div-icon', whose white box and grey
        // border would frame every pin.
        className: 'point-pin',
        html: point.name ? namedHtml : unnamedHtml,
        iconSize: [PIN_BOX, PIN_BOX],
        // The centre, not a corner: the point is where the dot is.
        iconAnchor: [PIN_CENTRE, PIN_CENTRE],
      }),
      // See createPointsLayer: pinAt() does the hit-testing.
      interactive: false,
      // Leaflet gives every marker a tabindex by default. Hundreds of them between the
      // map and the rest of the page is a tab trap, and the pins carry no
      // information the popup does not repeat on click.
      keyboard: false,
      // Leaflet stacks markers by screen y plus this offset, so every named pin sits
      // over every unnamed one it overlaps — where pins crowd together, the named one
      // is the one worth seeing, and the one pinAt() prefers on a tie.
      zIndexOffset: point.name ? 1000 : 0,
    });
    markers.set(point.code, { marker, point });
  }

  return {
    layer: group,
    sync(hidden) {
      for (const [code, { marker }] of markers) {
        const show = !hidden.has(code);
        // The same reason setVisible() in main.ts returns early: hiding one point
        // must not pay to re-add the 271 markers that are already where they
        // belong. What is left is 272 Set lookups and no DOM at all.
        if (show === group.hasLayer(marker)) continue;
        if (show) group.addLayer(marker);
        else group.removeLayer(marker);
      }
    },
    setHovered(code) {
      if (code === hoveredCode) return;
      const ring = (c: string | null, on: boolean) => {
        const el = c === null ? undefined : markers.get(c)?.marker.getElement();
        el?.classList.toggle('is-hovered', on);
      };
      ring(hoveredCode, false);
      ring(code, true);
      hoveredCode = code;
    },
    pinAt(at) {
      let best: NationalPoint | null = null;
      let bestDistance = pinReach();
      for (const { marker, point } of markers.values()) {
        if (!group.hasLayer(marker)) continue;
        // A named pin is drawn over an unnamed one (zIndexOffset above), so on
        // dots that overlap it wins by the pixel it takes to settle a tie.
        const distance = at.distanceTo(map.latLngToContainerPoint(marker.getLatLng())) - (point.name ? 1 : 0);
        if (distance <= bestDistance) {
          best = point;
          bestDistance = distance;
        }
      }
      return best;
    },
  };
}
