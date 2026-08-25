/**
 * Tile sources. Every entry must serve `Access-Control-Allow-Origin: *`, since
 * the exporter draws these tiles into a canvas it later reads back — a tainted
 * canvas would make toBlob() throw.
 */
export type Basemap = {
  id: string;
  label: string;
  url: string;
  maxZoom: number;
  subdomains?: string;
  attribution: string;
  /** Short credit burned into exported images. */
  exportCredit: string;
};

export const BASEMAPS: Basemap[] = [
  {
    id: 'osm',
    label: 'OSM Standard',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    exportCredit: '© OpenStreetMap contributors',
  },
  {
    id: 'topo',
    label: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    maxZoom: 17,
    subdomains: 'abc',
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    exportCredit: '© OpenStreetMap contributors — OpenTopoMap (CC-BY-SA)',
  },
  {
    id: 'carto',
    label: 'Carto Light',
    url: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    exportCredit: '© OpenStreetMap contributors © CARTO',
  },
  {
    id: 'esri',
    label: 'Satellite',
    // Note the {z}/{y}/{x} axis order — differs from the slippy-map default.
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    exportCredit: 'Imagery © Esri, Maxar, Earthstar Geographics',
  },
];

export function basemapById(id: string): Basemap {
  return BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0];
}

/** Fills {z}/{x}/{y}/{s} in a tile template. */
export function tileUrl(source: Basemap, z: number, x: number, y: number): string {
  const subs = source.subdomains;
  const s = subs ? subs[(x + y) % subs.length] : '';
  return source.url
    .replace('{s}', s)
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}
