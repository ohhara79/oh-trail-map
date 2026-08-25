/** GPX parsing, track statistics, and polyline simplification. */

export type Pt = { lat: number; lon: number; ele?: number; time?: number };

export type Stats = {
  distance: number; // metres
  ascent: number; // metres
  descent: number; // metres
  points: number;
  duration?: number; // seconds
};

export type ParsedGpx = {
  name: string;
  segments: Pt[][];
  stats: Stats;
};

/** Elevation deltas below this are barometer noise, not climbing. */
const ELE_NOISE_THRESHOLD = 3;

const EARTH_RADIUS = 6371008.8;

function textOf(parent: Element, tag: string): string | undefined {
  const el = parent.getElementsByTagNameNS('*', tag)[0];
  const t = el?.textContent?.trim();
  return t ? t : undefined;
}

/** Direct children only — avoids a <rte><name> leaking into a <trk>'s name. */
function childText(parent: Element, tag: string): string | undefined {
  for (const child of Array.from(parent.children)) {
    if (child.localName === tag) {
      const t = child.textContent?.trim();
      return t ? t : undefined;
    }
  }
  return undefined;
}

function readPoints(container: Element, tag: string): Pt[] {
  const nodes = container.getElementsByTagNameNS('*', tag);
  const pts: Pt[] = [];
  for (const node of Array.from(nodes)) {
    const lat = Number(node.getAttribute('lat'));
    const lon = Number(node.getAttribute('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const pt: Pt = { lat, lon };
    const ele = textOf(node, 'ele');
    if (ele !== undefined) {
      const n = Number(ele);
      if (Number.isFinite(n)) pt.ele = n;
    }
    const time = textOf(node, 'time');
    if (time !== undefined) {
      const t = Date.parse(time);
      if (Number.isFinite(t)) pt.time = t;
    }
    pts.push(pt);
  }
  return pts;
}

export function haversine(a: Pt, b: Pt): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function computeStats(segments: Pt[][]): Stats {
  let distance = 0;
  let ascent = 0;
  let descent = 0;
  let points = 0;
  let firstTime: number | undefined;
  let lastTime: number | undefined;

  for (const seg of segments) {
    points += seg.length;
    for (let i = 1; i < seg.length; i++) {
      distance += haversine(seg[i - 1], seg[i]);
    }

    // Elevation gain is accumulated against a moving reference rather than
    // point-to-point, so sub-threshold jitter never counts as climbing.
    let ref: number | undefined;
    for (const p of seg) {
      if (p.ele === undefined) continue;
      if (ref === undefined) {
        ref = p.ele;
        continue;
      }
      const delta = p.ele - ref;
      if (delta > ELE_NOISE_THRESHOLD) {
        ascent += delta;
        ref = p.ele;
      } else if (delta < -ELE_NOISE_THRESHOLD) {
        descent += -delta;
        ref = p.ele;
      }
    }

    for (const p of seg) {
      if (p.time === undefined) continue;
      if (firstTime === undefined || p.time < firstTime) firstTime = p.time;
      if (lastTime === undefined || p.time > lastTime) lastTime = p.time;
    }
  }

  const stats: Stats = { distance, ascent, descent, points };
  if (firstTime !== undefined && lastTime !== undefined && lastTime > firstTime) {
    stats.duration = (lastTime - firstTime) / 1000;
  }
  return stats;
}

export function parseGpx(text: string, fileName: string): ParsedGpx {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error(`${fileName} is not valid XML`);
  }
  const root = doc.documentElement;
  if (!root || root.localName !== 'gpx') {
    throw new Error(`${fileName} has no <gpx> root element`);
  }

  const segments: Pt[][] = [];
  let name: string | undefined;

  for (const trk of Array.from(root.getElementsByTagNameNS('*', 'trk'))) {
    name ??= childText(trk, 'name');
    for (const seg of Array.from(trk.getElementsByTagNameNS('*', 'trkseg'))) {
      const pts = readPoints(seg, 'trkpt');
      if (pts.length >= 2) segments.push(pts);
    }
  }

  // Some exporters emit routes instead of tracks.
  for (const rte of Array.from(root.getElementsByTagNameNS('*', 'rte'))) {
    name ??= childText(rte, 'name');
    const pts = readPoints(rte, 'rtept');
    if (pts.length >= 2) segments.push(pts);
  }

  if (segments.length === 0) {
    throw new Error(`${fileName} contains no track or route points`);
  }

  const metadata = root.getElementsByTagNameNS('*', 'metadata')[0];
  name ??= metadata ? childText(metadata, 'name') : undefined;
  name ??= fileName.replace(/\.gpx$/i, '');

  return { name, segments, stats: computeStats(segments) };
}

/**
 * Douglas-Peucker on already-projected pixel coordinates. Used only for SVG
 * export, where the full point count would balloon the file for no visible gain.
 */
export function simplify(
  points: { x: number; y: number }[],
  tolerance: number,
): { x: number; y: number }[] {
  if (points.length <= 2) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const sqTolerance = tolerance * tolerance;

  // Explicit stack — recursion blows up on tracks with 100k+ points.
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    if (last - first < 2) continue;

    const a = points[first];
    const b = points[last];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;

    let maxSqDist = 0;
    let index = first;
    for (let i = first + 1; i < last; i++) {
      const p = points[i];
      let sqDist: number;
      if (lenSq === 0) {
        sqDist = (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
      } else {
        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        sqDist = (p.x - (a.x + t * dx)) ** 2 + (p.y - (a.y + t * dy)) ** 2;
      }
      if (sqDist > maxSqDist) {
        maxSqDist = sqDist;
        index = i;
      }
    }

    if (maxSqDist > sqTolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i] === 1);
}

export function formatDistance(metres: number): string {
  return metres >= 1000
    ? `${(metres / 1000).toFixed(1)} km`
    : `${Math.round(metres)} m`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
