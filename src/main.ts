import L from 'leaflet';
import './style.css';

import { basemapById, BASEMAPS } from './basemaps';
import { cachedElevation, elevationTile, loadElevation } from './dem';
import { compassNeedsPermission, requestCompassPermission, type Heading } from './heading';
import { createMap, startLocating } from './map';
import type { NationalPoint } from './nationalPoint';
import { loadNationalPoints, createPointsLayer, openPointPopup, pointRows } from './points';
import { PointsList } from './pointsList';
import { canHover, createHoverLabel } from './hoverLabel';
import { ProfilePanel } from './profilePanel';
import { Halo, HoverHalo, ProfileCursor, trailAt } from './selection';
import { buildProfile, pointPasses } from './trailProfile';
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
import { installShortcuts } from './shortcuts';
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

  // Shortcuts need a keyboard, which a mouse is the best sign of there being.
  const keys = canHover();
  document.getElementById('about-keys')!.hidden = !keys;

  document.getElementById('about')!.hidden = !(name || email || homepage || keys);
}

/** The OS asks for less motion: camera moves jump instead of flying. */
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function findTrail(id: string): Trail | undefined {
  return trails.find((t) => t.id === id);
}

/**
 * The id `delta` rows from `current` in `ids`, wrapping at either end, or null
 * for an empty list. From nothing — or from a row the filter has since taken
 * away — forward starts at the first and back at the last.
 */
