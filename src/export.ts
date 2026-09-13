/**
 * High-resolution export.
 *
 * The trick that makes this "high resolution" rather than an upscale: we
 * re-render the visible bounding box off-screen at a HIGHER tile zoom level,
 * so the server hands us genuinely more detailed tiles instead of us
 * magnifying the blurry ones already on screen.
 *
 * A consequence worth knowing: those tiles arrive with their roads and labels at
 * their NATIVE weight, so the trail is drawn at a constant width in output pixels
 * too. Scaling the stroke with the export scale would leave it several times
 * thicker than every basemap line it sits on.
 */
import L from 'leaflet';
import { tileUrl, type Basemap } from './basemaps';
import { simplify } from './gpx';
import type { NationalPoint } from './nationalPoint';
import {
  namedLast,
  PIN_ANCHOR,
  PIN_HOLE,
  PIN_OUTLINE,
  PIN_OUTLINE_WIDTH,
  PIN_PATH,
  PIN_SIZE,
  pinColor,
} from './points';
import { colorOf, weightOf, type Settings, type Trail } from './trails';

const TILE_SIZE = 256;
const MAX_CANVAS_DIMENSION = 16000;
const MAX_CANVAS_AREA = 200_000_000;
/**
 * Phones and tablets cap canvases far lower than a desktop — iOS Safari at
 * roughly 16.7 Mpx total and 4096 px per side. Past the limit `toBlob()` hands
 * back a *blank* image instead of throwing, so an over-large export would
 * silently produce a useless file rather than reaching the message below.
 */
const MOBILE_MAX_CANVAS_DIMENSION = 4096;
const MOBILE_MAX_CANVAS_AREA = 16_777_216;
const MAX_TILES = 1500;
const TILE_CONCURRENCY = 6;
/** Simplification tolerance for SVG paths, in exported pixels. */
const SVG_TOLERANCE = 0.4;

export type ExportFormat = 'png' | 'svg';

export type ExportPlan = {
  tileZoom: number;
  /** Actual magnification vs. screen; below the request when zoom is clamped. */
  achievedScale: number;
  width: number;
  height: number;
  tileCount: number;
  /** Non-null when the export cannot proceed. */
  problem: string | null;
  clamped: boolean;
};

type Geometry = {
  originX: number;
  originY: number;
  tileZoom: number;
  tileX0: number;
  tileX1: number;
  tileY0: number;
  tileY1: number;
};

/**
 * A coarse pointer is the closest proxy the platform offers for "this device
 * has the tighter canvas limits"; there is no way to query the real ceiling
 * without allocating against it.
 */
function canvasLimits(): { dimension: number; area: number } {
  const coarse =
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return coarse
    ? { dimension: MOBILE_MAX_CANVAS_DIMENSION, area: MOBILE_MAX_CANVAS_AREA }
    : { dimension: MAX_CANVAS_DIMENSION, area: MAX_CANVAS_AREA };
}

/** Tiles are cached across exports so re-exporting the same view is free. */
const tileCache = new Map<string, HTMLImageElement>();

function computeGeometry(map: L.Map, tileZoom: number) {
  const bounds = map.getBounds();
  const nw = map.project(bounds.getNorthWest(), tileZoom);
  const se = map.project(bounds.getSouthEast(), tileZoom);

  const worldSize = TILE_SIZE * 2 ** tileZoom;
  let width = se.x - nw.x;
  if (width <= 0) width += worldSize; // view straddles the antimeridian
  const height = se.y - nw.y;

  return { nw, width: Math.round(width), height: Math.round(height) };
}

