import L from 'leaflet';
import { weightOf, type Settings, type Trail } from './trails';

/** Extra stroke width, in px, for the two casings drawn under a selected trail. */
const OUTER_PAD = 10;
const CASING_PAD = 6;

/**
 * How close a click has to land, in CSS pixels. Generous compared to the 1–10px
 * a trail is actually drawn at: the line is what you aim for, not what you can
 * realistically hit.
 */
const TOLERANCE_FINE = 15;
const TOLERANCE_COARSE = 22;

function tolerance(): number {
  return window.matchMedia('(pointer: coarse)').matches
    ? TOLERANCE_COARSE
    : TOLERANCE_FINE;
}

/**
 * The halo drawn beneath the selected trail, and nothing else. Kept out of
 * trails.ts, which owns the trail model: this is decoration over it, never
 * persisted and never exported.
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
  show(trail: Trail | null, settings: Settings): void {
    this.group.clearLayers();
    if (!trail) return;

    const weight = weightOf(settings);
    // Two casings, because one colour cannot carry every basemap: white alone
    // washes out on Carto Light, dark alone disappears on Esri satellite.
    const rings = [
      { color: '#1f2328', weight: weight + OUTER_PAD, opacity: 0.35, className: 'trail-halo-outer' },
      { color: '#ffffff', weight: weight + CASING_PAD, opacity: 0.95, className: 'trail-halo' },
    ];

    // Built from trail.segments, the same source buildTrail() strokes from, so
    // the halo can never trace a different line than the trail it marks.
    for (const ring of rings) {
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
 * The visible trail nearest `point`, or null past the tolerance.
 *
 * A geometric test rather than a listener per polyline: the strokes are 1-10px
 * wide, so hit-testing them exactly is a poor target, and widening one with an
 * invisible
 * hit line per segment would permanently double the SVG node count — a cost
 * paid on every pan and zoom to save arithmetic that only runs on click.
 * Nearest-wins also settles overlapping trails by proximity rather than by
 * whichever happens to be drawn last.
 */
export function trailAt(map: L.Map, point: L.Point, trails: Trail[]): Trail | null {
  const limit = tolerance();
  let best: Trail | null = null;
  let bestDistance = limit;

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

    for (const seg of trail.segments) {
      let previous: L.Point | null = null;
      for (const p of seg) {
        const current = map.latLngToContainerPoint([p.lat, p.lon]);
        if (previous) {
          const d = L.LineUtil.pointToSegmentDistance(point, previous, current);
          if (d < bestDistance) {
            bestDistance = d;
            best = trail;
          }
        } else if (seg.length === 1) {
          // A one-point segment has no line to measure against.
          const d = point.distanceTo(current);
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
