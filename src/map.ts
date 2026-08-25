import L from 'leaflet';
import { basemapById, type Basemap } from './basemaps';

export type MapHandle = {
  map: L.Map;
  source: Basemap;
  setBasemap: (id: string) => void;
};

export function createMap(container: HTMLElement, basemapId: string): MapHandle {
  const map = L.map(container, {
    // Placed explicitly below rather than at Leaflet's default top-left, where
    // it sat on top of the panel's #expand button: both are z-index 1000 and
    // the control comes later in DOM order, so it won the paint and the button
    // was unreachable. Bottom-right also puts zoom in thumb reach on a phone.
    zoomControl: false,
    // Integer zoom only: the exporter derives its tile zoom as z + log2(scale),
    // and fractional zoom would make "4x" not mean exactly 4x.
    zoomSnap: 1,
    zoomDelta: 1,
    attributionControl: true,
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
  let layer = L.tileLayer(source.url, {
    maxZoom: source.maxZoom,
    subdomains: source.subdomains ?? 'abc',
    attribution: source.attribution,
    crossOrigin: 'anonymous',
  }).addTo(map);

  const handle: MapHandle = {
    map,
    get source() {
      return source;
    },
    setBasemap(id: string) {
      const next = basemapById(id);
      if (next.id === source.id) return;
      source = next;
      map.removeLayer(layer);
      layer = L.tileLayer(next.url, {
        maxZoom: next.maxZoom,
        subdomains: next.subdomains ?? 'abc',
        attribution: next.attribution,
        crossOrigin: 'anonymous',
      }).addTo(map);
      // Zooming past the new source's limit would leave a blank canvas.
      if (map.getZoom() > next.maxZoom) map.setZoom(next.maxZoom);
    },
  };

  return handle;
}

export type LocateCallbacks = {
  onError: (message: string) => void;
  /** True only for the first fix, so we don't yank the view on every update. */
  onFix: (latlng: L.LatLng, first: boolean) => void;
};

export function startLocating(map: L.Map, cb: LocateCallbacks): () => void {
  if (!navigator.geolocation) {
    cb.onError('This browser has no geolocation support.');
    return () => {};
  }
  if (!window.isSecureContext) {
    cb.onError('Geolocation needs HTTPS (or localhost).');
    return () => {};
  }

  const marker = L.circleMarker([0, 0], {
    radius: 6,
    color: '#fff',
    weight: 2,
    fillColor: '#1a73e8',
    fillOpacity: 1,
  });
  const accuracy = L.circle([0, 0], {
    radius: 0,
    color: '#1a73e8',
    weight: 1,
    fillColor: '#1a73e8',
    fillOpacity: 0.12,
  });
  let first = true;

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
      marker.setLatLng(latlng);
      accuracy.setLatLng(latlng).setRadius(pos.coords.accuracy);
      if (first) {
        accuracy.addTo(map);
        marker.addTo(map);
      }
      cb.onFix(latlng, first);
      first = false;
    },
    (err) => {
      const message =
        err.code === err.PERMISSION_DENIED
          ? 'Location permission denied — the map still works, you just start at a world view.'
          : `Could not get your location: ${err.message}`;
      cb.onError(message);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
    map.removeLayer(marker);
    map.removeLayer(accuracy);
  };
}