export function planExport(
  map: L.Map,
  source: Basemap,
  requestedScale: number,
): ExportPlan {
  const k = Math.round(Math.log2(requestedScale));
  const zoom = Math.round(map.getZoom());
  const tileZoom = Math.min(zoom + k, source.maxZoom);
  const achievedScale = 2 ** (tileZoom - zoom);

  const { nw, width, height } = computeGeometry(map, tileZoom);

  const tileX0 = Math.floor(nw.x / TILE_SIZE);
  const tileX1 = Math.floor((nw.x + width) / TILE_SIZE);
  const tileY0 = Math.floor(nw.y / TILE_SIZE);
  const tileY1 = Math.floor((nw.y + height) / TILE_SIZE);
  const tileCount = (tileX1 - tileX0 + 1) * (tileY1 - tileY0 + 1);

  const limits = canvasLimits();

  let problem: string | null = null;
  if (width > limits.dimension || height > limits.dimension) {
    problem =
      `${requestedScale}x needs ${width}x${height} px, past the ~${limits.dimension} px ` +
      `browser canvas limit — try a smaller scale or a smaller window.`;
  } else if (width * height > limits.area) {
    problem = `${requestedScale}x needs ${width}x${height} px, past the browser canvas area limit — try a smaller scale.`;
  } else if (tileCount > MAX_TILES) {
    problem = `${requestedScale}x would need ${tileCount} tiles (limit ${MAX_TILES}) — try a smaller scale or zoom in first.`;
  }

  return {
    tileZoom,
    achievedScale,
    width,
    height,
    tileCount,
    problem,
    clamped: achievedScale < requestedScale,
  };
}

function loadTile(url: string): Promise<HTMLImageElement | null> {
  const cached = tileCache.get(url);
  if (cached) return Promise.resolve(cached);

  const attempt = (): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
      const img = new Image();
      // Required, or the canvas becomes tainted and toBlob() throws.
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });

  return attempt()
    .then((img) => img ?? attempt())
    .then((img) => {
      if (img) tileCache.set(url, img);
      return img;
    });
}

/** Runs tasks with a bounded number in flight, to stay polite to tile servers. */
async function withConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      await tasks[next++]();
    }
  });
  await Promise.all(workers);
}

async function drawBasemap(
  ctx: CanvasRenderingContext2D,
  source: Basemap,
  geom: Geometry,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const jobs: (() => Promise<void>)[] = [];
  const maxTile = 2 ** geom.tileZoom;
  let done = 0;

  for (let tx = geom.tileX0; tx <= geom.tileX1; tx++) {
    for (let ty = geom.tileY0; ty <= geom.tileY1; ty++) {
      if (ty < 0 || ty >= maxTile) continue; // above the pole / below the antipole
      const wrappedX = ((tx % maxTile) + maxTile) % maxTile;
      const dx = tx * TILE_SIZE - geom.originX;
      const dy = ty * TILE_SIZE - geom.originY;
      jobs.push(async () => {
        const img = await loadTile(tileUrl(source, geom.tileZoom, wrappedX, ty));
        if (img) {
          ctx.drawImage(img, dx, dy, TILE_SIZE, TILE_SIZE);
        } else {
          // One dead tile should not kill the whole export.
          ctx.fillStyle = '#e8e8e8';
          ctx.fillRect(dx, dy, TILE_SIZE, TILE_SIZE);
        }
        onProgress?.(++done, jobs.length);
      });
    }
  }

  onProgress?.(0, jobs.length);
  await withConcurrency(jobs, TILE_CONCURRENCY);
}

function projectSegment(
  map: L.Map,
  segment: { lat: number; lon: number }[],
  geom: Geometry,
): { x: number; y: number }[] {
  return segment.map((p) => {
    const pt = map.project([p.lat, p.lon], geom.tileZoom);
    return { x: pt.x - geom.originX, y: pt.y - geom.originY };
  });
}

/**
 * The pins that land inside the canvas, as top-left corners of their icon box.
 *
 * Projected through projectSegment because a NationalPoint is a {lat, lon} with
 * extra fields, so the trails' own projection is exactly right for it. The margin
 * is the icon box itself: a pin anchored just past the edge still has most of its
 * body on the canvas.
 */
