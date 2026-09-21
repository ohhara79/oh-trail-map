/**
 * A trail as a list of GPX points to read one by one: where each one is, how
 * high, when, and how far along. No DOM and no map here — profilePanel.ts draws
 * it and main.ts puts the matching dot on the map.
 */

import { haversine } from './gpx';
import type { NationalPoint } from './nationalPoint';
import type { Trail } from './trails';

export type Profile = {
  lat: Float64Array;
  lon: Float64Array;
  /** Metres, or NaN where the point has no <ele>. */
  ele: Float64Array;
  /** Epoch milliseconds, or NaN where the point has no <time>. */
  time: Float64Array;
  /** Distance from the start to each point, in metres. */
  s: Float64Array;
  total: number;
  /** Over the points that have one; both NaN when none do. */
  eleMin: number;
  eleMax: number;
  /** The earliest <time> in the trail, which elapsed time is counted from — the
   *  same start computeStats measures the duration from. NaN without one. */
  startTime: number;
};

const cache = new WeakMap<Trail, Profile>();

/**
 * Every point of every segment, in file order, so point #n is the n-th trkpt —
 * unlike buildPath() in trailPlayback.ts, which drops points closer than half a
 * metre and would renumber them.
 *
 * The jump between two segments adds no distance, as in computeStats, so the
 * profile ends at the same distance the selection bar shows.
 */
export function buildProfile(trail: Trail): Profile {
  const cached = cache.get(trail);
  if (cached) return cached;

  const n = trail.segments.reduce((sum, seg) => sum + seg.length, 0);
  const profile: Profile = {
    lat: new Float64Array(n),
    lon: new Float64Array(n),
    ele: new Float64Array(n),
    time: new Float64Array(n),
    s: new Float64Array(n),
    total: 0,
    eleMin: NaN,
    eleMax: NaN,
    startTime: NaN,
  };

  let i = 0;
  let total = 0;
  let eleMin = Infinity;
  let eleMax = -Infinity;
  for (const seg of trail.segments) {
    for (let j = 0; j < seg.length; j++, i++) {
      const p = seg[j];
      if (j > 0) total += haversine(seg[j - 1], p);
      profile.lat[i] = p.lat;
      profile.lon[i] = p.lon;
      profile.s[i] = total;
      profile.ele[i] = p.ele ?? NaN;
      profile.time[i] = p.time ?? NaN;
      if (p.ele !== undefined) {
        eleMin = Math.min(eleMin, p.ele);
        eleMax = Math.max(eleMax, p.ele);
      }
      if (p.time !== undefined && !(p.time >= profile.startTime)) profile.startTime = p.time;
    }
  }
  profile.total = total;
  if (eleMin <= eleMax) {
    profile.eleMin = eleMin;
    profile.eleMax = eleMax;
  }

  cache.set(trail, profile);
  return profile;
}

/**
 * How close the trail has to come to a national point to pass it. Measured over
 * data/gpx/: the count of points near each trail levels off here, and the ones
 * further out stand on other paths.
 */
export const PASS_DISTANCE = 30;

/** A national point the trail goes by, at GPX point `index`. */
export type PointPass = { index: number; point: NationalPoint };

const passCache = new WeakMap<Profile, PointPass[]>();

/**
 * Every time the trail goes by a national point, in the order it does. A run of
 * GPX points within PASS_DISTANCE is one pass, placed at the closest of them, so an
 * out-and-back trail passes the same point twice. Hidden points are kept: toggling
 * one is not a reason to walk the trail again.
 */
export function pointPasses(profile: Profile, points: readonly NationalPoint[]): PointPass[] {
  const cached = passCache.get(profile);
  if (cached) return cached;

  const n = profile.s.length;
  let latMin = Infinity;
  let latMax = -Infinity;
  let lonMin = Infinity;
  let lonMax = -Infinity;
  for (let i = 0; i < n; i++) {
    latMin = Math.min(latMin, profile.lat[i]);
    latMax = Math.max(latMax, profile.lat[i]);
    lonMin = Math.min(lonMin, profile.lon[i]);
    lonMax = Math.max(lonMax, profile.lon[i]);
  }
  // The bounds grown by PASS_DISTANCE, a little over in longitude, which rejects
  // nearly every point before a single haversine.
  const dLat = PASS_DISTANCE / 111_000;
  const dLon = dLat / Math.cos((((latMin + latMax) / 2) * Math.PI) / 180);

  const passes: PointPass[] = [];
  for (const point of points) {
    if (point.lat < latMin - dLat || point.lat > latMax + dLat) continue;
    if (point.lon < lonMin - dLon || point.lon > lonMax + dLon) continue;
    let best = -1;
    let bestDistance = PASS_DISTANCE;
    for (let i = 0; i <= n; i++) {
      const d = i < n ? haversine(point, { lat: profile.lat[i], lon: profile.lon[i] }) : Infinity;
      if (d < PASS_DISTANCE) {
        if (d < bestDistance || best < 0) {
          best = i;
          bestDistance = d;
        }
      } else if (best >= 0) {
        passes.push({ index: best, point });
        best = -1;
        bestDistance = PASS_DISTANCE;
      }
    }
  }
  passes.sort((a, b) => a.index - b.index);

  passCache.set(profile, passes);
  return passes;
}

/**
 * The point nearest `s` metres along. Structural rather than `Profile`, so the
 * playback `Path` in trailPlayback.ts — points laid out by distance in the same
 * way — is searched by this code rather than by a second copy of it.
 */
export function indexAtDistance(along: { s: Float64Array; total: number }, s: number): number {
  const n = along.s.length;
  if (n === 0) return 0;
  if (s <= 0) return 0;
  if (s >= along.total) return n - 1;
  // The last index whose distance is <= s, then whichever neighbour is closer.
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (along.s[mid] <= s) lo = mid;
    else hi = mid;
  }
  return s - along.s[lo] <= along.s[hi] - s ? lo : hi;
}

/** `1:13:22`, or `13:22` under an hour. */
export function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
