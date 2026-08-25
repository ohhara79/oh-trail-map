import L from 'leaflet';
import './style.css';

import { exportView, planExport, type ExportFormat } from './export';
import { compassNeedsPermission, requestCompassPermission } from './heading';
import { createMap, startLocating } from './map';
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

const trails: Trail[] = [];
let settings: Settings;
let colorCursor = 0;
/** View state, like the filter query and the panel: never persisted, never
 *  exported. Settings describes how trails render; this describes what you are
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
    name: trail.name,
    color: trail.color,
    visible: trail.visible,
    gpxText: trail.gpxText,
    addedAt: Number(trail.id.split('-')[0]) || Date.now(),
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

  const ui = new Ui({
    onImport: (files) => void importFiles(files),
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
      restyleTrail(trail, settings, selectedId);
      void putTrail(toRecord(trail));
    },
    onRemove: (id) => {
      const index = trails.findIndex((t) => t.id === id);
      if (index < 0) return;
      map.removeLayer(trails[index].layer);
      trails.splice(index, 1);
      if (selectedId === id) selectedId = null;
      void deleteTrail(id);
      restyleAll();
      refresh();
    },
    onZoomTo: (id) => {
      const trail = findTrail(id);
      if (trail?.bounds.isValid()) map.fitBounds(trail.bounds, { padding: [30, 30] });
    },
    onSelect: (id) => selectTrail(id),
    onUniformChange: (enabled, color) => {
      settings = { ...settings, uniformColor: enabled, uniformColorValue: color };
      restyleAll();
      void saveSettings(settings);
      refresh();
    },
    onTrailWidthChange: (weight) => {
      settings = { ...settings, trailWeight: weight };
      // restyleAll, not just the strokes: the halo's casings are derived from
      // weightOf(), so they have to follow the slider too.
      restyleAll();
      void saveSettings(settings);
    },
    onBasemapChange: (id) => {
      settings = { ...settings, basemapId: id };
      handle.setBasemap(id);
      void saveSettings(settings);
      updateEstimate();
    },
    onExport: (format, scale) => void runExport(format, scale),
    onExportOptionChange: () => updateEstimate(),
    onFilterChange: () => refresh(),
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

  function refresh(): void {
    ui.renderTrails(trails, settings, selectedId);
    updateEstimate();
  }

  /**
   * The one place map styling is re-applied. Colour, width and selection all
   * land through it, so they can never be applied by different paths and drift.
   */
  function restyleAll(): void {
    for (const trail of trails) restyleTrail(trail, settings, selectedId);
    halo.show(trails.find((t) => t.id === selectedId && t.visible) ?? null, settings);
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

  function updateEstimate(): void {
    const { scale } = ui.exportSelection();
    ui.showEstimate(planExport(map, handle.source, scale), scale);
  }

  async function importFiles(files: File[]): Promise<void> {
    let imported = 0;
    for (const file of files) {
      try {
        const text = await file.text();
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const trail = buildTrail(
          id,
          text,
          file.name,
          nextColor(colorCursor++),
          true,
          settings,
        );
        trails.push(trail);
        trail.layer.addTo(map);
        await putTrail(toRecord(trail));
        imported++;
      } catch (err) {
        ui.notify(err instanceof Error ? err.message : String(err), 'error');
      }
    }
    if (imported > 0) {
      // Not just for the newcomers' dimming: a freshly added layer lands on top
      // of the halo in DOM order, so the z-order has to be settled again.
      restyleAll();
      refresh();
      const bounds = visibleBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
      ui.notify(`Imported ${imported} trail${imported === 1 ? '' : 's'}.`);
    }
  }

  async function runExport(format: ExportFormat, scale: number): Promise<void> {
    ui.setExporting(true);
    try {
      const result = await exportView({
        map,
        source: handle.source,
        trails,
        settings,
        scale,
        format,
        onProgress: (done, total) => ui.setProgress(done, total),
      });

      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      link.href = url;
      link.download = `trail-map-${stamp}-${result.plan.achievedScale}x.${result.extension}`;
      link.click();
      // Revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      const size = `${result.plan.width}×${result.plan.height} px`;
      ui.notify(
        result.plan.clamped
          ? `Exported ${size} at ${result.plan.achievedScale}× — ${scale}× exceeds this basemap's zoom ${result.plan.tileZoom} limit.`
          : `Exported ${size}.`,
      );
    } catch (err) {
      ui.notify(err instanceof Error ? err.message : String(err), 'error', 12000);
    } finally {
      ui.setExporting(false);
      updateEstimate(); // re-derives whether Export should be enabled
    }
  }

  // Restore previously imported trails before touching the view.
  try {
    const records = await loadTrails();
    for (const record of records) {
      try {
        const trail = buildTrail(
          record.id,
          record.gpxText,
          record.name,
          record.color,
          record.visible,
          settings,
        );
        trails.push(trail);
        if (trail.visible) trail.layer.addTo(map);
        colorCursor++;
      } catch {
        // A record that no longer parses is dropped rather than blocking boot.
        void deleteTrail(record.id);
      }
    }
  } catch {
    ui.notify('Could not read saved trails from this browser.', 'error');
  }

  refresh();

  const restored = visibleBounds();
  const hadTrails = restored.isValid();
  if (hadTrails) map.fitBounds(restored, { padding: [30, 30] });

  // iOS 13+ only. Everywhere else the compass either needs no permission or
  // does not exist, and an unusable button would be worse than none.
  if (compassNeedsPermission()) ui.setCompassButton(true);

  startLocating(map, {
    onError: (message) => ui.notify(message),
    onFix: (latlng, first) => {
      // Only recentre on the first fix, and never over restored trails.
      if (first && !hadTrails) map.setView(latlng, 14);
    },
  });

  // One handler for every click. No listener is attached to the polylines
  // themselves, so every click reaches the map and trailAt() decides what was
  // hit — which makes bare map and a second click on the selected trail fall
  // out of the same expression as "deselect".
  map.on('click', (e) => {
    const hit = trailAt(map, e.containerPoint, trails);
    selectTrail(hit && hit.id !== selectedId ? hit.id : null, true);
  });

  map.on('zoomend moveend resize', updateEstimate);
  updateEstimate();
}

void main();
