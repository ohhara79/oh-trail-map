import L from 'leaflet';
import { TRAIL_WEIGHT, type Trail } from './trails';

/** Extra stroke width, in px, for the two casings drawn under a selected trail. */
const OUTER_PAD = 10;
const CASING_PAD = 6;

/**
 * The casings, outermost first. Two, because one colour cannot carry every
 * basemap: white alone washes out on a pale basemap, dark alone disappears on
 * Esri satellite. Exported for the 3D view, which draws the same two rings as
 * line layers.
 */
export const HALO_RINGS = [
  { color: '#1f2328', weight: TRAIL_WEIGHT + OUTER_PAD, opacity: 0.35, className: 'trail-halo-outer' },
  { color: '#ffffff', weight: TRAIL_WEIGHT + CASING_PAD, opacity: 0.95, className: 'trail-halo' },
] as const;

/**
 * The white ring's pulse on selection, which style.css plays in 2D as
 * trail-halo-pulse: down to `low` and back, `period` ms each, `count` times. The
 * 3D view has no CSS to hand it to, so it plays these numbers on its own; change
 * one and change the other.
 */
export const HALO_PULSE = { low: 0.2, period: 550, count: 2 } as const;

/**
 * The casing drawn under the trail a click would pick, while the mouse hovers
 * near it: the selection's white ring, fainter and without the pulse, so a
 * preview never reads as a selection. Shared with the 3D view's hover layer.
 */
export const HOVER_RING = {
  color: '#ffffff',
  weight: TRAIL_WEIGHT + CASING_PAD,
  opacity: 0.6,
} as const;

/**
 * How close a click has to land, in CSS pixels. Generous compared to the 2px
 * a trail is actually drawn at: the line is what you aim for, not what you can
 * realistically hit.
 */
const TOLERANCE_FINE = 15;
const TOLERANCE_COARSE = 22;

export function tolerance(): number {
  return coarsePointer() ? TOLERANCE_COARSE : TOLERANCE_FINE;
}

/**
 * How close to a national point's centre a click has to land, in CSS pixels. The
 * dot is drawn 6.5px across the radius; hit-testing only that ink missed a mouse
 * click just off its edge and most taps outright, and a miss fell through to the
 * trail the point sits on. Tighter than tolerance(), because a pin takes the click
 * over any trail beneath it, and a pin on a trail must not swallow the trail.
 */
const PIN_REACH_FINE = 12;
const PIN_REACH_COARSE = 20;

export function pinReach(): number {
  return coarsePointer() ? PIN_REACH_COARSE : PIN_REACH_FINE;
}