function stepIn(ids: readonly string[], current: string | null, delta: number): string | null {
  if (ids.length === 0) return null;
  const at = current === null ? -1 : ids.indexOf(current);
  if (at === -1) return delta > 0 ? ids[0] : ids[ids.length - 1];
  return ids[(((at + delta) % ids.length) + ids.length) % ids.length];
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
  /** Between movestart and moveend: the map is sliding under a pointer that has
   *  not moved, and a drag is not about to click anything. */
  let mapMoving = false;
  let hoverFrame = 0;

  // The elevation profile. profileOpen is whether you asked for it, and outlives
  // a change of selection. cursorTrail is the trail the cursor is on — the one
  // playing, else the selected one — whether or not the panel shows it, so the
  // dot on the map follows a selected trail with the panel closed too. cursorIndex
  // is the GPX point the cursor is on, and setCursor() the only writer of it. A
  // new cursorTrail starts with no point, so deselecting a trail clears it.
  let profileOpen = false;
  let cursorTrail: Trail | null = null;
  let cursorIndex: number | null = null;
  // The trail 3D playback is walking, if any. While it plays it takes the panel
  // over — the readout is the only place the point you are standing on is spelled
  // out in 3D — without touching profileOpen, so the panel goes back to whatever
  // 2D had the moment playback ends. No point number of its own: cursorIndex is
  // that number, and a second copy would give the cursor two writers.
  let playbackTrail: Trail | null = null;
  // Whether playback shows the panel. Its own flag, not profileOpen: putting the
  // chart away to watch the trail says nothing about 2D. Outlives a playback, so
  // the next trail played comes up the way you left the last one.
  let playbackProfileOpen = true;
  // The 2D minimap in Walk and playback. minimapOn is whether you asked for it, and
  // outlives leaving and re-entering 3D the way profileOpen outlives a change of
  // selection: which corner you want the map in is not something a trip back to 2D
  // says anything about. minimapLarge is the size a click on the inset picks, held
  // as a flag rather than read back off data-minimap so that turning the minimap
  // off and on again brings it back at the size you left it.
  let minimapOn = true;
  let minimapLarge = false;
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
  profilePanel.setHiddenPoints(hiddenPoints);
  let pointPopup: L.Popup | null = null;
  let popupPoint: NationalPoint | null = null;
  /** The point goToPoint is flying to, whose popup opens when the camera lands.
   *  Any other popup change, or a trail flight, clears it. */
  let pendingPoint: NationalPoint | null = null;
  /** The 지점번호 the panel list draws as selected: whichever point has a popup
   *  open in the view you are looking at. View state, like selectedId. */
  let selectedPointCode: string | null = null;
  const pointsLayer = createPointsLayer(map, points);
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
  const minimapYou = document.getElementById('minimap-you')!;

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
    onZoomTo: (id) => zoomToTrail(id),
    onSelect: (id) => selectTrail(id),
    onBasemapChange: (id) => setBasemap(id),
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
    onEscape: () => {
      if (view3d) close3d();
    },
    onWalkTrail: (id) => {
      const trail = findTrail(id);
      if (!trail) return;
      // A point picked on this trail's profile is where the walk starts; taken
      // before selectTrail, which could move the panel off it.
      const from = cursorTrail === trail && cursorIndex !== null ? cursorIndex : undefined;
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
    onTogglePlaybackProfile: () => {
      playbackProfileOpen = !playbackProfileOpen;
      syncProfile();
    },
    onToggleMinimap: () => {
      minimapOn = !minimapOn;
      syncMinimap();
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
    onSelect: (code) => goToPoint(code),
  });

  /**
   * What a points list row does, and `;` `'` too: goes to the point and opens its
   * popup.
   */
  function goToPoint(code: string): void {
    const point = pointByCode.get(code);
    if (!point) return;
    // Like a trail row, which zooms to a hidden trail without turning it on: a
    // row click is you asking for this point now. It selects the point, not the
    // trail — a trail already selected stays selected.
    if (view3d) {
      // The highlight comes from the popup showPoint opens.
      view3d.showPoint(point);
    } else {
      // Never zooms out: you may already be closer in than POINT_ZOOM — as
      // close as MAX_ZOOM, now that a basemap's native limit no longer stops
      // the camera.
      const zoom = Math.max(map.getZoom(), POINT_ZOOM);
      // Flown, as 3D's panTo is: setView snaps once the zoom changes by more
      // than 4 or the point is off-screen. The popup waits for the landing — its
      // autoPan, run mid-flight, would measure the old view and pan against the
      // flight — but the row highlights now, so a quick second ; ' steps on from
      // this point rather than the one you are leaving.
      closePointPopup();
      selectPoint(point);
      pendingPoint = point;
      // Registered first: under reduced motion flyTo is a setView, whose moveend
      // fires before it returns. A newer flight stops this one, so the one moveend
      // runs every queued handler and only the latest point passes.
      map.once('moveend', () => {
        if (pendingPoint === point) openPoint(point);
      });
      map.flyTo([point.lat, point.lon], zoom, { animate: !prefersReducedMotion() });
    }
    // The one place this diverges from a trail row: the drawer covers most of a
    // phone screen and the popup is the whole payload of the click, where a
    // trail row's zoom survives being looked at later.
    ui.closeDrawer();
  }

  ui.applySettings(settings);

  installShortcuts({
    togglePanel: () => ui.togglePanel(),
    stepProfile: (delta) => void profilePanel.step(delta),
    // The rows the list shows, in its order, less those switched off: each step
    // does what a click on the neighbouring row would, and lands on something drawn.
    stepTrail: (delta) => {
      const ids = ui.renderedIds().filter((id) => findTrail(id)?.visible);
      const id = stepIn(ids, selectedId, delta);
      if (id === null) return;
      selectTrail(id);
      zoomToTrail(id);
    },
    // With a trail on the profile, its own pins in trail order, moving only the
    // cursor: the list would fly off the trail. None left that way is nothing.
    stepPoint: (delta) => {
      if (cursorTrail) {
        // The cursor landing on the pin is what previews it; see cursorPoint().
        profilePanel.stepPass(delta);
        return;
      }
      const codes = pointsList.renderedCodes().filter((code) => !hiddenPoints.has(code));
      const code = stepIn(codes, selectedPointCode, delta);
      if (code !== null) goToPoint(code);
    },
    toggleMinimapSize,
    zoomToSelected: () => {
      if (selectedId !== null) zoomToTrail(selectedId);
    },
    nextBasemap: () => {
      const at = BASEMAPS.indexOf(basemapById(settings.basemapId));
      setBasemap(BASEMAPS[(at + 1) % BASEMAPS.length].id);
      // The radios only learn of a change they did not make from here.
      ui.applySettings(settings);
    },
    // All off while any is on, the way the list's master checkbox reads.
    togglePoints: () => {
      const codes = [...pointByCode.keys()];
      setPointsHidden(codes, codes.some((code) => !hiddenPoints.has(code)));
    },
  });

  function zoomToTrail(id: string): void {
    if (view3d) {
      view3d.fitTrail(id);
      return;
    }
    const trail = findTrail(id);
    // Capped at the source's native level: framing a trail is automatic, and
    // a 200 m loop would otherwise land on upscaled tiles you never asked for.
    // Zooming in by hand still goes deeper.
    //
    // Flown rather than fitted, as 3D's fitBounds is: Leaflet's fitBounds snaps
    // without animating once the zoom changes by more than 4 or the new centre
    // is off-screen, so stepping with [ ] glided to some trails and jumped to others.
    if (!trail?.bounds.isValid()) return;
    // A point still in flight never gets its popup: you have moved on to a trail.
    if (pendingPoint) closePointPopup();
    map.flyToBounds(trail.bounds, {
      padding: [30, 30],
      maxZoom: basemapById(settings.basemapId).maxZoom,
      animate: !prefersReducedMotion(),
    });
  }

  function setBasemap(id: string): void {
    settings = { ...settings, basemapId: id };
    handle.setBasemap(id);
    view3d?.setBasemap(id);
    void saveSettings(settings);
  }

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
          onCamera: (at) => followCamera(at),
          // 3D's terrain answers null only until its tile has loaded.
          onReadout: (at) => ui.setReadout({ ...at, ele: at.ele ?? undefined }),
          onContextLost: () => {
            ui.notify('The 3D view lost its graphics context and was closed.', 'error');
            close3d();
          },
          notify: (message, kind, timeout) => ui.notify(message, kind, timeout),
        });
        view3d = view;
        setMinimap(true);
        // The 2D popup is left open behind the switch — close3d comes back to it —
        // but nothing is open in the view you are now looking at, so nothing is
        // highlighted either.
        selectPoint(null);
        if (lastFix) view.setLocation({ lat: lastFix.lat, lon: lastFix.lng, accuracy: lastAccuracy });
        view.setHeading(lastHeading);
        view.setFollowing(following);
        view.setProfileCursor(cursorAt());
        view.setCursorPoint(cursorPoint());
        // Off the 2D map, which is only the minimap now.
        scheduleHover();
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
    setMinimap(false);
    // destroy() takes its popup down with the GL context rather than through
    // closePopup, so the highlight is set back here — to the 2D popup that was
    // still open underneath, if there was one.
    selectPoint(popupPoint);
    delete app.dataset.view;
    ui.set3dState('off');
    // Walking left #map at the minimap's size, and Leaflet only learns the full one
    // a frame later (see createMap): centred in the old size, where you stood would
    // land near the top-left corner rather than under #crosshair.
    map.invalidateSize({ pan: false });
    // Uncapped: 2D reaches MAX_ZOOM, which is exactly what orbit tops out at, so
    // however far in you were is a zoom 2D can hold.
    map.setView([back.lat, back.lon], back.zoom, { animate: false });
    // Back onto the 2D map, where no move need have fired.
    scheduleHover();
    // setView fires its move before the view is 2D's again; say it now anyway, in
    // case the view was already there and no move fired at all.
    read2d();
  }

  /** The tile read2d last asked for, so an answer for a spot the map has since
   *  left is dropped rather than shown. */
  let readoutTile = '';

  /**
   * The readout in 2D: the map centre, under #crosshair, and the ground there.
   * In 3D the 2D map is only the minimap, and view3d reports instead (onReadout).
   */
  function read2d(): void {
    if (view3d) return;
    const { lat, lng: lon } = map.getCenter().wrap();
    const ele = cachedElevation(lat, lon);
    ui.setReadout({ lat, lon, ele });
    if (ele !== undefined) return;
    const tile = elevationTile(lat, lon);
    if (tile === readoutTile) return;
    readoutTile = tile;
    void loadElevation(lat, lon).then(() => {
      // Still over that tile: the centre now, whose tile is loaded.
      if (readoutTile === tile) {
        readoutTile = '';
        read2d();
      }
    });
  }

  /**
   * In 3D the 2D map stays alive behind the scene, and while walking or playing a
   * trail style.css shows it as a minimap in the top-left corner (see #map there).
   * It is the same map, so the trails, the selection, the pins, your location and
   * the profile's dot are all already on it; this only takes its gestures away
   * while it is small and hands them back when 3D closes. A click on it still
   * arrives, and the click handler below spends it on the minimap's size.
   */
  function setMinimap(on: boolean): void {
    const handlers = [map.dragging, map.touchZoom, map.scrollWheelZoom, map.doubleClickZoom, map.boxZoom, map.keyboard];
    for (const handler of handlers) {
      if (on) handler.disable();
      else handler.enable();
    }
    if (on) {
      // Each 3D session starts at the small size; whether you want the minimap at
      // all is yours, and minimapOn is left where you put it.
      minimapLarge = false;
      syncMinimap();
    } else {
      delete app.dataset.minimap;
      cameraAt = null;
    }
  }

  /** The eye the minimap was last put on, for when it changes size under a still eye. */
  let cameraAt: { lat: number; lon: number; yaw: number; eye: number } | null = null;

  /** Keeps the minimap on the 3D eye, north-up, with the arrow at its centre
   *  turned the way the eye faces. */
  function followCamera(at: { lat: number; lon: number; yaw: number; eye: number }): void {
    cameraAt = at;
    minimapYou.style.setProperty('--yaw', `${at.yaw}deg`);
    // Turned off, nothing shows the map, and walking it along would fetch tiles
    // for a corner nobody can see. The two lines above still run: cameraAt is what
    // syncMinimap puts it back on, and --yaw is what leaves the arrow already
    // pointing the right way when it returns — which is the only thing that can
    // set it while a playback is paused and no frame follows the button.
    if (!minimapOn) return;
    // Further out the higher the eye: about 460m, 920m and 1.8km across the small
    // minimap on a phone, for standing, a tree top and a drone.
    const zoom = at.eye >= 80 ? 13 : at.eye >= 20 ? 14 : 15;
    // Looking around turns the arrow and nothing else, so a frame that moved the eye
    // less than a pixel costs Leaflet no work.
    if (zoom === map.getZoom()) {
      const offset = map.latLngToContainerPoint([at.lat, at.lon]).subtract(map.getSize().divideBy(2));
      if (Math.abs(offset.x) < 1 && Math.abs(offset.y) < 1) return;
    }
    map.setView([at.lat, at.lon], zoom, { animate: false });
  }

  /**
   * The single place data-minimap and its button are written. style.css reads the
   * attribute for both the inset's size and whether it shows at all, so the two
   * flags behind it are resolved in one place, as syncProfile() does for the panel.
   */
  function syncMinimap(): void {
    app.dataset.minimap = !minimapOn ? 'off' : minimapLarge ? 'large' : 'small';
    ui.setMinimapShown(minimapOn);
    // Back on, and the eye has walked on since: put the map on the spot in the same
    // frame the rule reveals it, rather than showing where you used to be until the
    // next camera frame — or, in a paused playback, indefinitely.
    if (minimapOn && cameraAt) followCamera(cameraAt);
  }

  /** A click on the inset, or `K`: the other size, but only for a minimap that is
   *  showing — in orbit, or turned off, there is nothing to see it change. */
  function toggleMinimapSize(): void {
    const mode = app.dataset.mode3d;
    if (!view3d || !minimapOn || (mode !== 'walk' && mode !== 'playback')) return;
    minimapLarge = !minimapLarge;
    syncMinimap();
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
   * The cursor's trail from playback and the selection, and whether the panel
   * shows it from playback, profileOpen and playbackProfileOpen. A trail playing in
   * 3D wins: it is the trail you are standing on, the selection bar that holds the
   * toggle is hidden there, and a tap on the scene is what puts the panel away with
   * the rest of the controls. A hidden panel keeps its trail and cursor, so the dot
   * goes on following the selection, or the walk, while the chart is away.
   */
  function syncProfile(): void {
    const selected = (selectedId !== null && findTrail(selectedId)) || null;
    const trail = playbackTrail ?? selected;
    const hidden = playbackTrail ? !playbackProfileOpen : !profileOpen;
    ui.setProfileShown(trail !== null && !hidden);
    ui.setPlaybackProfileShown(playbackProfileOpen);
    profilePanel.setHidden(hidden);
    if (trail === cursorTrail) return;
    cursorTrail = trail;
    // A point number means nothing on another trail.
    cursorIndex = null;
    // A trail's id is its file name in data/gpx/ (see trailFiles.ts).
    const profile = trail ? buildProfile(trail) : null;
    profilePanel.show(profile, trail?.id, profile ? pointPasses(profile, points) : []);
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
    if (!cursorTrail || cursorIndex === null) return null;
    const profile = buildProfile(cursorTrail);
    return { lat: profile.lat[cursorIndex], lon: profile.lon[cursorIndex], color: cursorTrail.color };
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
    applyCursorPoint();
  }

  /** The national point whose pin the profile cursor is on, however it got there —
   *  a drag snapping onto it, a tap on it, `;` `'`, `,` `.` — previewed as a hover
   *  would be. Derived from the cursor, so whatever moves the cursor off it ends the
   *  preview without clearing anything. */
  function cursorPoint(): NationalPoint | null {
    return cursorTrail ? (profilePanel.passAt(cursorIndex)?.point ?? null) : null;
  }

  /** Both views' previews of cursorPoint(). Not while playing, where walking
   *  names what is near. */
  function applyCursorPoint(): void {
    scheduleHover();
    view3d?.setCursorPoint(playbackTrail ? null : cursorPoint());
  }

  /** Opens a point's popup and remembers whose it is, so hiding that point can
   *  take the popup with it. The only place pointPopup is written. */
  function openPoint(point: NationalPoint): void {
    pendingPoint = null;
    pointPopup = openPointPopup(map, point);
    popupPoint = point;
    selectPoint(point);
  }

  function closePointPopup(): void {
    if (pointPopup) map.closePopup(pointPopup);
    pointPopup = null;
    popupPoint = null;
    pendingPoint = null;
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
    profilePanel.setHiddenPoints(hiddenPoints);
    if (popupPoint && hiddenPoints.has(popupPoint.code)) closePointPopup();
    applyCursorPoint();
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
   * is open or a trail is selected (that click only clears), then pinAt(), then
   * trailAt() — the click's own functions, so the preview and the click cannot
   * disagree.
   */
  function syncHover(): void {
    const popupOpen = pointPopup?.isOpen() ?? false;
    const at = !view3d && !mapMoving && canHover() && !popupOpen && selectedId === null ? hoverAt : null;
    const pin = at ? pointsLayer.pinAt(at) : null;
    const trail = at && !pin ? trailAt(map, at, trails) : null;
    // With nothing under the mouse — always so with a trail selected — the pin
    // profile cursor is on, labelled beside the pin itself while it is on screen.
    const onCursor = !view3d && !pin && !trail ? cursorPoint() : null;
    const onCursorAt = onCursor ? map.latLngToContainerPoint([onCursor.lat, onCursor.lon]) : null;
    const size = map.getSize();
    const onScreen =
      onCursorAt !== null && onCursorAt.x >= 0 && onCursorAt.y >= 0 && onCursorAt.x <= size.x && onCursorAt.y <= size.y;
    pointsLayer.setHovered(pin?.code ?? onCursor?.code ?? null);
    hoverHalo.show(trail);
    // Leaflet cannot know to give a pointer to either: both are picked geometrically.
    map.getContainer().classList.toggle('map-pick', pin !== null || trail !== null);
    const name = pin ? pin.name || pin.code : trail?.name;
    if (at && name) hoverLabel.show(name, at.x, at.y);
    else if (onCursor && onScreen) hoverLabel.show(onCursor.name || onCursor.code, onCursorAt.x, onCursorAt.y);
    else hoverLabel.hide();
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

  // One handler for every click on the map. No listener is attached to the pins or
  // the polylines, so every click reaches it and pinAt() then trailAt() decide what
  // was hit. While a trail is selected or a popup is open, any click only clears
  // it; a pin or a trail is picked only from a clear map.
  map.on('click', (e) => {
    // Only reachable as the 3D minimap, whose one control is its size — turning it
    // off is the button's job, since a click on a minimap that is gone cannot ask
    // for it back.
    if (view3d) {
      toggleMinimapSize();
      return;
    }
    if (clearMapSelection()) return;
    // A pin first: it takes the click over any trail beneath it.
    const pin = pointsLayer.pinAt(e.containerPoint);
    if (pin) {
      openPoint(pin);
      return;
    }
    const hit = trailAt(map, e.containerPoint, trails);
    if (hit) selectTrail(hit.id);
  });

  // The hover preview's inputs; syncHover() above turns them into what is shown.
  // Over a pin as well: the pins are not interactive, so it still reaches the map. Over a control or an open popup it does too, where there is nothing
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
  // The cursor's pin's label rides along with a pan or zoom.
  map.on('move', () => {
    if (cursorPoint()) scheduleHover();
  });
  // Growing into the minimap, or toggling its size, keeps the top-left corner
  // where it was (see createMap), which moves the centre off the eye — and a still
  // eye reports nothing new to put it back.
  map.on('resize', () => {
    if (view3d && cameraAt) followCamera(cameraAt);
    // A resize keeps the top-left corner, not the centre, and fires no move.
    read2d();
  });
  map.on('move', read2d);
  read2d();
  // Including the popup's own ✕, which no handler here sees.
  map.on('popupopen popupclose', scheduleHover);
}

void main();
