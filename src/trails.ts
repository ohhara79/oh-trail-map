import L from 'leaflet';
import { computeStats, parseGpx, type Pt, type Stats } from './gpx';

export type Trail = {
  id: string;
  name: string;
  /** The trail's own colour. Never overwritten by uniform-colour mode. */
  color: string;
  visible: boolean;
  gpxText: string;
  segments: Pt[][];
  stats: Stats;
  bounds: L.LatLngBounds;
  layer: L.LayerGroup;
};

export type Settings = {
  uniformColor: boolean;
  uniformColorValue: string;
  basemapId: string;
  /** Stroke width in CSS/output pixels, shared by the map and both exporters. */
  trailWeight: number;
};

export const DEFAULT_TRAIL_WEIGHT = 3;
export const TRAIL_WEIGHT_MIN = 1;
export const TRAIL_WEIGHT_MAX = 10;

export const DEFAULT_SETTINGS: Settings = {
  uniformColor: false,
  uniformColorValue: '#e02020',
  basemapId: 'osm',
  trailWeight: DEFAULT_TRAIL_WEIGHT,
};

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
 * The single place that decides a trail's stroke colour. The map layers and
 * both exporters read through this, so uniform-colour mode can never drift
 * between what is on screen and what lands in the exported file.
 */
export function colorOf(trail: Trail, settings: Settings): string {
  return settings.uniformColor ? settings.uniformColorValue : trail.color;
}

/**
 * The single place that decides a trail's stroke width, for the same reason as
 * colorOf(). Clamped, because a stale persisted value must not be able to make
 * every trail invisible or absurdly fat.
 */
/**
 * Map-only, unlike colorOf() and weightOf(): with a trail selected, every other
 * one recedes so the selection reads at a glance even in uniform-colour mode,
 * where colour says nothing. The exporters deliberately do not read this — an
 * export is of the trails, not of what happened to be selected.
 */
export function mapOpacityOf(trailId: string, selectedId: string | null): number {
  return selectedId === null || trailId === selectedId ? 1 : DIM_OPACITY;
}

export function weightOf(settings: Settings): number {
  const w = Number(settings.trailWeight);
  if (!Number.isFinite(w)) return DEFAULT_TRAIL_WEIGHT;
  return Math.min(TRAIL_WEIGHT_MAX, Math.max(TRAIL_WEIGHT_MIN, w));
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
  settings: Settings,
): Trail {
  const parsed = parseGpx(gpxText, fileName);
  const layer = L.layerGroup();
  const trail: Trail = {
    id,
    name: parsed.name,
    color,
    visible,
    gpxText,
    segments: parsed.segments,
    stats: parsed.stats,
    bounds: boundsOf(parsed.segments),
    layer,
  };

  const stroke = colorOf(trail, settings);
  for (const seg of parsed.segments) {
    L.polyline(
      seg.map((p) => [p.lat, p.lon] as L.LatLngExpression),
      { color: stroke, weight: weightOf(settings), lineJoin: 'round', lineCap: 'round' },
    ).addTo(layer);
  }
  return trail;
}

/**
 * Re-applies the resolved colour, width and selection opacity to every polyline
 * of a trail. Opacity is set here rather than anywhere else precisely because
 * this is the only restyle path: a dimmed trail recoloured through some other
 * route would silently come back at full strength.
 */
export function restyleTrail(
  trail: Trail,
  settings: Settings,
  selectedId: string | null,
): void {
  const stroke = colorOf(trail, settings);
  const weight = weightOf(settings);
  const opacity = mapOpacityOf(trail.id, selectedId);
  trail.layer.eachLayer((l) => {
    (l as L.Polyline).setStyle({ color: stroke, weight, opacity });
  });
}

export function recomputeStats(trail: Trail): void {
  trail.stats = computeStats(trail.segments);
}
