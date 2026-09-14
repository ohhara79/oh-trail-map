/**
 * The 3D view's style, sources and layer expressions, built from the same data
 * the 2D view draws. Pure functions only: view3d.ts owns the map and decides
 * when any of this is applied.
 *
 * Type-only imports from maplibre-gl, which are erased at build time, so this
 * module costs nothing in the main bundle even if something outside the lazy
 * chunk ever imports it.
 */
import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  RasterDEMSourceSpecification,
  RasterSourceSpecification,
  SkySpecification,
  StyleSpecification,
} from 'maplibre-gl';
import type { Basemap } from './basemaps';
import { offset } from './geo';
import { EARTH_RADIUS } from './gpx';
import type { NationalPoint } from './nationalPoint';
import { PIN_COLOR_NAMED, PIN_COLOR_UNNAMED, PIN_RADIUS, PIN_STROKE } from './points';
import { HALO_RINGS } from './selection';
import { DIM_OPACITY, TRAIL_WEIGHT, type Trail } from './trails';

export const SRC_BASEMAP = 'basemap';
export const SRC_DEM = 'dem';
export const SRC_TRAILS = 'trails';
export const SRC_POINTS = 'points';
export const SRC_LOCATION = 'location';

export const LAYER_BASEMAP = 'basemap';
export const LAYER_TRAILS = 'trails';
export const LAYER_TRAIL_SELECTED = 'trail-selected';
export const LAYER_HALOS = ['trail-halo-outer', 'trail-halo'] as const;
export const LAYER_LOCATION = 'location-accuracy';
export const LAYER_POINTS = 'points';

/**
 * AWS Terrain Tiles: global, keyless, CORS-open, encoded as terrarium PNGs. Around
 * Seoul the source is SRTM at roughly 30 m, so the mountain has its true shape but
 * no cliffs, boulders or trees. Tiles stop at z15; MapLibre overscales past that.
 */
const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const DEM_MAX_ZOOM = 15;

export function basemapSource(basemap: Basemap): RasterSourceSpecification {
  // MapLibre has no {s} placeholder; it takes a list of URLs and spreads requests
  // across them itself, which is what Leaflet's subdomains did.
  const tiles = basemap.url.includes('{s}')
    ? (basemap.subdomains ?? 'abc').split('').map((s) => basemap.url.replace('{s}', s))
    : [basemap.url];
  return {
    type: 'raster',
    tiles,
    // The default of 512 would have MapLibre ask for tiles one zoom level coarser
    // than the screen needs, and every basemap here is 256px.
    tileSize: 256,
    maxzoom: basemap.maxZoom,
  };
}

export function demSource(): RasterDEMSourceSpecification {
  return {
    type: 'raster-dem',
    tiles: [DEM_TILES],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: DEM_MAX_ZOOM,
  };
}

/**
 * Light sky with a haze toward the horizon. The haze is doing real work: distant
 * terrain is drawn from coarse tiles, and fog is what stops that from reading as
 * blur. `fogStart` is where it begins, from 0 at the map centre to 1 at the
 * horizon — the walk camera puts the centre a few metres ahead, so it wants the
 * fog much further out than the orbit camera does.
 */
export function sky(fogStart: number): SkySpecification {
  return {
    'sky-color': '#7db3e8',
    'horizon-color': '#e4edf5',
    'fog-color': '#e4edf5',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.7,
    'fog-ground-blend': fogStart,
    'atmosphere-blend': 0,
  };
}

/** One MultiLineString per trail. Built once: the trail set is fixed at boot. */
export function trailsGeoJson(trails: readonly Trail[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: trails.map((trail) => ({
      type: 'Feature',
      properties: { id: trail.id, color: trail.color },
      geometry: {
        type: 'MultiLineString',
        coordinates: trail.segments.map((seg) => seg.map((p) => [p.lon, p.lat])),
      },
    })),
  };
}

export function pointsGeoJson(points: readonly NationalPoint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((point, index) => ({
      type: 'Feature',
      // The index leads back to the NationalPoint for the popup, so the popup is
      // built from the same object the 2D view uses and never from a copy.
      properties: { index, named: point.name !== '' },
      geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
    })),
  };
}

