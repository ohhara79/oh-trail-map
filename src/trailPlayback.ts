/**
 * A trail as something to walk along: its points laid out by distance, so any
 * position along the route is a binary search away, plus the play/pause/speed
 * state that advances through it.
 *
 * No rendering and no MapLibre here — firstPerson.ts decides where the camera
 * goes with the answers.
 */

import { bearing } from './geo';
import { haversine, type Pt } from './gpx';

export type Path = {
  lat: Float64Array;
  lon: Float64Array;
  /** Distance from the start to each point, in metres. */
  s: Float64Array;
  total: number;
};

/** Points closer together than this are GPS standing still, not progress. They
 *  would also give a zero-length step whose bearing is meaningless. */
const MIN_STEP = 0.5;

/**
 * Every segment joined end to end. The jump across a gap between segments is
 * walked like any other step: a recording paused and resumed a few metres on is
 * the usual cause, and skipping the gap would teleport the camera.
 */
export function buildPath(segments: Pt[][]): Path {
  const lat: number[] = [];
  const lon: number[] = [];
  const s: number[] = [];
  let last: Pt | null = null;
  let total = 0;
  for (const seg of segments) {
    for (const p of seg) {
      if (last) {
        const step = haversine(last, p);
        if (step < MIN_STEP) continue;
        total += step;
      }
      lat.push(p.lat);
      lon.push(p.lon);
      s.push(total);
      last = p;
    }
  }
  return {
    lat: Float64Array.from(lat),
    lon: Float64Array.from(lon),
    s: Float64Array.from(s),
    total,
  };
}

/** The position `s` metres along the path, clamped to its ends. */
export function sampleAt(path: Path, s: number): { lat: number; lon: number } {
  const n = path.s.length;
  if (n === 0) return { lat: 0, lon: 0 };
  if (s <= 0 || n === 1) return { lat: path.lat[0], lon: path.lon[0] };
  if (s >= path.total) return { lat: path.lat[n - 1], lon: path.lon[n - 1] };
  // The last index whose distance is <= s.
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path.s[mid] <= s) lo = mid;
    else hi = mid;
  }
  const t = (s - path.s[lo]) / (path.s[hi] - path.s[lo]);
  return {
    lat: path.lat[lo] + (path.lat[hi] - path.lat[lo]) * t,
    lon: path.lon[lo] + (path.lon[hi] - path.lon[lo]) * t,
  };
}

/**
 * Which way the path heads at `s`, measured across a window rather than from the
 * segment under you: GPS zig-zags every few metres, and facing each zig would
 * shake the view from side to side.
 */
export function tangentBearing(path: Path, s: number, window = 20): number {
  const half = window / 2;
  // Near an end the window is shifted inward instead of shrunk, so the first and
  // last steps still face along the trail rather than at a single point.
  const from = Math.max(0, Math.min(s - half, path.total - window));
  const to = Math.min(path.total, from + window);
  return bearing(sampleAt(path, from), sampleAt(path, to));
}

/** Walking pace, in m/s, that the speed multipliers scale. */
export const WALK_PACE = 1.4;

/** Speed presets, as multiples of WALK_PACE. At 20× an 8 km trail takes about five minutes. */
export const SPEEDS = [1, 5, 20, 50] as const;

export class Playback {
  /** Metres from the start. */
  s = 0;
  playing = false;
  speed: number = SPEEDS[1];

  constructor(readonly path: Path) {}

  /** Advances by `dt` seconds. Pauses at the end rather than looping, so a trail
   *  left playing does not quietly start over behind your back. */
  tick(dt: number): void {
    if (!this.playing) return;
    this.s = Math.min(this.path.total, this.s + WALK_PACE * this.speed * dt);
    if (this.s >= this.path.total) this.playing = false;
  }

  /** Play from the start again once the end has been reached. */
  toggle(): void {
    if (!this.playing && this.s >= this.path.total) this.s = 0;
    this.playing = !this.playing;
  }

  nextSpeed(): void {
    const i = SPEEDS.indexOf(this.speed as (typeof SPEEDS)[number]);
    this.speed = SPEEDS[(i + 1) % SPEEDS.length];
  }

  seek(s: number): void {
    this.s = Math.max(0, Math.min(this.path.total, s));
  }
}
