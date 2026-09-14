import L from 'leaflet';
import './style.css';

import { basemapById } from './basemaps';
import { compassNeedsPermission, requestCompassPermission, type Heading } from './heading';
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
import { loadTrailFiles } from './trailFiles';
// Type-only, and so erased: the module itself is loaded on demand in open3d(),
// which is what keeps MapLibre out of the main bundle.
import type { View3d } from './view3d';
// Imported rather than fetched, for the same reason as the TSV in points.ts.
import rawTitle from '../data/title.txt?raw';

const trails: Trail[] = [];
let settings: Settings;
/** View state, like the filter query and the panel: never persisted.
 *  Settings describes how trails render; this describes what you are
 *  currently looking at. */
let selectedId: string | null = null;

/**
 * The app name, with data/title.txt's area in brackets when the file has one:
 * the tab title and the panel heading. The heading keeps index.html's
 * non-breaking hyphens, so a narrow panel wraps before the bracket and never
 * inside the name.
 */
function applyTitle(): void {
  const place = rawTitle.trim();
  const name = place ? `oh-trail-map (${place})` : 'oh-trail-map';
  document.title = name;
  const heading = document.querySelector('.panel-head h1');
  if (heading) heading.textContent = name.replace('oh-trail-map', 'oh\u2011trail\u2011map');
}

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
  applyTitle();
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
  let lastAccuracy = 0;
  let lastHeading: Heading | null = null;
  let following = false;
  let blockedMessage: string | null = null;

  // The 3D view while it is open, and the pending open while MapLibre downloads,
  // so a second click or a trail's ▶ during the wait joins it instead of starting
  // another. Never persisted, like selectedId: which view you are in is view state.
  let view3d: View3d | null = null;
  let opening3d: Promise<View3d | null> | null = null;
  const app = document.getElementById('app')!;

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
    onZoomTo: (id) => {
      if (view3d) {
        view3d.fitTrail(id);
        return;
      }
      const trail = findTrail(id);
      if (trail?.bounds.isValid()) map.fitBounds(trail.bounds, { padding: [30, 30] });
    },
    onSelect: (id) => selectTrail(id),
    onBasemapChange: (id) => {
      settings = { ...settings, basemapId: id };
      handle.setBasemap(id);
      view3d?.setBasemap(id);
      void saveSettings(settings);
    },
    onPointsChange: (show) => {
      settings = { ...settings, showPoints: show };
      if (show) pointsLayer.addTo(map);
      else map.removeLayer(pointsLayer);
      view3d?.setPointsVisible(show);
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
      if (following && lastFix) panToFix(lastFix);
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
    onToggle3d: () => {
      if (view3d) close3d();
      else void open3d();
    },
    onWalkTrail: (id) => {
      const trail = findTrail(id);
      if (!trail) return;
      // A hidden trail would be walked with no line under your feet.
      setVisible(trail, true, map);
      selectTrail(id);
      ui.closeDrawer();
      void open3d().then((view) => view?.walkTrail(id));
    },
  });

  ui.applySettings(settings);

  // Checked by constructor presence rather than by creating a context, which
  // would spin up a GPU context on every page load just to throw it away. A
  // browser that has the constructor but still cannot make a context is caught
  // when the view is created.
  if (typeof WebGL2RenderingContext === 'undefined') ui.set3dState('unavailable');

  /** Whichever view is showing follows you. */
  function panToFix(latlng: L.LatLng): void {
    if (view3d) view3d.panTo(latlng.lat, latlng.lng);
    else map.panTo(latlng);
  }

  /** Dragging away is how following stops, in either view. */
  function stopFollowing(): void {
    if (!following) return;
    following = false;
    syncLocateButton();
  }

  function open3d(): Promise<View3d | null> {
    if (view3d) return Promise.resolve(view3d);
    if (opening3d) return opening3d;
    if (typeof WebGL2RenderingContext === 'undefined') {
      ui.notify('The 3D view needs WebGL2, which this browser does not provide.', 'error');
      return Promise.resolve(null);
    }
    ui.set3dState('loading');
    opening3d = (async () => {
      try {
        const { createView3d } = await import('./view3d');
        const centre = map.getCenter();
        const view = await createView3d({
          container: document.getElementById('map3d')!,
          getScene: () => ({
            trails,
            selectedId,
            basemapId: settings.basemapId,
            showPoints: settings.showPoints,
          }),
          start: { lat: centre.lat, lon: centre.lng, zoom: map.getZoom() },
          onSelect: (id) => selectTrail(id),
          onDragStart: stopFollowing,
          onContextLost: () => {
            ui.notify('The 3D view lost its graphics context and was closed.', 'error');
            close3d();
          },
          notify: (message, kind, timeout) => ui.notify(message, kind, timeout),
        });
        view3d = view;
        if (lastFix) view.setLocation({ lat: lastFix.lat, lon: lastFix.lng, accuracy: lastAccuracy });
        view.setHeading(lastHeading);
        app.dataset.view = '3d';
        ui.set3dState('on');
        return view;
      } catch (err) {
        // A failed chunk download (offline) lands here as well as a GPU refusal.
        ui.notify(
          `Could not open the 3D view: ${err instanceof Error ? err.message : String(err)}`,
          'error',
        );
        ui.set3dState('off');
        return null;
      } finally {
        opening3d = null;
      }
    })();
    return opening3d;
  }

  /** Back to 2D, at the place the 3D view was looking at or standing on. */
  function close3d(): void {
    if (!view3d) return;
    const back = view3d.viewFor2d();
    view3d.destroy();
    view3d = null;
    delete app.dataset.view;
    ui.set3dState('off');
    // Capped, or a basemap that stops at z17 would come back blank.
    const zoom = Math.min(back.zoom, basemapById(settings.basemapId).maxZoom);
    map.setView([back.lat, back.lon], zoom, { animate: false });
  }

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
    // Visibility changes come through here too — setVisible is always followed
    // by a restyle — so this one line keeps the 3D view's trails in step.
    view3d?.syncTrails();
  }

  /**
   * The single place selection changes. No notice names a trail hit on the map:
   * refresh() shows the selection bar, which does that with the panel closed too.
   */
  function selectTrail(id: string | null): void {
    selectedId = id;
    restyleAll();
    refresh();
  }

  // The trails are the files in data/gpx/; the store only remembers the
  // visibility you gave each one. Both are read before touching the view.
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
        nextColor(index),
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
    onFix: (latlng, first, accuracy) => {
      lastFix = latlng;
      lastAccuracy = accuracy;
      view3d?.setLocation({ lat: latlng.lat, lon: latlng.lng, accuracy });
      // A fix answers whatever the last error claimed — Chrome re-runs the
      // watch when a permission is changed from the address bar, without a
      // reload — so the button must stop showing itself as blocked.
      blockedMessage = null;
      // Only recentre on the first fix, and never over restored trails.
      if (first && !hadTrails) map.setView(latlng, 14);
      if (following) panToFix(latlng);
      syncLocateButton();
    },
    onHeading: (heading) => {
      lastHeading = heading;
      view3d?.setHeading(heading);
    },
  });

  // Dragging away is how following stops — the gesture every map app uses.
  // Deliberately not 'movestart', which also fires for our own panTo above and
  // for every wheel or pinch zoom; zooming should stay centred on you.
  map.on('dragstart', stopFollowing);
  // Leaflet's keyboard pan goes through panBy and never fires dragstart, so it
  // has to be said separately.
  map.getContainer().addEventListener('keydown', (e) => {
    if (e.key.startsWith('Arrow')) stopFollowing();
  });

  // One handler for every click. No listener is attached to the polylines
  // themselves, so every click reaches the map and trailAt() decides what was
  // hit — which makes bare map and a second click on the selected trail fall
  // out of the same expression as "deselect".
  map.on('click', (e) => {
    const hit = trailAt(map, e.containerPoint, trails);
    selectTrail(hit && hit.id !== selectedId ? hit.id : null);
  });
}

void main();
