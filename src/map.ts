import L from 'leaflet';
import { basemapById, MAX_ZOOM } from './basemaps';
import { angleDelta } from './geo';
import { startHeading, type Heading } from './heading';

/**
 * The location marker's markup: a heading cone and the dot. Shared with the 3D
 * view, which wraps the same element in a MapLibre Marker, so the two can never
 * draw you differently. The 48px box is the cone's full reach; the dot sits at
 * its centre. Cone first in DOM order so the dot paints over its apex.
 */
export const LOCATE_ICON_HTML =
  '<div class="locate-rotor">' +
  '<svg viewBox="-24 -24 48 48" width="48" height="48" aria-hidden="true">' +
  '<path class="locate-cone" d="M -13.766 -19.66 A 24 24 0 0 1 13.766 -19.66 L 0 0 Z"/>' +
  '</svg>' +
  '</div>' +
  '<div class="locate-dot"></div>';

export type MapHandle = {
  map: L.Map;
  setBasemap: (id: string) => void;
};

export function createMap(container: HTMLElement, basemapId: string): MapHandle {
  const map = L.map(container, {
    // Placed explicitly below rather than at Leaflet's default top-left, where
    // it sat on top of the panel's #expand button: both are z-index 1000 and
    // the control comes later in DOM order, so it won the paint and the button
    // was unreachable. Bottom-right also puts zoom in thumb reach on a phone.
    zoomControl: false,
    // Integer zoom only. Up to a source's native limit that draws tiles at their
    // own size; past it, where they are scaled up, it keeps the factor a whole
    // number — a 2x or 4x tile is blocky but sharp, where 1.7x is mush.
    zoomSnap: 1,
    zoomDelta: 1,
    // No on-map credit box.
    attributionControl: false,
  }).setView([20, 0], 2);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Leaflet caches its container size and only recomputes it on a window
  // resize, so it never learned about the panel collapsing (a 310px width
  // change with no resize event), leaving a stale tile grid and pointer
  // hit-testing offset by the same amount. Observing the container covers that
  // plus the mobile URL bar collapsing against 100dvh and orientation changes,
  // and — unlike a toggle callback — always reads the final size rather than a
  // mid-animation one.
  let pending = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
  }).observe(container);

  let source = basemapById(basemapId);
  // maxNativeZoom, not maxZoom: the latter is the whole map's ceiling, since the
  // map sets none of its own and Leaflet takes the deepest of its layers. Handing
  // it the source's limit stopped the camera dead at z19 — z17 on OpenTopoMap —
  // where 3D has always carried on past it, scaling the last tiles up.
  let layer = L.tileLayer(source.url, {
    maxNativeZoom: source.maxZoom,
    maxZoom: MAX_ZOOM,
    subdomains: source.subdomains ?? 'abc',
  }).addTo(map);

  const handle: MapHandle = {
    map,
    setBasemap(id: string) {
      const next = basemapById(id);
      if (next.id === source.id) return;
      source = next;
      map.removeLayer(layer);
      layer = L.tileLayer(next.url, {
        maxNativeZoom: next.maxZoom,
        maxZoom: MAX_ZOOM,
        subdomains: next.subdomains ?? 'abc',
      }).addTo(map);
      // No zoom clamp here: every source shares MAX_ZOOM, so coming from OSM at
      // z22 to OpenTopoMap upscales its z17 tiles rather than blanking, and you
      // keep the view you were looking at.
    },
  };

  return handle;
}

export type LocateCallbacks = {
  /** `blocked` marks the dead ends — no geolocation API, an insecure page, a
   *  denied permission — as opposed to a timeout the watch may still recover
   *  from. The locate button uses it to decide whether a click is worth
   *  anything; see syncLocateButton in main.ts. */
  onError: (message: string, blocked: boolean) => void;
  /** True only for the first fix, so we don't yank the view on every update. */
  onFix: (latlng: L.LatLng, first: boolean, accuracy: number) => void;
  /** Every heading change, for the 3D view's copy of the marker. */
  onHeading?: (heading: Heading | null) => void;
};

export function startLocating(map: L.Map, cb: LocateCallbacks): () => void {
  if (!navigator.geolocation) {
    cb.onError('This browser has no geolocation support.', true);
    return () => {};
  }
  if (!window.isSecureContext) {
    cb.onError('Geolocation needs HTTPS (or localhost).', true);
    return () => {};
  }

  // A divIcon rather than the circleMarker this used to be, for two reasons:
  // the heading cone has to rotate, which is a CSS transform on an HTML element
  // and not something a vector path option can express; and marker icons live
  // in markerPane, above the overlayPane that every trail shares — so selecting
  // a trail, which calls bringToFront() (see Halo.show), no longer buries the
  // location under it.
  const marker = L.marker([0, 0], {
    icon: L.divIcon({
      // Replaces Leaflet's default 'leaflet-div-icon' class, whose white box
      // and grey border would otherwise frame the whole thing.
      className: 'locate-icon',
      html: LOCATE_ICON_HTML,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    }),
    // The old circleMarker was interactive by default and could swallow a click
    // meant for the map handler — the same reason the halo opts out at
    // selection.ts. Hit-testing is geometric (trailAt), so nothing is lost.
    interactive: false,
    keyboard: false,
  });
  const accuracy = L.circle([0, 0], {
    radius: 0,
    color: '#1a73e8',
    weight: 1,
    fillColor: '#1a73e8',
    fillOpacity: 0.12,
  });
  let first = true;

  // Unwrapped degrees: it may drift past 360 or below 0, and that is the point.
  // Transitioning rotate(350deg) to rotate(10deg) spins 340° the wrong way, so
  // the accumulator only ever moves by the shortest signed step and the CSS
  // transition follows it honestly across north.
  let displayed = 0;
  let current: Heading | null = null;

  function applyHeading(next: Heading | null) {
    current = next;
    cb.onHeading?.(next);
    // Null until the marker is on the map, which is why the first fix re-applies
    // whatever the compass had already reported.
    const root = marker.getElement();
    if (!root) return;
    if (!next) {
      root.removeAttribute('data-heading');
      return;
    }
    displayed += angleDelta(displayed, next.degrees);
    root.style.setProperty('--heading', `${displayed}deg`);
    root.setAttribute('data-heading', next.source);
  }

  const heading = startHeading(applyHeading);

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
      marker.setLatLng(latlng);
      accuracy.setLatLng(latlng).setRadius(pos.coords.accuracy);
      if (first) {
        accuracy.addTo(map);
        marker.addTo(map);
        // The icon element only exists now, so any heading that arrived before
        // the first fix has not been written to it yet.
        applyHeading(current);
      }
      // Only consulted when no compass is live; see the latch in heading.ts.
      heading.pushFix(pos.coords.heading, pos.coords.speed);
      cb.onFix(latlng, first, pos.coords.accuracy);
      first = false;
    },
    (err) => {
      const denied = err.code === err.PERMISSION_DENIED;
      const message = denied
        ? 'Location permission denied — the map still works, you just start at a world view.'
        : `Could not get your location: ${err.message}`;
      cb.onError(message, denied);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
    heading.stop();
    map.removeLayer(marker);
    map.removeLayer(accuracy);
  };
}