/** A 64-gon of `radius` metres, which a fill layer drapes onto the terrain. */
export function circlePolygon(
  lat: number,
  lon: number,
  radius: number,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring: number[][] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    const p = offset(lat, lon, radius * Math.sin(a), radius * Math.cos(a));
    ring.push([p.lon, p.lat]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

export const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * A line width that is `px` screen pixels from above and `metres` wide on the
 * ground at eye height. From above, the 2D view's pixel widths are what keep a
 * trail readable. The walk camera sits at about z20, though, and a pixel width
 * there is a few centimetres of hairline under your feet — while a width that just
 * kept growing with the zoom turns the casings of a selected trail into a road.
 * So it holds `px` to z16, eases into `metres` by z19, and from there doubles with
 * every zoom, which is exactly what holds a width constant on the ground.
 */
function groundWidth(px: number, metres: number, lat: number): ExpressionSpecification {
  const metresPerPx = (z: number) =>
    (2 * Math.PI * EARTH_RADIUS * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** z);
  const at19 = Math.max(px, metres / metresPerPx(19));
  return ['interpolate', ['exponential', 2], ['zoom'], 16, px, 19, at19, 24, at19 * 32];
}

/** The 2D trail stroke, one pixel heavier: a draped line is resampled with the
 *  terrain texture and loses some of its weight. */
const TRAIL_WIDTH_3D = TRAIL_WEIGHT + 1;
/** On the ground: a trail about as wide as a real path, and casings that frame the
 *  selection without swallowing the ground beside it. */
const TRAIL_METRES = 1;
const HALO_METRES = [2.6, 1.8];

/** `lat` is where the trails are, which sets how many metres a pixel covers. */
export function layers(lat: number): LayerSpecification[] {
  const trailLayout = { 'line-join': 'round', 'line-cap': 'round' } as const;
  return [
    { id: LAYER_BASEMAP, type: 'raster', source: SRC_BASEMAP },
    {
      id: LAYER_TRAILS,
      type: 'line',
      source: SRC_TRAILS,
      layout: trailLayout,
      paint: { 'line-color': ['get', 'color'], 'line-width': groundWidth(TRAIL_WIDTH_3D, TRAIL_METRES, lat) },
    },
    // The same order as the 2D view's z-order in Halo.show: every trail, then the
    // selection's casings above them, then the selected trail above its casings.
    ...HALO_RINGS.map(
      (ring, i): LayerSpecification => ({
        id: LAYER_HALOS[i],
        type: 'line',
        source: SRC_TRAILS,
        layout: trailLayout,
        filter: selectedFilter(null),
        paint: {
          'line-color': ring.color,
          'line-opacity': ring.opacity,
          'line-width': groundWidth(ring.weight - TRAIL_WEIGHT + TRAIL_WIDTH_3D, HALO_METRES[i], lat),
        },
      }),
    ),
    {
      id: LAYER_TRAIL_SELECTED,
      type: 'line',
      source: SRC_TRAILS,
      layout: trailLayout,
      filter: selectedFilter(null),
      paint: { 'line-color': ['get', 'color'], 'line-width': groundWidth(TRAIL_WIDTH_3D, TRAIL_METRES, lat) },
    },
    {
      id: LAYER_LOCATION,
      type: 'fill',
      source: SRC_LOCATION,
      // The accuracy circle from startLocating in map.ts.
      paint: { 'fill-color': '#1a73e8', 'fill-opacity': 0.12, 'fill-outline-color': '#1a73e8' },
    },
    {
      id: LAYER_POINTS,
      type: 'circle',
      source: SRC_POINTS,
      // Named points above the rest, for the reason given at zIndexOffset in points.ts.
      layout: { 'circle-sort-key': ['case', ['get', 'named'], 1, 0] },
      paint: {
        'circle-radius': PIN_RADIUS,
        'circle-color': ['case', ['get', 'named'], PIN_COLOR_NAMED, PIN_COLOR_UNNAMED],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': PIN_STROKE,
      },
    },
  ];
}

export function style(basemap: Basemap, trails: readonly Trail[], points: readonly NationalPoint[]): StyleSpecification {
  return {
    version: 8,
    sources: {
      [SRC_BASEMAP]: basemapSource(basemap),
      [SRC_DEM]: demSource(),
      [SRC_TRAILS]: { type: 'geojson', data: trailsGeoJson(trails) },
      [SRC_POINTS]: { type: 'geojson', data: pointsGeoJson(points) },
      [SRC_LOCATION]: { type: 'geojson', data: EMPTY },
    },
    layers: layers(trailsLatitude(trails)),
    // Exaggeration stays at 1: queryTerrainElevation scales by it, and the walk
    // camera's eye height is only 1.7 m if the ground it stands on is the real one.
    terrain: { source: SRC_DEM, exaggeration: 1 },
    sky: sky(0.5),
  };
}

/** The middle of every trail's bounds, or Seoul's latitude with no trails. Within
 *  one area the metres-per-pixel scale barely changes, so one value does. */
function trailsLatitude(trails: readonly Trail[]): number {
  const valid = trails.filter((t) => t.bounds.isValid());
  if (!valid.length) return 37.5;
  return valid.reduce((sum, t) => sum + t.bounds.getCenter().lat, 0) / valid.length;
}

/** The visible trails. Every trail layer takes this, halos included, so hiding the
 *  selected trail can never leave its casing behind. */
export function visibleFilter(trails: readonly Trail[]): FilterSpecification {
  return ['in', ['get', 'id'], ['literal', trails.filter((t) => t.visible).map((t) => t.id)]];
}

/** Only the selected trail, and nothing at all when there is no selection. */
export function selectedFilter(selectedId: string | null): FilterSpecification {
  return selectedId === null ? ['literal', false] : ['==', ['get', 'id'], selectedId];
}

/** The per-trail rule from mapOpacityOf in trails.ts, as an expression: with a trail
 *  selected, every other one recedes to DIM_OPACITY. */
export function trailOpacity(selectedId: string | null): ExpressionSpecification | number {
  return selectedId === null ? 1 : ['case', ['==', ['get', 'id'], selectedId], 1, DIM_OPACITY];
}

/** Both filters at once, for the layers that need the selection and visibility. */
export function allOf(a: FilterSpecification, b: FilterSpecification): FilterSpecification {
  return ['all', a, b] as FilterSpecification;
}
