import L from 'leaflet';
import { computeStats, parseGpx, type Pt, type Stats } from './gpx';

export type Trail = {
  id: string;
  name: string;
  /** From PALETTE, by the file's position in data/gpx/. */
  color: string;
  visible: boolean;
  segments: Pt[][];
  stats: Stats;
  bounds: L.LatLngBounds;
  layer: L.LayerGroup;
};

export type Settings = {
  basemapId: string;
  /**
   * The 지점번호 of every national point whose pin is not drawn.
   *
   * The off set rather than the on set: nothing hidden is the usual state and
   * stores as an empty array, and a point added to a future TSV is drawn by
   * default — the same default `record?.visible ?? true` gives a trail with no
   * record. A code left here after a point leaves the TSV matches no row and is
   * inert.
   *
   * One array on Settings rather than a record per point in its own store: run()
   * in store.ts opens a transaction per request, so 285 records would be 285
   * transactions every time the master checkbox is clicked. The trails store
   * exists because trails are files whose set changes; the TSV is a bundled
   * module constant with stable ten-character keys.
   */
  hiddenPoints: string[];
};

export const DEFAULT_SETTINGS: Settings = {
  basemapId: 'osm',
  hiddenPoints: [],
};

/** Every trail's stroke width, in CSS pixels. The halo's casings are derived from it. */
export const TRAIL_WEIGHT = 3;

/** How far an unselected trail recedes while something else is selected. */
export const DIM_OPACITY = 0.3;

/**
 * 64 colours, handed out by position in data/gpx/ and repeating after the last.
 * Picked greedily in OKLab from a 16-level sRGB grid: each entry is the candidate
 * farthest from every entry before it, so the first N are the most distinct N for
 * any N. Candidates are limited to lightness 0.40–0.75 and chroma ≥ 0.08, so a 3px
 * line holds up on the street, topo and satellite basemaps. The halo casings, the
 * points.ts pin amber and slate, the location blue and the OSM ground colours count
 * as already taken, so no trail is mistaken for any of them.
 */
export const PALETTE = [
  '#ff00ff', '#770088', '#00aa00', '#006600', '#ff7799', '#9911ff', '#0000dd', '#cc1188',
  '#bb88ff', '#881122', '#bb9900', '#224488', '#44aadd', '#ff0022', '#777700', '#9955bb',
  '#ff7700', '#00bb99', '#5533ff', '#664400', '#bb7788', '#994466', '#5500bb', '#ff33aa',
  '#008866', '#55cc44', '#bb00cc', '#8866ff', '#bb0022', '#779966', '#006677', '#8888cc',
  '#cc55ee', '#664499', '#dd9988', '#cc99cc', '#ee77dd', '#008800', '#0088bb', '#8822bb',
  '#3355bb', '#990066', '#cc7744', '#cc4455', '#cc55aa', '#663366', '#339999', '#99bb66',
  '#88aaff', '#6688ff', '#6666bb', '#885533', '#ff4477', '#aa0099', '#cc00ff', '#7744dd',
  '#997744', '#77aa33', '#ee00cc', '#0033ff', '#996688', '#ee5511', '#556622', '#bb77cc',
];

export function nextColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

/**
 * With a trail selected, every other one recedes so the selection reads at a
 * glance, even where two trails' colours are hard to tell apart.
 */
export function mapOpacityOf(trailId: string, selectedId: string | null): number {
  return selectedId === null || trailId === selectedId ? 1 : DIM_OPACITY;
}

/**
 * Normalises a name or a query for comparison. NFC matters more than case here:
 * Hangul from a macOS-exported filename arrives decomposed, so a typed 북 would
 * never substring-match a stored ᄇ ᅮ ᆨ. toLowerCase() is a no-op for Hangul but
 * still carries the Latin names.
 */
export function fold(s: string): string {
  return s.normalize('NFC').toLowerCase();
}

/**
 * Splits a filter query into the tokens every match must contain. Exported so
 * the list filter and the match highlighter can never tokenise differently.
 */
export function searchTokens(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean);
}

/** Token-AND, so "bukhan 05" finds "Bukhansan Ridge Loop 2026-05-14". */
export function matchesTokens(name: string, tokens: string[]): boolean {
  return matchesFolded(fold(name), tokens);
}

/**
 * The same test against text that has already been through fold(). The national
 * point list folds its haystacks once at boot — 285 of them, five columns each —
 * rather than on every character typed into the filter, and this is how it stays
 * the *same* test rather than a second copy of the rule.
 */
export function matchesFolded(folded: string, tokens: string[]): boolean {
  return tokens.every((t) => folded.includes(t));
}

function boundsOf(segments: Pt[][]): L.LatLngBounds {
  const bounds = L.latLngBounds([]);
  for (const seg of segments) {
    for (const p of seg) bounds.extend([p.lat, p.lon]);
  }
  return bounds;
}

export function buildTrail(
  id: string,
  gpxText: string,
  fileName: string,
  color: string,
  visible: boolean,
): Trail {
  const parsed = parseGpx(gpxText, fileName);
  const layer = L.layerGroup();
  const trail: Trail = {
    id,
    name: parsed.name,
    color,
    visible,
    segments: parsed.segments,
    stats: parsed.stats,
    bounds: boundsOf(parsed.segments),
    layer,
  };

  for (const seg of parsed.segments) {
    L.polyline(
      seg.map((p) => [p.lat, p.lon] as L.LatLngExpression),
      { color, weight: TRAIL_WEIGHT, lineJoin: 'round', lineCap: 'round' },
    ).addTo(layer);
  }
  return trail;
}

/**
 * Re-applies the colour and selection opacity to every polyline of a trail. Opacity is set here rather than anywhere else precisely because
 * this is the only restyle path: a dimmed trail recoloured through some other
 * route would silently come back at full strength.
 */
export function restyleTrail(trail: Trail, selectedId: string | null): void {
  const opacity = mapOpacityOf(trail.id, selectedId);
  trail.layer.eachLayer((l) => {
    (l as L.Polyline).setStyle({ color: trail.color, opacity });
  });
}

export function recomputeStats(trail: Trail): void {
  trail.stats = computeStats(trail.segments);
}
