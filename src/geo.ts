/**
 * Flat-earth arithmetic for moving a few metres at a time. Walking steps and
 * look-at offsets are far too short for the curvature to matter, so a local
 * equirectangular frame is exact to well under a centimetre and much cheaper
 * than solving a geodesic sixty times a second.
 *
 * No Leaflet and no MapLibre in here, so both views can share it.
 */

import { EARTH_RADIUS } from './gpx';

/** Metres along one degree of latitude — and of longitude at the equator. */
export const METRES_PER_DEG = (Math.PI / 180) * EARTH_RADIUS;

const RAD = Math.PI / 180;

/** The point `eastM` metres east and `northM` metres north of (lat, lon). */
export function offset(
  lat: number,
  lon: number,
  eastM: number,
  northM: number,
): { lat: number; lon: number } {
  return {
    lat: lat + northM / METRES_PER_DEG,
    lon: lon + eastM / (METRES_PER_DEG * Math.cos(lat * RAD)),
  };
}

/** Degrees clockwise from north, looking from a towards b, in [0, 360). */
export function bearing(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const east = (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * RAD);
  const north = b.lat - a.lat;
  return ((Math.atan2(east, north) / RAD) % 360 + 360) % 360;
}

/**
 * The shortest signed turn from `from` to `to`, in [-180, 180). Turning by
 * the raw difference instead spins 340° the wrong way between 350° and 10°. An
 * exact half turn is ambiguous and resolves counter-clockwise, which is as good
 * an answer as the other.
 */
export function angleDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}