function coarsePointer(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

/**
 * The halo drawn beneath the selected trail, and nothing else. Kept out of
 * trails.ts, which owns the trail model: this is decoration over it, never
 * persisted.
 */
export class Halo {
  private readonly group = L.layerGroup();

  constructor(map: L.Map) {
    this.group.addTo(map);
  }

  /**
   * Rebuilds the casings for `trail` — or clears them, for null — and settles
   * the z-order. Rebuilt rather than restyled so the CSS pulse in style.css
   * starts from scratch on every selection: fresh <path> elements begin their
   * animation, where a retained one would need a class toggle plus a forced
   * reflow to re-trigger it.
   */
  show(trail: Trail | null): void {
    this.group.clearLayers();
    if (!trail) return;

    // Built from trail.segments, the same source buildTrail() strokes from, so
    // the halo can never trace a different line than the trail it marks.
    for (const ring of HALO_RINGS) {
      for (const seg of trail.segments) {
        L.polyline(
          seg.map((p) => [p.lat, p.lon] as L.LatLngExpression),
          {
            ...ring,
            lineJoin: 'round',
            lineCap: 'round',
            // Hit-testing is geometric (trailAt below); decoration must not
            // intercept the clicks meant for the map handler.
            interactive: false,
          },
        ).addTo(this.group);
      }
    }

    // Every vector layer shares one <g> in Leaflet's overlayPane, so front/back
    // is DOM order within it and this sequence is the whole z-order: the halo
    // rises above the other trails, then the selected trail's own stroke rises
    // above its halo. A custom pane could not express "between two layers that
    // both live in overlayPane".
    this.group.eachLayer((l) => (l as L.Polyline).bringToFront());
    trail.layer.eachLayer((l) => (l as L.Polyline).bringToFront());
  }
}

/**
 * The faint casing under the trail a click would pick. Its own group, apart from
 * Halo, so hovering can never disturb the selection's casings or their pulse.
 */
export class HoverHalo {
  private readonly group = L.layerGroup();
  private trail: Trail | null = null;

  constructor(map: L.Map) {
    this.group.addTo(map);
  }

  /** Draws the casing under `trail`, or clears it for null. Called on every
   *  mouse move, so the same trail again costs nothing. */
  show(trail: Trail | null): void {
    if (trail === this.trail) return;
    this.trail = trail;
    this.group.clearLayers();
    if (!trail) return;
    for (const seg of trail.segments) {
      L.polyline(
        seg.map((p) => [p.lat, p.lon] as L.LatLngExpression),
        { ...HOVER_RING, lineJoin: 'round', lineCap: 'round', interactive: false },
      ).addTo(this.group);
    }
    // Beneath every trail, not just the hovered one: bringing that trail forward
    // instead would reorder the trails themselves, and leave them reordered after
    // the mouse moved on.
    this.group.eachLayer((l) => (l as L.Polyline).bringToBack());
  }
}

/**
 * Each trail's points in absolute pixels at one zoom. Hovering runs trailAt on
 * every mouse move, and projecting ~100k points from lat/lon each time would cost
 * a frame; at a fixed zoom they only need projecting once, and panning moves the
 * pointer across them rather than them across the screen.
 */
const projected = new WeakMap<Trail, { zoom: number; segments: L.Point[][] }>();

function projectedSegments(map: L.Map, trail: Trail, zoom: number): L.Point[][] {
  let cached = projected.get(trail);
  if (!cached || cached.zoom !== zoom) {
    cached = {
      zoom,
      segments: trail.segments.map((seg) => seg.map((p) => map.project([p.lat, p.lon], zoom))),
    };
    projected.set(trail, cached);
  }
  return cached.segments;
}

/**
 * The visible trail nearest `point`, or null past the tolerance.
 *
 * A geometric test rather than a listener per polyline: the strokes are 2px
 * wide, so hit-testing them exactly is a poor target, and widening one with an
 * invisible
 * hit line per segment would permanently double the SVG node count — a cost
 * paid on every pan and zoom to save arithmetic that only runs on click and
 * hover.
 * Nearest-wins also settles overlapping trails by proximity rather than by
 * whichever happens to be drawn last.
 */
export function trailAt(map: L.Map, point: L.Point, trails: Trail[]): Trail | null {
  const limit = tolerance();
  let best: Trail | null = null;
  let bestDistance = limit;
  // The same pixels the projected trails are in. Distances come out the same as in
  // container pixels: the two differ only by an offset.
  const zoom = map.getZoom();
  const pixel = map.project(map.containerPointToLatLng(point), zoom);

  for (const trail of trails) {
    if (!trail.visible || !trail.bounds.isValid()) continue;

    // Cheap reject first: most trails are nowhere near the click and never have
    // their geometry touched at all.
    const nw = map.latLngToContainerPoint(trail.bounds.getNorthWest());
    const se = map.latLngToContainerPoint(trail.bounds.getSouthEast());
    // L.bounds() normalises the corner ordering, which latLngToContainerPoint
    // does not guarantee across projections.
    const box = L.bounds(nw, se);
    const min = box.min!;
    const max = box.max!;
    if (
      point.x < min.x - limit ||
      point.x > max.x + limit ||
      point.y < min.y - limit ||
      point.y > max.y + limit
    ) {
      continue;
    }

    for (const seg of projectedSegments(map, trail, zoom)) {
      let previous: L.Point | null = null;
      for (const current of seg) {
        if (previous) {
          const d = L.LineUtil.pointToSegmentDistance(pixel, previous, current);
          if (d < bestDistance) {
            bestDistance = d;
            best = trail;
          }
        } else if (seg.length === 1) {
          // A one-point segment has no line to measure against.
          const d = pixel.distanceTo(current);
          if (d < bestDistance) {
            bestDistance = d;
            best = trail;
          }
        }
        previous = current;
      }
    }
  }

  return best;
}

/** Above the pins (580), under your own location (markerPane, 600). */
const CURSOR_PANE = 'profile-cursor';
const CURSOR_PANE_Z_INDEX = '590';

/**
 * The dot on the map at the point the profile's cursor is on. Its own pane, so no
 * trail, halo or pin can be drawn over it, and never interactive: it marks a
 * place, and the click there still belongs to the map handler.
 */
export class ProfileCursor {
  private readonly marker: L.CircleMarker;

  constructor(private readonly map: L.Map) {
    map.createPane(CURSOR_PANE).style.zIndex = CURSOR_PANE_Z_INDEX;
    this.marker = L.circleMarker([0, 0], {
      pane: CURSOR_PANE,
      radius: 6,
      color: '#ffffff',
      weight: 3,
      fillOpacity: 1,
      className: 'profile-cursor-marker',
      interactive: false,
    });
  }

  /** Puts the dot at `at`, filled with the trail's colour, or takes it away for null. */
  show(at: { lat: number; lon: number; color: string } | null): void {
    if (!at) {
      this.marker.remove();
      return;
    }
    this.marker.setLatLng([at.lat, at.lon]);
    this.marker.setStyle({ fillColor: at.color });
    if (!this.map.hasLayer(this.marker)) this.marker.addTo(this.map);
  }
}
