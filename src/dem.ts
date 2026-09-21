/**
 * Ground elevation without MapLibre, for the 2D readout. 3D asks its terrain
 * (queryTerrainElevation); 2D has none, so it decodes the same tiles itself. No
 * maplibre-gl import here, so the 2D bundle does not grow by it.
 */

/**
 * AWS Terrain Tiles: global, keyless, CORS-open, encoded as terrarium PNGs. Around
 * Seoul the source is SRTM at roughly 30 m, so the mountain has its true shape but
 * no cliffs, boulders or trees. Tiles stop at z15; MapLibre overscales past that.
 */
export const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const DEM_MAX_ZOOM = 15;

/** The tiles' size in pixels: about 4.7 m a pixel at z15 around Seoul. */
const TILE_SIZE = 256;
/** Decoded tiles kept, least recently used first out. Each is 256 KB of pixels. */
const CACHE_SIZE = 32;

/** Milliseconds a failed tile is left alone before it may be asked for again: long
 *  enough that a map dragged about offline does not fetch on every move, short
 *  enough that a dropped request on a flaky connection is not the final word. */
const RETRY_AFTER = 30_000;

const cache = new Map<string, Uint8ClampedArray>();
const loading = new Map<string, Promise<Uint8ClampedArray | null>>();
/** When each tile that failed to load (offline, or no tile there) failed. */
const failed = new Map<string, number>();

type TileSpot = { key: string; z: number; x: number; y: number; px: number; py: number };

/** The z15 tile over (lat, lon), and the pixel within it. */
function tileSpot(lat: number, lon: number): TileSpot {
  const n = 2 ** DEM_MAX_ZOOM;
  const s = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180);
  const fx = ((((lon + 180) / 360) % 1) + 1) % 1 * n;
  const fy = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
  const x = Math.floor(fx);
  const y = Math.min(n - 1, Math.max(0, Math.floor(fy)));
  return {
    key: `${x}/${y}`,
    z: DEM_MAX_ZOOM,
    x,
    y,
    px: Math.min(TILE_SIZE - 1, Math.floor((fx - x) * TILE_SIZE)),
    py: Math.min(TILE_SIZE - 1, Math.floor((fy - y) * TILE_SIZE)),
  };
}

/** Terrarium: metres = R × 256 + G + B / 256 − 32768. */
function decode(pixels: Uint8ClampedArray, px: number, py: number): number {
  const i = (py * TILE_SIZE + px) * 4;
  return pixels[i] * 256 + pixels[i + 1] + pixels[i + 2] / 256 - 32768;
}

/** Which tile a spot falls in, so a caller can tell whether a late answer is still
 *  about where it is now. */
export function elevationTile(lat: number, lon: number): string {
  return tileSpot(lat, lon).key;
}

/** The elevation at (lat, lon) in metres if its tile is loaded; null if the tile
 *  failed lately (see RETRY_AFTER); undefined if it has not been asked for, is on
 *  its way, or may be asked for again. */
export function cachedElevation(lat: number, lon: number): number | null | undefined {
  const spot = tileSpot(lat, lon);
  const pixels = cache.get(spot.key);
  if (pixels === undefined) {
    const at = failed.get(spot.key);
    return at !== undefined && performance.now() - at < RETRY_AFTER ? null : undefined;
  }
  // Re-inserted, so the Map's order is least recently used first.
  cache.delete(spot.key);
  cache.set(spot.key, pixels);
  return decode(pixels, spot.px, spot.py);
}

/** Loads the tile over (lat, lon) if need be, then answers as cachedElevation. */
export async function loadElevation(lat: number, lon: number): Promise<number | null> {
  const spot = tileSpot(lat, lon);
  if (!cache.has(spot.key)) {
    let pending = loading.get(spot.key);
    if (!pending) {
      pending = fetchTile(spot).finally(() => loading.delete(spot.key));
      loading.set(spot.key, pending);
    }
    const pixels = await pending;
    if (pixels) {
      cache.set(spot.key, pixels);
      failed.delete(spot.key);
      while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
    } else {
      failed.set(spot.key, performance.now());
    }
  }
  return cachedElevation(lat, lon) ?? null;
}

/** One retry a second later before a tile counts as failed: headless Chrome
 *  emulating a phone was seen to cancel the very first DEM request of a cold
 *  load, and a flaky mobile connection drops one now and then too. */
async function fetchTile(spot: TileSpot): Promise<Uint8ClampedArray | null> {
  const pixels = await fetchTileOnce(spot);
  if (pixels) return pixels;
  await new Promise((r) => setTimeout(r, 1000));
  return fetchTileOnce(spot);
}

async function fetchTileOnce({ z, x, y }: TileSpot): Promise<Uint8ClampedArray | null> {
  try {
    const url = DEM_TILES.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
    const res = await fetch(url);
    if (!res.ok) return null;
    // Not premultiplied and not colour-managed: either would change the bytes the
    // elevation is encoded in.
    const bitmap = await createImageBitmap(await res.blob(), {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    });
    const canvas = document.createElement('canvas');
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, TILE_SIZE, TILE_SIZE);
    bitmap.close();
    return ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE).data;
  } catch {
    return null;
  }
}
