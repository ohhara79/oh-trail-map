/** Tile sources, offered in this order by the basemap switcher. */
export type Basemap = {
  id: string;
  label: string;
  url: string;
  /** The deepest level the server actually has. Both views draw its tiles scaled
   *  up past it rather than stopping there — see MAX_ZOOM. */
  maxZoom: number;
  subdomains?: string;
  /** Served from data/tiles/, which only covers TILE_BOUNDS. */
  local?: boolean;
};

/**
 * The box the tiles under data/tiles/ cover, as [west, south, east, north]: 관악산
 * with a margin. Nothing is fetched outside it. scripts/fetch-tiles.py downloads
 * exactly this box, so the two must move together.
 */
export const TILE_BOUNDS: [number, number, number, number] = [126.9, 37.39, 127.0, 37.49];

export function inTileBounds(lat: number, lon: number): boolean {
  const [west, south, east, north] = TILE_BOUNDS;
  return lat >= south && lat <= north && lon >= west && lon <= east;
}

export const BASEMAPS: Basemap[] = [
  {
    id: 'osm',
    label: 'OSM Standard',
    // Rendered on this machine with OSM's own style: see scripts/render-osm.sh.
    url: 'data/tiles/osm/{z}/{x}/{y}.png',
    maxZoom: 19,
    local: true,
  },
  {
    id: 'topo',
    label: 'OpenTopoMap',
    url: 'data/tiles/topo/{z}/{x}/{y}.png',
    maxZoom: 17,
    local: true,
  },
  {
    id: 'esri',
    label: 'Satellite',
    // Note the {z}/{y}/{x} axis order — differs from the slippy-map default.
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
  },
];

export function basemapById(id: string): Basemap {
  return BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0];
}

/** How far in either view may go, in Leaflet's terms. Past a basemap's own
 *  maxZoom there are no more tiles, so the last ones are drawn scaled up. */
export const MAX_ZOOM = 23;
