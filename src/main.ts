import L from 'leaflet';
import './style.css';

import { basemapById } from './basemaps';
import { compassNeedsPermission, requestCompassPermission, type Heading } from './heading';
import { createMap, startLocating } from './map';
import type { NationalPoint } from './nationalPoint';
import { loadNationalPoints, createPointsLayer, openPointPopup, pointRows } from './points';
import { PointsList } from './pointsList';
import { canHover, createHoverLabel } from './hoverLabel';
import { ProfilePanel } from './profilePanel';
import { Halo, HoverHalo, nearestPointIndex, ProfileCursor, trailAt } from './selection';
import { buildProfile } from './trailProfile';
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
import rawName from '../data/name.txt?raw';
import rawEmail from '../data/email.txt?raw';
import rawHomepage from '../data/homepage.txt?raw';

const trails: Trail[] = [];
let settings: Settings;
/** View state, like the filter query and the panel: never persisted.
 *  Settings describes how trails render; this describes what you are
 *  currently looking at. */
let selectedId: string | null = null;
/** How far in a row click from the National Points list zooms — close enough that
 *  the pin is distinct from its neighbours, which stand as little as 50 m apart. */
const POINT_ZOOM = 17;

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

/**
 * The author, from data/name.txt, email.txt and homepage.txt, at the end of the
 * panel. An empty file hides its line; all three empty leave the footer hidden.
 */
