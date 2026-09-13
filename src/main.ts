import L from 'leaflet';
import './style.css';

import { compassNeedsPermission, requestCompassPermission } from './heading';
import { createMap, startLocating } from './map';
import { loadNationalPoints, createPointsLayer } from './points';
import { Halo, trailAt } from './selection';
import {
  buildTrail,
  DEFAULT_SETTINGS,
  nextColor,
  restyleTrail,
  type Settings,
  type Trail,
} from './trails';
import {
  deleteTrail,
  loadSettings,
  loadTrails,
  putTrail,
  saveSettings,
  type TrailRecord,
} from './store';
import { Ui } from './ui';
import { formatDistance } from './gpx';
import { loadTrailFiles } from './trailFiles';

const trails: Trail[] = [];
let settings: Settings;
/** View state, like the filter query and the panel: never persisted.
 *  Settings describes how trails render; this describes what you are
 *  currently looking at. */
let selectedId: string | null = null;

function findTrail(id: string): Trail | undefined {
  return trails.find((t) => t.id === id);
}

/**
 * The single place a trail's visibility changes: flips the flag, syncs the map
 * layer, and persists. Shared by the per-trail checkbox and the show/hide-all
 * toggle so the two can never diverge. The early return keeps a bulk toggle
 * from re-writing records that already agree — putTrail opens one IndexedDB
 * transaction per record.
 */
function setVisible(trail: Trail, visible: boolean, map: L.Map): void {
  if (trail.visible === visible) return;
  trail.visible = visible;
  if (visible) trail.layer.addTo(map);
  else map.removeLayer(trail.layer);
  // A highlight on a trail that is no longer drawn would leave a halo tracing
  // nothing. The caller restyles and re-renders afterwards either way.
  if (!visible && selectedId === trail.id) selectedId = null;
  void putTrail(toRecord(trail));
}

function toRecord(trail: Trail): TrailRecord {
  return {
    id: trail.id,
    color: trail.color,
    visible: trail.visible,
  };
}

function visibleBounds(): L.LatLngBounds {
  const bounds = L.latLngBounds([]);
  for (const trail of trails) {
    if (trail.visible && trail.bounds.isValid()) bounds.extend(trail.bounds);
  }
  return bounds;
}

