/** Tile sources, offered in this order by the basemap switcher. */
export type Basemap = {
  id: string;
  label: string;
  url: string;
  /** The deepest level the server actually has. Both views draw its tiles scaled
   *  up past it rather than stopping there — see MAX_ZOOM. */
  maxZoom: number;
  subdomains?: string;
};

export const BASEMAPS: Basemap[] = [
  {
    id: 'osm',
    label: 'OSM Standard',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
  },
  {
    id: 'topo',
    label: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    maxZoom: 17,
    subdomains: 'abc',
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