function applyAbout(): void {
  const name = rawName.trim();
  const email = rawEmail.trim();
  const homepage = rawHomepage.trim();

  const nameEl = document.getElementById('about-name')!;
  nameEl.textContent = name;
  nameEl.hidden = !name;

  const emailEl = document.getElementById('about-email') as HTMLAnchorElement;
  emailEl.textContent = email;
  emailEl.href = `mailto:${email}`;
  emailEl.parentElement!.hidden = !email;

  const homepageEl = document.getElementById('about-homepage') as HTMLAnchorElement;
  homepageEl.textContent = homepage;
  homepageEl.href = homepage;
  homepageEl.parentElement!.hidden = !homepage;

  document.getElementById('about')!.hidden = !(name || email || homepage);
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
  applyAbout();
  settings = await loadSettings().catch(() => DEFAULT_SETTINGS);

  const handle = createMap(document.getElementById('map')!, settings.basemapId);
  const { map } = handle;
  const halo = new Halo(map);

  // The hover preview: what a click at the mouse would pick, shown before the
  // click. All of it is derived in syncHover(); these are only its inputs.
  const hoverHalo = new HoverHalo(map);
  const hoverLabel = createHoverLabel(map.getContainer());
  /** Where the mouse is over the map, or null when it is not. */
  let hoverAt: L.Point | null = null;
  /** The pin under the mouse. A pin takes the click over any trail beneath it. */
  let hoveredPin: NationalPoint | null = null;
  /** Between movestart and moveend: the map is sliding under a pointer that has
   *  not moved, and a drag is not about to click anything. */
  let mapMoving = false;
  let hoverFrame = 0;

  // The elevation profile. profileOpen is whether you asked for it, and outlives
  // a change of selection; profileTrail is the trail it is actually showing — the
  // selected one while it is open, null otherwise. cursorIndex is the GPX point
  // its cursor is on, and setCursor() the only writer of it.
  let profileOpen = false;
  let profileTrail: Trail | null = null;
  let cursorIndex: number | null = null;
  // The trail 3D playback is walking, if any. While it plays it takes the panel
  // over — the readout is the only place the point you are standing on is spelled
  // out in 3D — without touching profileOpen, so the panel goes back to whatever
  // 2D had the moment playback ends. No point number of its own: cursorIndex is
  // that number, and a second copy would give the cursor two writers.
  let playbackTrail: Trail | null = null;
  const profileCursor = new ProfileCursor(map);
  const profilePanel = new ProfilePanel({
    onCursor: (index) => {
      // While a trail plays the cursor is the playback's own position, so moving
      // it is a seek. Setting it here as well would only be hauled back by the
      // next frame; the seek comes back through onPlaybackPoint instead.
      if (playbackTrail) view3d?.seekToPoint(index);
      else setCursor(index);
    },
  });

  // The National Point Number pins. They draw in their own pane (see points.ts), so this
  // can sit wherever it reads best rather than having to run before startLocating.
  // The open point popup, if any, and the point it describes. A pin opens one only
  // when nothing is selected, like a trail click (see clearMapSelection).
  const points = loadNationalPoints();
  const pointByCode = new Map(points.map((point) => [point.code, point]));
  /** The 지점번호 whose pins are off, as the app reads it. Settings holds the same
   *  thing as an array, rebuilt from here whenever this changes. */
  const hiddenPoints = new Set(settings.hiddenPoints);
  let pointPopup: L.Popup | null = null;
  let popupPoint: NationalPoint | null = null;
  /** The 지점번호 the panel list draws as selected: whichever point has a popup
   *  open in the view you are looking at. View state, like selectedId. */
  let selectedPointCode: string | null = null;
  const pointsLayer = createPointsLayer(
    map,
    points,
    (point) => {
      if (clearMapSelection()) return;
      openPoint(point);
    },
    (point) => {
      hoveredPin = point;
      scheduleHover();
    },
  );
  // Added once and never removed: sync() below decides which pins are in it.
  pointsLayer.layer.addTo(map);
  pointsLayer.sync(hiddenPoints);

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
      // Capped at the source's native level: framing a trail is automatic, and
      // a 200 m loop would otherwise land on upscaled tiles you never asked for.
      // Zooming in by hand still goes deeper.
      if (trail?.bounds.isValid())
        map.fitBounds(trail.bounds, {
          padding: [30, 30],
          maxZoom: basemapById(settings.basemapId).maxZoom,
        });
    },
    onSelect: (id) => selectTrail(id),
    onBasemapChange: (id) => {
      settings = { ...settings, basemapId: id };
      handle.setBasemap(id);
      view3d?.setBasemap(id);
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
      // A point picked on this trail's profile is where the walk starts; taken
      // before selectTrail, which could move the panel off it.
      const from = profileTrail === trail && cursorIndex !== null ? cursorIndex : undefined;
      // A hidden trail would be walked with no line under your feet.
      setVisible(trail, true, map);
      selectTrail(id);
      ui.closeDrawer();
      void open3d().then((view) => view?.walkTrail(id, from));
    },
    onToggleProfile: () => {
      profileOpen = !profileOpen;
      syncProfile();
    },
  });

  const pointsList = new PointsList(pointRows(points), {
    onToggle: (code, visible) => setPointsHidden([code], !visible),
    onToggleAll: (visible, codes) => {
      // Only the rows the list actually showed: a filter must not let one click
      // reach the points it hid.
      setPointsHidden(codes, !visible);
    },
    onFilterChange: () => pointsList.render(hiddenPoints, selectedPointCode),
    onSelect: (code) => {
      const point = pointByCode.get(code);
      if (!point) return;
      // Like a trail row, which zooms to a hidden trail without turning it on: a
      // row click is you asking for this point now. It selects the point, not the
      // trail — a trail already selected stays selected — and the highlight comes
      // from the popup either branch below opens, never from here.
      if (view3d) {
        view3d.showPoint(point);
      } else {
        // Never zooms out: you may already be closer in than POINT_ZOOM — as
        // close as MAX_ZOOM, now that a basemap's native limit no longer stops
        // the camera.
        const zoom = Math.max(map.getZoom(), POINT_ZOOM);
        map.setView([point.lat, point.lon], zoom);
        openPoint(point);
      }
      // The one place this diverges from a trail row: the drawer covers most of a
      // phone screen and the popup is the whole payload of the click, where a
      // trail row's zoom survives being looked at later.
      ui.closeDrawer();
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
            hiddenPoints,
          }),
          start: { lat: centre.lat, lon: centre.lng, zoom: map.getZoom() },
          onSelect: (id) => selectTrail(id),
          onPointPopup: (point) => selectPoint(point),
          onStopFollowing: stopFollowing,
          onPlaybackPoint: (id, index) => {
            const trail = (id !== null && findTrail(id)) || null;
            if (trail !== playbackTrail) {
              playbackTrail = trail;
              // Swaps the panel onto the playing trail, or back to the selection.
              syncProfile();
              // The 3D dot is drawn off playback only, so the swap has to reach it
              // even where neither the trail nor the point moved with it.
              applyCursor();
            }
            // Playback stopping leaves the point it stopped on where it is: a panel
            // still open on that trail goes on naming it, and the dot marks the spot
            // you stepped off. Only a trail playing ever names a new one.
            if (index !== null) setCursor(index);
          },
          onContextLost: () => {
            ui.notify('The 3D view lost its graphics context and was closed.', 'error');
            close3d();
          },
          notify: (message, kind, timeout) => ui.notify(message, kind, timeout),
        });
        view3d = view;
        // The 2D popup is left open behind the switch — close3d comes back to it —
        // but nothing is open in the view you are now looking at, so nothing is
        // highlighted either.
        selectPoint(null);
        if (lastFix) view.setLocation({ lat: lastFix.lat, lon: lastFix.lng, accuracy: lastAccuracy });
        view.setHeading(lastHeading);
        view.setFollowing(following);
        view.setProfileCursor(cursorAt());
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
    // The one way out of playback that never reaches setMode in view3d.ts, so
    // there is no frame left to report the end of it. Before destroy(), so the
    // setProfileCursor(null) inside applyCursor still reaches a live map.
    if (playbackTrail) {
      playbackTrail = null;
      syncProfile();
    }
    const back = view3d.viewFor2d();
    view3d.destroy();
    view3d = null;
    // destroy() takes its popup down with the GL context rather than through
    // closePopup, so the highlight is set back here — to the 2D popup that was
    // still open underneath, if there was one.
    selectPoint(popupPoint);
    delete app.dataset.view;
    ui.set3dState('off');
    // Uncapped: 2D reaches MAX_ZOOM, which is exactly what orbit tops out at, so
    // however far in you were is a zoom 2D can hold.
    map.setView([back.lat, back.lon], back.zoom, { animate: false });
  }

  /** The single place the locate button's appearance is derived. */
  function syncLocateButton(): void {
    ui.setLocateState(
      blockedMessage !== null ? 'blocked' : !following ? 'off' : lastFix ? 'on' : 'searching',
    );
    view3d?.setFollowing(following);
  }

  function refresh(): void {
    ui.renderTrails(trails, selectedId);
    // Every change of selection ends in a refresh — including setVisible clearing
    // it, which never goes through selectTrail — so the profile follows from here.
    syncProfile();
  }

  /**
   * The panel, and the trail it is for, from playback, profileOpen and the
   * selection. A trail playing in 3D wins: it is the trail you are standing on,
   * the selection bar that holds the toggle is hidden there, and a tap on the
   * scene is what puts the panel away with the rest of the controls.
   */
  function syncProfile(): void {
    const selected = (profileOpen && selectedId !== null && findTrail(selectedId)) || null;
    const trail = playbackTrail ?? selected;
    ui.setProfileShown(trail !== null);
    if (trail === profileTrail) return;
    profileTrail = trail;
    // A point number means nothing on another trail.
    cursorIndex = null;
    // A trail's id is its file name in data/gpx/ (see trailFiles.ts).
    profilePanel.show(trail ? buildProfile(trail) : null, trail?.id);
    applyCursor();
  }

  /** The single place the profile's cursor moves. */
  function setCursor(index: number | null): void {
    if (index === cursorIndex) return;
    cursorIndex = index;
    applyCursor();
  }

  /** Where the cursor's point is, for the two map dots. */
  function cursorAt(): { lat: number; lon: number; color: string } | null {
    if (!profileTrail || cursorIndex === null) return null;
    const profile = buildProfile(profileTrail);
    return { lat: profile.lat[cursorIndex], lon: profile.lon[cursorIndex], color: profileTrail.color };
  }

  /** The panel, the 2D dot and the 3D dot, from cursorIndex. */
  function applyCursor(): void {
    const at = cursorAt();
    profilePanel.setCursor(cursorIndex);
    profileCursor.show(at);
    // Not while playing: the cursor's point is the spot the camera stands on, so
    // the dot would sit on the lens rather than mark anything. The 2D dot still
    // gets it, and is right the moment 3D closes.
    view3d?.setProfileCursor(playbackTrail ? null : at);
  }

  /** Opens a point's popup and remembers whose it is, so hiding that point can
   *  take the popup with it. The only place pointPopup is written. */
  function openPoint(point: NationalPoint): void {
    pointPopup = openPointPopup(map, point);
    popupPoint = point;
    selectPoint(point);
  }

  function closePointPopup(): void {
    if (pointPopup) map.closePopup(pointPopup);
    pointPopup = null;
    popupPoint = null;
    selectPoint(null);
  }

  /**
   * The single place the panel list's highlight changes, as selectTrail is for a
   * trail. Every 2D path reaches it through openPoint and closePointPopup above —
   * a row click, a pin click, clearMapSelection, and syncPoints taking the popup
   * of a point you just hid — and the 3D view reports its own popup through
   * onPointPopup.
   */
  function selectPoint(point: NationalPoint | null): void {
    const code = point?.code ?? null;
    if (code === selectedPointCode) return;
    selectedPointCode = code;
    pointsList.render(hiddenPoints, selectedPointCode);
  }

  /**
   * The single place a national point's visibility changes: updates the set, syncs
   * both views and persists once.
   *
   * Takes many codes rather than one so the master checkbox costs one saveSettings
   * and one setFilter instead of 272 of each — the same reason setVisible above
   * refuses to rewrite a record that already agrees.
   */
  function setPointsHidden(codes: Iterable<string>, hidden: boolean): void {
    let changed = false;
    for (const code of codes) {
      if (hidden === hiddenPoints.has(code)) continue;
      if (hidden) hiddenPoints.add(code);
      else hiddenPoints.delete(code);
      changed = true;
    }
    if (changed) {
      syncPoints();
      // The array is the shape IndexedDB stores, the Set the shape the app reads.
      // Rebuilt here, in the only place the Set changes, so the two cannot drift.
      settings = { ...settings, hiddenPoints: [...hiddenPoints] };
      void saveSettings(settings);
    }
    // Outside the guard: the browser has already flipped the checkbox that was
    // clicked, so the rows are re-read from the hidden set either way.
    pointsList.render(hiddenPoints, selectedPointCode);
  }

  /** The 2D pins, a popup either view may have left pointing at a pin that is
   *  gone, and the 3D layer. */
  function syncPoints(): void {
    pointsLayer.sync(hiddenPoints);
    if (popupPoint && hiddenPoints.has(popupPoint.code)) closePointPopup();
    // A pin removed from under the mouse never reports the mouse leaving it.
    if (hoveredPin && hiddenPoints.has(hoveredPin.code)) hoveredPin = null;
    scheduleHover();
    view3d?.syncPoints();
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
    // Selecting ends the preview, clearing lets it back, and a hidden trail can
    // no longer be picked.
    scheduleHover();
  }

  /** Coalesces the mouse moves and state changes of one frame into one syncHover. */
  function scheduleHover(): void {
    if (hoverFrame) return;
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = 0;
      syncHover();
    });
  }

  /**
   * The single place the 2D hover preview is derived. It asks what a click at the
   * mouse would do in the order the click handlers do: nothing new while a popup
   * is open or a trail is selected (that click only clears), then the pin under
   * the mouse, then trailAt() — the click's own function, so the preview and the
   * click cannot disagree.
   */
  function syncHover(): void {
    const popupOpen = pointPopup?.isOpen() ?? false;
    const at = !view3d && !mapMoving && canHover() && !popupOpen && selectedId === null ? hoverAt : null;
    const pin = at ? hoveredPin : null;
    const trail = at && !pin ? trailAt(map, at, trails) : null;
    pointsLayer.setHovered(pin?.code ?? null);
    hoverHalo.show(trail);
    // The pointer a pin already gets from Leaflet, given to a trail within reach.
    map.getContainer().classList.toggle('map-pick', trail !== null);
    const name = pin ? pin.name || pin.code : trail?.name;
    if (at && name) hoverLabel.show(name, at.x, at.y);
    else hoverLabel.hide();

    // With the profile open, the selected trail answers the mouse too: near it, the
    // cursor moves to the nearest point. Only the cursor — a click there still
    // clears the selection, as any click does while one is made.
    if (profileTrail?.visible && hoverAt && !view3d && !mapMoving && canHover() && !popupOpen) {
      const index = nearestPointIndex(map, hoverAt, profileTrail);
      if (index !== null) setCursor(index);
    }
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

  /**
   * Clears what a map click picked — the selected trail and the open point popup
   * — and says whether there was anything. A click that clears does nothing
   * else, so a click that misses empty map never jumps to a neighbouring trail
   * or pin.
   */
  function clearMapSelection(): boolean {
    const popupOpen = pointPopup?.isOpen() ?? false;
    const trailSelected = selectedId !== null;
    if (popupOpen) closePointPopup();
    if (trailSelected) selectTrail(null);
    return popupOpen || trailSelected;
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
  pointsList.render(hiddenPoints, selectedPointCode);

  const restored = visibleBounds();
  const hadTrails = restored.isValid();
  if (hadTrails)
    map.fitBounds(restored, {
      padding: [30, 30],
      maxZoom: basemapById(settings.basemapId).maxZoom,
    });

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

  // One handler for every click off the pins. No listener is attached to the
  // polylines themselves, so every click reaches the map and trailAt() decides
  // what was hit. While a trail is selected or a popup is open, any click only
  // clears it; a trail is picked only from a clear map.
  map.on('click', (e) => {
    if (clearMapSelection()) return;
    const hit = trailAt(map, e.containerPoint, trails);
    if (hit) selectTrail(hit.id);
  });

  // The hover preview's inputs; syncHover() above turns them into what is shown.
  // Over a pin as well: the pins do not listen for mousemove, so it still reaches
  // the map. Over a control or an open popup it does too, where there is nothing
  // on the map to pick, so those count as off the map.
  const mapPane = map.getPane('mapPane')!;
  const mapContainer = map.getContainer();
  map.on('mousemove', (e) => {
    const target = e.originalEvent.target as Node;
    const inPopup = target instanceof Element && target.closest('.leaflet-popup') !== null;
    const onMap = target === mapContainer || (mapPane.contains(target) && !inPopup);
    hoverAt = onMap ? e.containerPoint : null;
    scheduleHover();
  });
  mapContainer.addEventListener('mouseleave', () => {
    hoverAt = null;
    scheduleHover();
  });
  map.on('movestart', () => {
    mapMoving = true;
    scheduleHover();
  });
  // The mouse has not moved, but the map has under it.
  map.on('moveend', () => {
    mapMoving = false;
    scheduleHover();
  });
  // Including the popup's own ✕, which no handler here sees.
  map.on('popupopen popupclose', scheduleHover);
}

void main();