async function main(): Promise<void> {
  settings = await loadSettings().catch(() => DEFAULT_SETTINGS);

  const handle = createMap(document.getElementById('map')!, settings.basemapId);
  const { map } = handle;
  const halo = new Halo(map);

  // The National Point Number pins. They draw in their own pane (see points.ts), so this
  // can sit wherever it reads best rather than having to run before startLocating.
  const pointsLayer = createPointsLayer(map, loadNationalPoints());
  if (settings.showPoints) pointsLayer.addTo(map);

  // Follow state for the bottom-right locate button. lastFix is the only copy
  // of the current position outside startLocating's closure, and blockedMessage
  // latches the geolocation errors that will never resolve on their own.
  let lastFix: L.LatLng | null = null;
  let following = false;
  let blockedMessage: string | null = null;

  const ui = new Ui({
    onToggle: (id, visible) => {
      const trail = findTrail(id);
      if (!trail) return;
      setVisible(trail, visible, map);
      restyleAll();
      refresh();
    },
    onToggleAll: (visible, ids) => {
      // Only the rows the UI actually showed: a filter must not let one click
      // reach the trails it hid.
      const wanted = new Set(ids);
      for (const trail of trails) {
        if (wanted.has(trail.id)) setVisible(trail, visible, map);
      }
      restyleAll();
      refresh();
    },
    onTrailColor: (id, color) => {
      const trail = findTrail(id);
      if (!trail) return;
      trail.color = color;
      restyleTrail(trail, selectedId);
      void putTrail(toRecord(trail));
    },
    onZoomTo: (id) => {
      const trail = findTrail(id);
      if (trail?.bounds.isValid()) map.fitBounds(trail.bounds, { padding: [30, 30] });
    },
    onSelect: (id) => selectTrail(id),
    onBasemapChange: (id) => {
      settings = { ...settings, basemapId: id };
      handle.setBasemap(id);
      void saveSettings(settings);
    },
    onPointsChange: (show) => {
      settings = { ...settings, showPoints: show };
      if (show) pointsLayer.addTo(map);
      else map.removeLayer(pointsLayer);
      void saveSettings(settings);
    },
    onFilterChange: () => refresh(),
    onLocate: () => {
      if (blockedMessage) {
        // The watch does not retry after a denial, so the only honest thing a
        // click can do is say again why nothing is happening.
        ui.notify(blockedMessage);
        return;
      }
      following = !following;
      // panTo, not setView: following moves the centre and never the zoom.
      if (following && lastFix) map.panTo(lastFix);
      else if (following) ui.notify('Finding your location…', 'info', 3000);
      syncLocateButton();
    },
    onCompass: () => {
      void requestCompassPermission().then((granted) => {
        // On a grant there is nothing left to ask, so the button goes. On a
        // denial it stays: iOS will not prompt again this page load, and the
        // button is the only way back after a reload.
        ui.setCompassButton(!granted);
        if (!granted) {
          ui.notify(
            'Compass permission denied — the direction cone will only show while you are moving.',
            'error',
          );
        }
      });
    },
  });

  ui.applySettings(settings);

  /** The single place the locate button's appearance is derived. */
  function syncLocateButton(): void {
    ui.setLocateState(
      blockedMessage !== null ? 'blocked' : !following ? 'off' : lastFix ? 'on' : 'searching',
    );
  }

  function refresh(): void {
    ui.renderTrails(trails, selectedId);
  }

  /**
   * The one place map styling is re-applied. Colour and selection both
   * land through it, so they can never be applied by different paths and drift.
   */
  function restyleAll(): void {
    for (const trail of trails) restyleTrail(trail, selectedId);
    halo.show(trails.find((t) => t.id === selectedId && t.visible) ?? null);
  }

  /** The single place selection changes. */
  function selectTrail(id: string | null, fromMap = false): void {
    selectedId = id;
    restyleAll();
    refresh();
    // On a phone the drawer starts closed, and on desktop it can be collapsed,
    // so a map click may have no row to highlight. Name what was hit instead.
    const trail = id ? findTrail(id) : undefined;
    if (fromMap && trail) {
      ui.notify(`${trail.name} — ${formatDistance(trail.stats.distance)}`, 'info', 3000);
    }
  }

  // The trails are the files in data/gpx/; the store only remembers the colour
  // and visibility you gave each one. Both are read before touching the view.
  const [files, records] = await Promise.all([
    loadTrailFiles().catch(() => {
      ui.notify('Could not load the GPX files.', 'error');
      return [];
    }),
    loadTrails().catch(() => {
      ui.notify('Could not read saved trail settings from this browser.', 'error');
      return null;
    }),
  ]);
  const saved = new Map(records?.map((r) => [r.id, r]));
  files.forEach(({ file, text }, index) => {
    const record = saved.get(file);
    try {
      const trail = buildTrail(
        file,
        text,
        file,
        record?.color ?? nextColor(index),
        record?.visible ?? true,
      );
      trails.push(trail);
      if (trail.visible) trail.layer.addTo(map);
    } catch (err) {
      // A file that does not parse is skipped rather than blocking the rest.
      ui.notify(err instanceof Error ? err.message : String(err), 'error');
    }
  });
  // Records for files no longer in data/gpx/ — and every record left from when
  // trails were imported — have nothing to describe. Skipped when the store
  // could not be read, and never a file that merely failed to parse.
  const present = new Set(files.map((f) => f.file));
  for (const id of saved.keys()) if (!present.has(id)) void deleteTrail(id);

  refresh();

  const restored = visibleBounds();
  const hadTrails = restored.isValid();
  if (hadTrails) map.fitBounds(restored, { padding: [30, 30] });

  // iOS 13+ only. Everywhere else the compass either needs no permission or
  // does not exist, and an unusable button would be worse than none.
  if (compassNeedsPermission()) ui.setCompassButton(true);

  startLocating(map, {
    onError: (message, blocked) => {
      ui.notify(message);
      if (!blocked) return;
      // Nothing is coming, so stop claiming to be waiting for it.
      blockedMessage = message;
      following = false;
      syncLocateButton();
    },
    onFix: (latlng, first) => {
      lastFix = latlng;
      // A fix answers whatever the last error claimed — Chrome re-runs the
      // watch when a permission is changed from the address bar, without a
      // reload — so the button must stop showing itself as blocked.
      blockedMessage = null;
      // Only recentre on the first fix, and never over restored trails.
      if (first && !hadTrails) map.setView(latlng, 14);
      if (following) map.panTo(latlng);
      syncLocateButton();
    },
  });

  // Dragging away is how following stops — the gesture every map app uses.
  // Deliberately not 'movestart', which also fires for our own panTo above and
  // for every wheel or pinch zoom; zooming should stay centred on you.
  map.on('dragstart', () => {
    if (!following) return;
    following = false;
    syncLocateButton();
  });
  // Leaflet's keyboard pan goes through panBy and never fires dragstart, so it
  // has to be said separately.
  map.getContainer().addEventListener('keydown', (e) => {
    if (!following || !e.key.startsWith('Arrow')) return;
    following = false;
    syncLocateButton();
  });

  // One handler for every click. No listener is attached to the polylines
  // themselves, so every click reaches the map and trailAt() decides what was
  // hit — which makes bare map and a second click on the selected trail fall
  // out of the same expression as "deselect".
  map.on('click', (e) => {
    const hit = trailAt(map, e.containerPoint, trails);
    selectTrail(hit && hit.id !== selectedId ? hit.id : null, true);
  });
}

void main();