function projectPins(
  map: L.Map,
  points: NationalPoint[],
  geom: Geometry,
  width: number,
  height: number,
): { x: number; y: number; point: NationalPoint }[] {
  return projectSegment(map, points, geom)
    // The point travels with its corner: the filter below drops rows, so an index
    // back into `points` would be off by however many were culled.
    .map((p, i) => ({ x: p.x - PIN_ANCHOR[0], y: p.y - PIN_ANCHOR[1], point: points[i] }))
    .filter(
      (p) =>
        p.x > -PIN_SIZE[0] &&
        p.y > -PIN_SIZE[1] &&
        p.x < width + PIN_SIZE[0] &&
        p.y < height + PIN_SIZE[1],
    );
}

function drawAttribution(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  height: number,
  scale: number,
): void {
  const fontSize = Math.max(11, Math.round(12 * scale));
  const pad = Math.round(fontSize * 0.5);
  ctx.font = `${fontSize}px system-ui, sans-serif`;
  ctx.textBaseline = 'bottom';
  const textWidth = ctx.measureText(text).width;
  const boxW = textWidth + pad * 2;
  const boxH = fontSize + pad;

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(width - boxW, height - boxH, boxW, boxH);
  ctx.fillStyle = '#333';
  ctx.fillText(text, width - boxW + pad, height - pad * 0.4);
}

function makeCanvas(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create a 2D canvas context');
  return ctx;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      // Either a tainted canvas or, on mobile, a canvas past the device's
      // real limit — planExport's guard uses a conservative estimate of it.
      blob
        ? resolve(blob)
        : reject(
            new Error(
              'Could not encode the image — the canvas may be past this device’s limit. Try a smaller scale.',
            ),
          );
    }, 'image/png');
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
}

export type ExportOptions = {
  map: L.Map;
  source: Basemap;
  trails: Trail[];
  /** Every 국가지점번호; settings.showPoints decides whether any are drawn. */
  points: NationalPoint[];
  settings: Settings;
  scale: number;
  format: ExportFormat;
  onProgress?: (done: number, total: number) => void;
};

export type ExportResult = { blob: Blob; plan: ExportPlan; extension: string };

