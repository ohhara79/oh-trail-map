import L from 'leaflet';
import { computeStats, parseGpx, type Pt, type Stats } from './gpx';

export type Trail = {
  id: string;
  name: string;
  /** The trail's own colour. */
  color: string;
  visible: boolean;
  segments: Pt[][];
  stats: Stats;
  bounds: L.LatLngBounds;
  layer: L.LayerGroup;
};

export type Settings = {
  basemapId: string;
  /** Whether the 국가지점번호 pins are drawn. */
  showPoints: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  basemapId: 'osm',
  showPoints: true,
};

/** Every trail's stroke width, in CSS pixels. The halo's casings are derived from it. */
export const TRAIL_WEIGHT = 2;

/** How far an unselected trail recedes while something else is selected. */
export const DIM_OPACITY = 0.3;

export const PALETTE = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231',
  '#911eb4', '#008080', '#f032e6', '#9a6324',
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
function fold(s: string): string {
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
  const folded = fold(name);
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
