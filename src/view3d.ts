/**
 * The 3D view: MapLibre with terrain, the same basemaps, trails and points as the
 * 2D map, and three ways to move — orbit from above, walk at eye height, or play a
 * trail.
 *
 * Only ever reached through `import('./view3d')` in main.ts, so MapLibre and its
 * worker (over a megabyte) are downloaded the first time 3D is opened and never by
 * a visit that stays in 2D.
 *
 * main.ts stays the single owner of trail state. This module reads it through
 * getScene() and is told when it changes; it never keeps a copy that could drift.
 */
import {
  LngLat,
  Map as MlMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type GeoJSONSource,
  type MapMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// ?worker&url has Vite bundle the worker as its own entry and hand back its URL.
// A bare ?url would copy the file as-is, with its import of the shared chunk left
// pointing at nothing.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

import { basemapById } from './basemaps';
import { tweenCamera, type Tween } from './cameraTween';
import { FirstPerson, WALK_FOV, eyeCamera, type Pose } from './firstPerson';
import { angleDelta, bearing } from './geo';
import { compassNeedsPermission, requestCompassPermission, type Heading } from './heading';
import { Hud, type Mode3d } from './hud3d';
import { haversine } from './gpx';
import { LOCATE_ICON_HTML } from './map';
import type { NationalPoint } from './nationalPoint';
import { loadNationalPoints, popupContent } from './points';
import {
  EMPTY,
  LAYER_BASEMAP,
  LAYER_HALOS,
  LAYER_POINTS,
  LAYER_TRAILS,
  LAYER_TRAIL_SELECTED,
  SRC_BASEMAP,
  SRC_LOCATION,
  allOf,
  basemapSource,
  circlePolygon,
  selectedFilter,
  sky,
  style,
  trailOpacity,
  visibleFilter,
} from './scene3d';
import { tolerance } from './selection';
import { Playback, buildPath, sampleAt } from './trailPlayback';
import type { Trail } from './trails';
import { createControls, type WalkControls } from './walkControls';

setWorkerUrl(workerUrl);

export type Scene = {
  trails: readonly Trail[];
  selectedId: string | null;
  basemapId: string;
  showPoints: boolean;
};

/** A place and a zoom in Leaflet's terms, which is how the two views hand over. */
export type View2d = { lat: number; lon: number; zoom: number };

export type View3dOptions = {
  container: HTMLElement;
  getScene: () => Scene;
  start: View2d;
  /** main.ts's selectTrail: the one place selection changes. */
  onSelect: (id: string | null) => void;
  /** A drag in orbit mode, which is how following your location stops. */
  onDragStart: () => void;
  /** The GPU dropped the context — common on phones under memory pressure. */
  onContextLost: () => void;
  notify: (message: string, kind?: 'info' | 'error', timeout?: number) => void;
};

export type View3d = {
  setBasemap(id: string): void;
  /** Re-reads visibility and selection from getScene(). */
  syncTrails(): void;
  setPointsVisible(show: boolean): void;
  setLocation(fix: { lat: number; lon: number; accuracy: number } | null): void;
  setHeading(heading: Heading | null): void;
  fitTrail(id: string): void;
  panTo(lat: number, lon: number): void;
  walkTrail(id: string): void;
  viewFor2d(): View2d;
  destroy(): void;
};

/** MapLibre's tiles are 512px to Leaflet's 256, so the same view is one zoom lower. */
const ZOOM_OFFSET = 1;
/** The orbit camera's tilt when coming back from walking, enough that the terrain
 *  reads as terrain and you still face the way you walked. */
const ORBIT_PITCH = 60;
const ORBIT_MAX_PITCH = 85;
/** MapLibre's own default field of view, restored when leaving walk mode. */
const ORBIT_FOV = 36.87;
/** Walking can look above the horizon, which means a pitch past 90. */
const WALK_MAX_PITCH = 179;
/** The walk camera sits at about z20–21 and must never be clamped: clamping the
 *  zoom would move it away from the eye. */
const WALK_MAX_ZOOM = 24;
const ORBIT_MAX_ZOOM = 22;
/** Fog start (0 map centre, 1 horizon). See sky() in scene3d.ts. */
const ORBIT_FOG = 0.5;
const WALK_FOG = 0.9;
/** Eye heights the HUD cycles through: standing, a tree top, a drone. */
const EYE_HEIGHTS = [1.7, 20, 80];
/** A jump to a trail further away than this descends from above, so the terrain
 *  there has a moment to load before you are standing in it. */
const FAR_JUMP = 200;
const JUMP_HEIGHT = 150;

function typingTarget(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

export async function createView3d(opts: View3dOptions): Promise<View3d> {
  const { container, getScene, notify } = opts;
  const scene = getScene();
  const points = loadNationalPoints();

  // Throws where there is no WebGL2; main.ts turns that into a notice and stays in 2D.
  const map = new MlMap({
    container,
    style: style(basemapById(scene.basemapId), scene.trails, points),
    center: [opts.start.lon, opts.start.lat],
    zoom: Math.max(0, opts.start.zoom - ZOOM_OFFSET),
    // No pitch or bearing: 3D opens flat and north-up, like 2D and the compass reset.
    maxPitch: ORBIT_MAX_PITCH,
    attributionControl: false,
    // Tiles appear as they arrive rather than cross-fading, which is extra work on
    // every frame the walk camera moves.
    fadeDuration: 0,
    // A 3x phone would render nine times the pixels of a 1x screen for a picture
    // that is mostly soft terrain texture.
    pixelRatio: Math.min(window.devicePixelRatio, 2),
  });

  await new Promise<void>((resolve, reject) => {
    map.once('style.load', () => resolve());
    map.once('error', (e) => reject(e.error));
  }).catch((err) => {
    map.remove();
    throw err;
  });

  // Two controls rather than one: zoom alone is as tall as Leaflet's zoom control, so
  // #locate and the zoom buttons stay put between views, and the compass is lifted
  // above #locate by style.css. Bottom controls stack upwards, so it goes second.
  map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
  const compass = new NavigationControl({ showZoom: false, visualizePitch: true });
  map.addControl(compass, 'bottom-right');
  // The compass is a button, not a joystick: MapLibre also lets you drag it to turn
  // and tilt the map, so a press that slid off still moved the camera. Without that,
  // only a press and release on the button fires its click (reset north and pitch).
  compass._handler.off();

  // The same reason as createMap in map.ts: the panel collapsing changes the
  // container's size without a window resize.
  let pending = 0;
  const resizer = new ResizeObserver(() => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => map.resize());
  });
  resizer.observe(container);

  let mode: Mode3d = 'orbit';
  let controls: WalkControls | null = null;
  let walker: FirstPerson | null = null;
  let eyeIndex = 0;
  let gyroOn = false;
  let hinted = false;
  let popup: Popup | null = null;
  /** The camera flight between orbit and walk, while one is under way. */
  let tween: Tween | null = null;

  const hud = new Hud({
    // A toggle: pressed while walking or playing, so a press from either is back to orbit.
    onWalk: () => setMode(mode === 'orbit' ? 'walk' : 'orbit'),
    onPlayToggle: () => walker?.playback?.toggle(),
    onSpeed: () => walker?.playback?.nextSpeed(),
    onSeek: (fraction) => walker?.playback?.seek(fraction * walker.playback.path.total),
    onClosePlayback: () => setMode('walk'),
    onEye: () => {
      eyeIndex = (eyeIndex + 1) % EYE_HEIGHTS.length;
      if (walker) walker.eye = EYE_HEIGHTS[eyeIndex];
      hud.setEye(EYE_HEIGHTS[eyeIndex]);
    },
    onGyro: () => toggleGyro(),
  });
  hud.setMode(mode);
  hud.setEye(EYE_HEIGHTS[eyeIndex]);

  // -- scene sync ----------------------------------------------------------------

  function syncTrails(): void {
    const { trails, selectedId } = getScene();
    const visible = visibleFilter(trails);
    const selected = allOf(visible, selectedFilter(selectedId));
    map.setFilter(LAYER_TRAILS, visible);
    for (const id of [...LAYER_HALOS, LAYER_TRAIL_SELECTED]) map.setFilter(id, selected);
    map.setPaintProperty(LAYER_TRAILS, 'line-opacity', trailOpacity(selectedId));
    // A trail hidden, or the one aimed at now selected, changes what a tap would do.
    syncAim();
  }

  function setPointsVisible(show: boolean): void {
    map.setLayoutProperty(LAYER_POINTS, 'visibility', show ? 'visible' : 'none');
    if (!show) popup?.remove();
    syncAim();
  }

  syncTrails();
  setPointsVisible(scene.showPoints);

  const locationEl = document.createElement('div');
  locationEl.className = 'locate-icon';
  locationEl.innerHTML = LOCATE_ICON_HTML;
  // Flat on the ground and turned with the map, so the cone points the way you
  // face on the terrain rather than at a fixed angle on the screen.
  const locationMarker = new Marker({ element: locationEl, rotationAlignment: 'map', pitchAlignment: 'map' });
  let locationShown = false;

  // -- clicks --------------------------------------------------------------------

  /** The point drawn within `r` pixels of (x, y) on the canvas, if points are shown. */
  function pointAt(x: number, y: number, r: number): NationalPoint | undefined {
    if (map.getLayoutProperty(LAYER_POINTS, 'visibility') === 'none') return undefined;
    const hit = map.queryRenderedFeatures([[x - r, y - r], [x + r, y + r]], { layers: [LAYER_POINTS] })[0];
    return hit ? points[hit.properties.index as number] : undefined;
  }

  function openPopup(point: NationalPoint): void {
    // closeOnClick off: the click handlers decide what a click closes.
    popup = new Popup({ offset: 10, maxWidth: '240px', closeOnClick: false })
      .setLngLat([point.lon, point.lat])
      .setDOMContent(popupContent(point))
      .addTo(map);
  }

  function closePopup(): void {
    popup?.remove();
    popup = null;
  }

  // Orbit only: walking uses the pointer to look, and aims with the crosshair instead.
  map.on('click', (e: MapMouseEvent) => {
    if (mode !== 'orbit' || tween) return;
    // The same rule as the 2D handlers in main.ts: while a trail is selected or a
    // popup is open, any click only clears it.
    const popupOpen = popup?.isOpen() ?? false;
    const trailSelected = getScene().selectedId !== null;
    if (popupOpen || trailSelected) {
      closePopup();
      if (trailSelected) opts.onSelect(null);
      return;
    }
    // A point first, as in 2D, where a pin swallows the click.
    const point = pointAt(e.point.x, e.point.y, 6);
    if (point) {
      openPopup(point);
      return;
    }
    const t = tolerance();
    const box: [[number, number], [number, number]] = [
      [e.point.x - t, e.point.y - t],
      [e.point.x + t, e.point.y + t],
    ];
    const id = trailIn(box);
    if (id) opts.onSelect(id);
  });

  /** The id of the visible trail drawn inside `box` on the canvas. */
  function trailIn(box: [[number, number], [number, number]]): string | undefined {
    const hit = map.queryRenderedFeatures(box, { layers: [LAYER_TRAILS] })[0];
    return hit?.properties.id as string | undefined;
  }

  // While walking, the pointer looks around and a captured mouse has no cursor, so
  // the crosshair at the screen centre, where the camera looks, is what you aim
  // with. Just wider than its 7px ring, so anything inside the ring counts.
  function aimedPoint(): NationalPoint | undefined {
    const canvas = map.getCanvas();
    return pointAt(canvas.clientWidth / 2, canvas.clientHeight / 2, 8);
  }

  /** The trail under the crosshair, unless it is already the selected one, which a
   *  tap has nothing more to do with. A trail far off is a hairline, so anywhere
   *  inside the crosshair's ticks counts, not only its ring. */
  function aimedTrail(): string | undefined {
    const canvas = map.getCanvas();
    const x = canvas.clientWidth / 2;
    const y = canvas.clientHeight / 2;
    const r = 12;
    const id = trailIn([[x - r, y - r], [x + r, y + r]]);
    return id === getScene().selectedId ? undefined : id;
  }

  function syncAim(): void {
    hud.setAimed(mode !== 'orbit' && (aimedPoint() !== undefined || aimedTrail() !== undefined));
  }

  /** Whether a popup at `lngLat` is still on screen from where you stand. MapLibre
   *  projects a point behind the camera to a mirrored spot in front of it, so being
   *  inside the canvas is not enough on its own. */
  function inWalkView(lngLat: LngLat): boolean {
    if (!walker) return true;
    const { pose } = walker;
    const there = { lat: lngLat.lat, lon: lngLat.lng };
    if (Math.abs(angleDelta(pose.yaw, bearing(pose, there))) >= 90) return false;
    const p = map.project(lngLat);
    const canvas = map.getCanvas();
    return p.x >= 0 && p.y >= 0 && p.x <= canvas.clientWidth && p.y <= canvas.clientHeight;
  }

  // The walk camera only jumps when it actually moves, so standing still costs no query.
  map.on('move', () => {
    if (mode === 'orbit') return;
    syncAim();
    // Walked or looked away from the point: its popup has nothing left to point at.
    if (popup && !inWalkView(popup.getLngLat())) closePopup();
  });

  /** A tap or click on the scene while walking. True when it was spent here, so it
   *  must not also capture the mouse. */
  function onSceneTap(): boolean {
    // The same rule as orbit: while a popup is open or a trail is selected, a tap
    // only clears it. Not during playback, where the trail playing is the
    // selection and a tap is for the controls.
    if (popup?.isOpen()) {
      closePopup();
      return true;
    }
    if (mode === 'walk' && getScene().selectedId !== null) {
      opts.onSelect(null);
      return true;
    }
    const point = aimedPoint();
    if (point) {
      openPopup(point);
      return true;
    }
    // Selected, the trail's name shows on the selection bar, with the ▶ that the
    // free mouse has to be able to reach.
    const trail = aimedTrail();
    if (trail) {
      opts.onSelect(trail);
      return true;
    }
    return hud.tap();
  }

  for (const layer of [LAYER_POINTS, LAYER_TRAILS]) {
    map.on('mouseenter', layer, () => {
      if (mode === 'orbit') map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
  }

  map.on('dragstart', () => {
    if (mode === 'orbit') opts.onDragStart();
  });
  map.on('webglcontextlost', () => opts.onContextLost());

  // -- modes ---------------------------------------------------------------------

  const HANDLERS = [
    map.dragPan,
    map.dragRotate,
    map.scrollZoom,
    map.boxZoom,
    map.doubleClickZoom,
    map.touchZoomRotate,
    map.touchPitch,
    map.keyboard,
  ];

  /** Lifts the orbit limits for a camera at eye height. Order matters: they have
   *  to be lifted before the first camera placement that needs them, or MapLibre
   *  clamps it. */
  function walkLimits(): void {
    for (const h of HANDLERS) h.disable();
    popup?.remove();
    map.stop();
    map.setMaxZoom(WALK_MAX_ZOOM);
    map.setMaxPitch(WALK_MAX_PITCH);
    map.setCenterClampedToGround(false);
    map.getCanvas().style.cursor = '';
  }

  function orbitLimits(): void {
    for (const h of HANDLERS) h.enable();
    map.setCenterClampedToGround(true);
    map.setVerticalFieldOfView(ORBIT_FOV);
    map.setMaxPitch(ORBIT_MAX_PITCH);
    map.setMaxZoom(ORBIT_MAX_ZOOM);
    map.setSky(sky(ORBIT_FOG));
  }

  /** Starts the eye-height camera at `pose`, descending from `height` metres. */
  function startWalking(pose: Pose, height: number, groundGuess: number): FirstPerson {
    walkLimits();
    map.setVerticalFieldOfView(WALK_FOV);
    map.setSky(sky(WALK_FOG));

    controls = createControls({
      surface: map.getCanvasContainer(),
      joystick: hud.joystick,
      onSpace: () => walker?.playback?.toggle(),
      onTap: onSceneTap,
    });
    const next = new FirstPerson(map, controls, pose, height, groundGuess, () => {
      const playback = next.playback;
      if (!playback) return;
      const trail = getScene().trails.find((t) => t.id === playingId);
      hud.setPlayback({
        playing: playback.playing,
        speed: playback.speed,
        s: playback.s,
        total: playback.path.total,
        name: trail?.name ?? '',
      });
    });
    next.eye = EYE_HEIGHTS[eyeIndex];
    if (gyroOn) next.setGyro(true);

    if (!hinted) {
      hinted = true;
      notify(
        window.matchMedia('(pointer: coarse)').matches
          ? 'Move with the joystick, drag to look around. Aim the crosshair at a point or trail and tap to pick it.'
          : 'W A S D or arrows to move, Shift to run. Drag, or click to capture the mouse, to look around. Aim the crosshair at a point or trail and click to pick it. Esc to go back.',
        'info',
        6000,
      );
    }
    return next;
  }

  /** Stops the eye-height camera and says where it stood. The camera keeps the walk
   *  limits: the flight back up starts past the orbit's pitch limit. */
  function stopWalking(): { pose: Pose; ground: number } | null {
    const stood = walker ? { pose: { ...walker.pose }, ground: walker.groundHeight } : null;
    walker?.destroy();
    controls?.destroy();
    walker = null;
    controls = null;
    return stood;
  }

  /** Ends a camera flight now, if one is under way, so what follows starts from a
   *  settled mode rather than one half set up. */
  function settle(): void {
    tween?.finish();
  }

  let playingId: string | null = null;

  function setMode(next: Mode3d): void {
    settle();
    if (next === mode) return;
    if (next === 'orbit') {
      const stood = stopWalking();
      playingId = null;
      if (stood) {
        // Up and back from where you stood, which stays at the screen centre the
        // whole way and ends under #crosshair3d.
        const { pose, ground } = stood;
        tween = tweenCamera(
          map,
          {
            center: new LngLat(pose.lon, pose.lat),
            zoom: 16,
            pitch: ORBIT_PITCH,
            bearing: pose.yaw,
            elevation: ground,
            fov: ORBIT_FOV,
          },
          () => {
            tween = null;
            orbitLimits();
          },
        );
      } else {
        orbitLimits();
      }
    } else if (next === 'walk') {
      if (walker) {
        walker.setPlayback(null);
        playingId = null;
      } else {
        // Keep in sync with #crosshair3d, which marks this spot in orbit mode.
        const centre = map.getCenter();
        const pose: Pose = { lat: centre.lat, lon: centre.lng, yaw: map.getBearing(), look: -10 };
        const ground = map.getCenterElevation();
        const eye = EYE_HEIGHTS[eyeIndex];
        walkLimits();
        // Down onto that spot, ending on the camera walking's first frame places.
        const camera = eyeCamera(map, pose, ground + eye, WALK_FOV);
        tween = tweenCamera(
          map,
          {
            center: LngLat.convert(camera.center ?? centre),
            zoom: camera.zoom ?? map.getZoom(),
            pitch: camera.pitch ?? map.getPitch(),
            bearing: camera.bearing ?? pose.yaw,
            elevation: camera.elevation ?? ground + eye,
            fov: WALK_FOV,
          },
          () => {
            tween = null;
            walker = startWalking(pose, eye, ground);
          },
        );
      }
    }
    // 'playback' is only ever entered through walkTrail, which sets it up first.
    mode = next;
    hud.setMode(mode);
    // A popup opened while walking would otherwise stay behind in orbit.
    closePopup();
    syncAim();
  }

  function toggleGyro(): void {
    const enable = (on: boolean) => {
      gyroOn = on;
      walker?.setGyro(on);
      hud.setGyro(on);
    };
    if (gyroOn) {
      enable(false);
      return;
    }
    if (!('DeviceOrientationEvent' in window)) {
      notify('This browser cannot read the phone’s orientation.', 'error');
      return;
    }
    // Called straight from the click, with nothing awaited first: iOS only shows
    // its prompt from inside a user gesture.
    const granted = compassNeedsPermission() ? requestCompassPermission() : Promise.resolve(true);
    void granted.then((ok) => {
      if (!ok) {
        notify('Motion permission denied — drag to look around instead.', 'error');
        return;
      }
      enable(true);
      // Desktops expose the event but never fire it. Say so rather than leave a
      // button that looks on and does nothing.
      setTimeout(() => {
        if (gyroOn && controls && !controls.device()) {
          enable(false);
          notify('No orientation sensor found on this device.', 'error');
        }
      }, 1500);
    });
  }

  function walkTrail(id: string): void {
    settle();
    const trail = getScene().trails.find((t) => t.id === id);
    if (!trail) return;
    const path = buildPath(trail.segments);
    if (path.total < 2) {
      notify(`${trail.name} is too short to walk.`, 'error');
      return;
    }
    const start = sampleAt(path, 0);
    const ele = trail.segments[0]?.[0]?.ele ?? 0;
    const pose: Pose = { ...start, yaw: 0, look: -10 };
    if (!walker) {
      walker = startWalking(pose, JUMP_HEIGHT, ele);
    } else {
      const far = haversine(walker.pose, start) > FAR_JUMP;
      walker.jump(start, far ? JUMP_HEIGHT : null, ele);
    }
    const playback = new Playback(path);
    playback.playing = true;
    playingId = id;
    walker.setPlayback(playback);
    mode = 'playback';
    hud.setMode(mode);
    // The jump may leave the point it names far behind.
    closePopup();
    syncAim();
  }

  // Escape undoes the most local thing first: playback back to walking, walking
  // back to orbit, and only in orbit does it reach the panel's own handler in
  // ui.ts. Capture phase, so this runs before that one and can stop it. A mouse
  // captured by pointer lock never sees this: the browser spends that Escape on
  // releasing it.
  function onKeyDown(e: KeyboardEvent): void {
    if (e.key !== 'Escape' || mode === 'orbit' || typingTarget()) return;
    setMode(mode === 'playback' ? 'walk' : 'orbit');
    e.stopImmediatePropagation();
    e.preventDefault();
  }
  window.addEventListener('keydown', onKeyDown, { capture: true });

  return {
    setBasemap(id) {
      map.removeLayer(LAYER_BASEMAP);
      map.removeSource(SRC_BASEMAP);
      map.addSource(SRC_BASEMAP, basemapSource(basemapById(id)));
      // Back underneath everything else.
      map.addLayer({ id: LAYER_BASEMAP, type: 'raster', source: SRC_BASEMAP }, LAYER_TRAILS);
    },
    syncTrails,
    setPointsVisible,
    setLocation(fix) {
      const source = map.getSource<GeoJSONSource>(SRC_LOCATION);
      if (!fix) {
        source?.setData(EMPTY);
        locationMarker.remove();
        locationShown = false;
        return;
      }
      source?.setData(circlePolygon(fix.lat, fix.lon, fix.accuracy));
      locationMarker.setLngLat([fix.lon, fix.lat]);
      if (!locationShown) {
        locationMarker.addTo(map);
        locationShown = true;
      }
    },
    setHeading(heading) {
      // Rotated by MapLibre rather than through the --heading property the 2D
      // marker uses: the marker's transform is rewritten on every frame, and only
      // setRotation composes with the map's own bearing and pitch.
      if (!heading) {
        locationEl.removeAttribute('data-heading');
        return;
      }
      locationEl.setAttribute('data-heading', heading.source);
      locationMarker.setRotation(heading.degrees);
    },
    fitTrail(id) {
      // Walking stays where it is: a row click must not pull you out of the scene.
      if (mode !== 'orbit') return;
      const trail = getScene().trails.find((t) => t.id === id);
      if (!trail?.bounds.isValid()) return;
      const b = trail.bounds;
      map.fitBounds([[b.getWest(), b.getSouth()], [b.getEast(), b.getNorth()]], {
        padding: 40,
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      });
    },
    panTo(lat, lon) {
      if (mode === 'orbit') map.panTo([lon, lat]);
    },
    walkTrail,
    viewFor2d() {
      // Where the flight was going, not wherever it had got to.
      settle();
      if (walker) return { lat: walker.pose.lat, lon: walker.pose.lon, zoom: 17 };
      const c = map.getCenter();
      return { lat: c.lat, lon: c.lng, zoom: Math.round(map.getZoom() + ZOOM_OFFSET) };
    },
    destroy() {
      settle();
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      walker?.destroy();
      controls?.destroy();
      hud.destroy();
      resizer.disconnect();
      cancelAnimationFrame(pending);
      locationMarker.remove();
      // Frees the GL context and its tile textures. The module stays cached, so
      // opening 3D again costs no download.
      map.remove();
    },
  };
}