export async function exportView(options: ExportOptions): Promise<ExportResult> {
  const { map, source, trails, points, settings, scale, format, onProgress } = options;

  const plan = planExport(map, source, scale);
  if (plan.problem) throw new Error(plan.problem);

  const { nw } = computeGeometry(map, plan.tileZoom);
  const geom: Geometry = {
    originX: nw.x,
    originY: nw.y,
    tileZoom: plan.tileZoom,
    tileX0: Math.floor(nw.x / TILE_SIZE),
    tileX1: Math.floor((nw.x + plan.width) / TILE_SIZE),
    tileY0: Math.floor(nw.y / TILE_SIZE),
    tileY1: Math.floor((nw.y + plan.height) / TILE_SIZE),
  };

  const visible = trails.filter((t) => t.visible);
  // The same flag the map layer is added and removed by, so an export can never
  // disagree with what is on screen.
  const pins = settings.showPoints ? namedLast(points) : [];
  const strokeWidth = weightOf(settings);

  const ctx = makeCanvas(plan.width, plan.height);
  await drawBasemap(ctx, source, geom, onProgress);

  if (format === 'png') {
    for (const trail of visible) {
      ctx.strokeStyle = colorOf(trail, settings);
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (const seg of trail.segments) {
        const pts = projectSegment(map, seg, geom);
        if (pts.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    }
    // After the trails, as on screen: a pin marks a place you can stand, and a
    // trail line drawn over it would hide the one thing it is there to show.
    // Drawn at its on-screen size and never multiplied by achievedScale — the same
    // rule the trail strokes follow, and for the same reason: the tiles come back
    // with their labels at native weight, so a 4x pin would tower over all of them.
    if (pins.length > 0) {
      const pin = new Path2D(PIN_PATH);
      const hole = new Path2D();
      hole.arc(PIN_HOLE.x, PIN_HOLE.y, PIN_HOLE.r, 0, Math.PI * 2);
      ctx.strokeStyle = PIN_OUTLINE;
      ctx.lineWidth = PIN_OUTLINE_WIDTH;
      ctx.lineJoin = 'round';
      for (const p of projectPins(map, pins, geom, plan.width, plan.height)) {
        ctx.save();
        ctx.translate(p.x, p.y);
        // Stroke, then fill over it — canvas has no paint-order, and this is how
        // you spell the same thing: the casing ends up entirely outside the
        // silhouette rather than half-eaten by the fill, matching style.css.
        ctx.stroke(pin);
        ctx.fillStyle = pinColor(p.point);
        ctx.fill(pin);
        ctx.fillStyle = PIN_OUTLINE;
        ctx.fill(hole);
        ctx.restore();
      }
    }

    drawAttribution(ctx, source.exportCredit, plan.width, plan.height, plan.achievedScale);
    const blob = await canvasToBlob(ctx.canvas);
    return { blob, plan, extension: 'png' };
  }

  // SVG: the basemap has to be raster, but the trails stay true vector paths
  // so they remain selectable and editable in Inkscape/Illustrator.
  const baseDataUrl = await blobToDataUrl(await canvasToBlob(ctx.canvas));

  const paths: string[] = [];
  for (const trail of visible) {
    const stroke = colorOf(trail, settings);
    for (const seg of trail.segments) {
      const pts = simplify(projectSegment(map, seg, geom), SVG_TOLERANCE);
      if (pts.length < 2) continue;
      const points = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      paths.push(
        `  <polyline points="${points}" fill="none" stroke="${stroke}" ` +
          `stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round">` +
          `<title>${escapeXml(trail.name)}</title></polyline>`,
      );
    }
  }

  // One <g> per pin rather than a <defs> + <use>: ~150 bytes each against a base64
  // basemap image measured in megabytes, and every pin arrives in Inkscape as
  // editable geometry instead of a reference. The <title> is what a person reads
  // when they click it there, so it carries the code and, where there is one, the name.
  for (const { x, y, point } of projectPins(map, pins, geom, plan.width, plan.height)) {
    paths.push(
      `  <g transform="translate(${x.toFixed(1)},${y.toFixed(1)})">` +
        `<title>${escapeXml(point.name ? `${point.code} ${point.name}` : point.code)}</title>` +
        `<path d="${PIN_PATH}" fill="${pinColor(point)}" stroke="${PIN_OUTLINE}" ` +
        `stroke-width="${PIN_OUTLINE_WIDTH}" stroke-linejoin="round" paint-order="stroke"/>` +
        `<circle cx="${PIN_HOLE.x}" cy="${PIN_HOLE.y}" r="${PIN_HOLE.r}" fill="${PIN_OUTLINE}"/>` +
        `</g>`,
    );
  }

  const fontSize = Math.max(11, Math.round(12 * plan.achievedScale));
  const credit = escapeXml(source.exportCredit);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${plan.width}" height="${plan.height}" viewBox="0 0 ${plan.width} ${plan.height}">\n` +
    `  <image x="0" y="0" width="${plan.width}" height="${plan.height}" xlink:href="${baseDataUrl}"/>\n` +
    `${paths.join('\n')}\n` +
    `  <text x="${plan.width - fontSize * 0.5}" y="${plan.height - fontSize * 0.5}" ` +
    `text-anchor="end" font-family="system-ui, sans-serif" font-size="${fontSize}" fill="#333">${credit}</text>\n` +
    `</svg>\n`;

  return {
    blob: new Blob([svg], { type: 'image/svg+xml' }),
    plan,
    extension: 'svg',
  };
}
