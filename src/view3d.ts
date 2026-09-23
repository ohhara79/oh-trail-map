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
  Point,
  Popup,
  ScaleControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import L from 'leaflet';
// ?worker&url has Vite bundle the worker as its own entry and hand back its URL.
// A bare ?url would copy the file as-is, with its import of the shared chunk left
// pointing at nothing.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

import { basemapById, MAX_ZOOM } from './basemaps';
import { tweenCamera, type Tween } from './cameraTween';
import { FirstPerson, WALK_FOV, eyeCamera, type Pose } from './firstPerson';
import { angleDelta, bearing } from './geo';
import { compassNeedsPermission, requestCompassPermission, type Heading } from './heading';
import { Hud, type Mode3d } from './hud3d';
import { haversine } from './gpx';
import { canHover, createHoverLabel } from './hoverLabel';
import { LOCATE_ICON_HTML } from './map';
import type { NationalPoint } from './nationalPoint';
import { createPointBalls, LAYER_POINT_BALLS, NEAR_CULL } from './pointBalls';
import { createPointDots, LAYER_POINT_DOTS } from './pointDots';
import { loadNationalPoints, PIN_RADIUS, PIN_STROKE, popupContent } from './points';
import {
  BALL_HEIGHT,
  BALL_RADIUS,
  EMPTY,
  LAYER_BASEMAP,
  LAYER_HALOS,
  LAYER_POINT_SHADOW,
  LAYER_POINTS,
  LAYER_PROFILE_CURSOR_SHADOW,
  LAYER_TRAILS,
  LAYER_TRAIL_HOVER,
  LAYER_TRAIL_SELECTED,
  SRC_BASEMAP,
  SRC_LOCATION,
  SRC_PROFILE_CURSOR,
  allOf,
  basemapSource,
  circlePolygon,
  pointsFilter,
  selectedFilter,
  sky,
  style,
  trailOpacity,
  trailWidths,
  visibleFilter,
} from './scene3d';
import { HALO_PULSE, HALO_RINGS, pinReach, tolerance } from './selection';
import { Playback, buildPath, distanceAtPoint, sampleAt } from './trailPlayback';
import { indexAtDistance } from './trailProfile';
import type { Trail } from './trails';
import { createControls, type WalkControls } from './walkControls';

setWorkerUrl(workerUrl);

export type Scene = {
  trails: readonly Trail[];
  selectedId: string | null;
  basemapId: string;
  /** The 지점번호 the panel list has hidden. Handed out live by main.ts, which
   *  owns it — never a copy, so syncPoints() always reads the current one. */
  hiddenPoints: ReadonlySet<string>;
};

/** A place and a zoom in Leaflet's terms, which is how the two views hand over. */
export type View2d = { lat: number; lon: number; zoom: number };

export type View3dOptions = {
  container: HTMLElement;
  getScene: () => Scene;
  start: View2d;
  /** main.ts's selectTrail: the one place selection changes. */
  onSelect: (id: string | null) => void;
  /** The point this view has a popup open on, or null when it has none. The panel
   *  list's highlight follows the open popup, and 3D owns its own. */
  onPointPopup: (point: NationalPoint | null) => void;
  /** A drag in orbit, walking with the keys or joystick, or starting a trail's
   *  playback: how following your location stops. */
  onStopFollowing: () => void;
  /**
   * The GPX point playback has reached, and the trail it belongs to — null for
   * both when nothing is playing. main.ts turns it into a profile cursor move; the
   * cursor has one writer and it is not this module. Fired only when it changes.
   */
  onPlaybackPoint: (trailId: string | null, index: number | null) => void;
  /**
   * Where the eye is and which way it faces, while walking or playing a trail —
   * what the 2D minimap follows. `eye` is the eye height in metres, which sets how
   * far out the minimap looks. Fired only when something in it changed.
   */
  onCamera: (at: { lat: number; lon: number; yaw: number; eye: number }) => void;
  /**
   * What the readout names: the ground under the crosshair in orbit, and where
   * you stand while walking or playing a trail. `ele` is null while the terrain
   * there has not loaded. Rounded to what the readout shows, and fired only when
   * that changes.
   */
  onReadout: (at: { lat: number; lon: number; ele: number | null }) => void;
  /** The GPU dropped the context — common on phones under memory pressure. */
  onContextLost: () => void;
  notify: (message: string, kind?: 'info' | 'error', timeout?: number) => void;
};

export type View3d = {
  setBasemap(id: string): void;
  /** Re-reads visibility and selection from getScene(). */
  syncTrails(): void;
  /** Re-reads the hidden national points from getScene(). */
  syncPoints(): void;
  /** A point picked from the panel list: go to it and open its popup. */
  showPoint(point: NationalPoint): void;
  setLocation(fix: { lat: number; lon: number; accuracy: number } | null): void;
  setHeading(heading: Heading | null): void;
  /** Whether the locate button is following you: in Walk, you face your heading too. */
  setFollowing(on: boolean): void;
  /** The dot for the GPX point the profile's cursor is on, or null for none. */
  setProfileCursor(at: { lat: number; lon: number; color: string } | null): void;
  /** The pin `;` `'` stepped the profile cursor onto, to preview as a hover would,
   *  or null for none. */
  setSteppedPoint(point: NationalPoint | null): void;
  fitTrail(id: string): void;
  panTo(lat: number, lon: number): void;
  /** Plays trail `id` from GPX point `fromPoint`, or from its start. */
  walkTrail(id: string, fromPoint?: number): void;
  /** The profile chart was scrubbed onto GPX point `index` while a trail plays:
   *  that is a seek, not a cursor move. */
  seekToPoint(index: number): void;
  viewFor2d(): View2d;
  destroy(): void;
};

/** MapLibre's tiles are 512px to Leaflet's 256, so the same view is one zoom lower. */
const ZOOM_OFFSET = 1;
const ORBIT_MAX_PITCH = 85;
/** MapLibre's own default field of view, restored when leaving walk mode. */
const ORBIT_FOV = 36.87;
/** Walking can look above the horizon, which means a pitch past 90. */
const WALK_MAX_PITCH = 179;
/** The walk camera sits at about z20–21 and must never be clamped: clamping the
 *  zoom would move it away from the eye. */
const WALK_MAX_ZOOM = 24;
/** Derived, not restated: 2D reaches MAX_ZOOM and orbit should reach the same
 *  place, so closing 3D never has to pull you back out. */
const ORBIT_MAX_ZOOM = MAX_ZOOM - ZOOM_OFFSET;
/** Fog start (0 map centre, 1 horizon). See sky() in scene3d.ts. */
const ORBIT_FOG = 0.5;
const WALK_FOG = 0.9;
/** Eye heights the HUD cycles through: standing, a tree top, a drone. */
const EYE_HEIGHTS = [1.7, 20, 80];
/** How far the walking crosshair reaches for a trail, in metres, per eye height.
 *  A trail far off is under a pixel tall, and what picks it is the crosshair's
 *  12px tolerance — which, once its top edge passes the horizon, spans kilometres
 *  of ground, so a tap on bare ground would pick a trail across the valley. From
 *  eye height h that happens about 70·h metres out. A ball needs no reach: the ray
 *  itself picks it, as long as the ground does not hide it (inSight). */
const TRAIL_REACH = [150, 1000, 5000];
/** A jump to a trail further away than this descends from above, so the terrain
 *  there has a moment to load before you are standing in it. */
const FAR_JUMP = 200;
const JUMP_HEIGHT = 150;
/** Walking shows a point's name beside its ball within this many metres: about a
 *  minute's walk ahead of reaching it. */
const NEARBY = 100;

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

  // On top of everything, and hidden until walking: see syncGround.
  const balls = createPointBalls(map, points, () => getScene().hiddenPoints);
  map.addLayer(balls);
  map.setLayoutProperty(LAYER_POINT_BALLS, 'visibility', 'none');
  // Orbit's dots, above everything too, and hidden while walking.
  const dots = createPointDots(map, points, () => getScene().hiddenPoints);
  map.addLayer(dots);

  // Two controls rather than one: zoom alone is as tall as Leaflet's zoom control, so
  // #locate and the zoom buttons stay put between views, and the compass is lifted
  // above #locate by style.css. Bottom controls stack upwards, so it goes second.
  map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
  const compass = new NavigationControl({ showZoom: false, visualizePitch: true });
  map.addControl(compass, 'bottom-right');
  // 2D's scale bar, in the same corner. It measures across the middle of the
  // screen, so tilted it is only true at that depth; style.css hides it at eye
  // height, where it would mean nothing.
  map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
  // The compass is a button, not a joystick: MapLibre also lets you drag it to turn
  // and tilt the map, so a press that slid off still moved the camera. Without that,
  // only a press and release on the button fires its click (reset north and pitch).
  compass._handler.off();
  // An id for the `N` shortcut, which presses it by id (see shortcuts.ts).
  container.querySelector<HTMLButtonElement>('.maplibregl-ctrl-compass')!.id = 'compass3d';

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
  let following = false;
  /** Your latest heading in degrees, which Walk faces while following. */
  let heading: number | null = null;
  let hinted = false;
  let popup: Popup | null = null;
  /** The point `popup` describes, so hiding that point can take its popup with it. */
  let popupPoint: NationalPoint | null = null;
  /** The camera flight between orbit and walk, while one is under way. */
  let tween: Tween | null = null;
  /** The zoom orbit had when you last left it, so the flight back up lands on the view
   *  you left rather than a fixed one. MapLibre's zoom, as map.getZoom() gives it.
   *  Only a floor under the first frame here: both ways out of orbit set it fresh. */
  let orbitZoom = map.getZoom();
  /** The hover preview's inputs and what it last drew; see syncHover. */
  const hoverLabel = createHoverLabel(container);
  /** Where the mouse is over the canvas, or null when it is not. */
  let hoverAt: { x: number; y: number } | null = null;
  let hoverFrame = 0;
  /** What the hover layers' filters were last set to, so a mouse move that stays on
   *  the same thing does not restyle the map. */
  let hoveredTrail: string | null = null;
  let hoveredPoint: number | null = null;
  /** The pin `;` `'` stepped the profile cursor onto, previewed in orbit as a hover
   *  would be while the mouse picks nothing. main.ts decides it; see setSteppedPoint. */
  let steppedPoint: NationalPoint | null = null;

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
    onAttitude: () => walker?.recentre(),
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
    const haloed = trails.find((t) => t.id === selectedId && t.visible)?.id ?? null;
    if (haloed !== haloedId) {
      haloedId = haloed;
      if (haloed !== null) pulseHalo();
    }
    scheduleHover();
  }

  /**
   * The white ring blinks as 2D's does on selection (HALO_PULSE). A cosine rather
   * than CSS's ease-in-out per half, which it matches to within a few percent of
   * opacity. Only when the halo's trail changes — not on every restyle, which in 2D
   * rebuilds the paths and so replays the pulse on a colour change too.
   */
  function pulseHalo(): void {
    cancelAnimationFrame(pulseFrame);
    const layer = LAYER_HALOS[LAYER_HALOS.length - 1];
    const high = HALO_RINGS[HALO_RINGS.length - 1].opacity;
    const { low, period, count } = HALO_PULSE;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start = performance.now();
    const step = (now: number) => {
      const t = (now - start) / period;
      if (t >= count) {
        map.setPaintProperty(layer, 'line-opacity', high);
        return;
      }
      const dip = (1 - Math.cos(2 * Math.PI * t)) / 2;
      map.setPaintProperty(layer, 'line-opacity', high - (high - low) * dip);
      pulseFrame = requestAnimationFrame(step);
    };
    pulseFrame = requestAnimationFrame(step);
  }

  /**
   * A filter rather than a rebuilt source: setData would re-upload 272 features to
   * say one thing, and — the reason it had to be a filter — a filtered-out feature
   * keeps its position, so the `index` pointAt() reads stays valid whatever the
   * panel list hides.
   */
  function syncPoints(): void {
    const { hiddenPoints } = getScene();
    for (const id of [LAYER_POINTS, LAYER_POINT_SHADOW]) map.setFilter(id, pointsFilter(hiddenPoints));
    // The balls are no style layer to filter: they read the hidden set as they draw.
    map.triggerRepaint();
    // The same rule as 2D: a popup whose pin is gone points at nothing.
    if (popupPoint && hiddenPoints.has(popupPoint.code)) closePopup();
    scheduleHover();
  }

  // The halo 3D opens on was already pulsed in 2D; only a change from here on pulses.
  let haloedId: string | null = (() => {
    const { trails, selectedId } = getScene();
    return trails.find((t) => t.id === selectedId && t.visible)?.id ?? null;
  })();
  let pulseFrame = 0;

  syncTrails();
  syncPoints();

  const locationEl = document.createElement('div');
  locationEl.className = 'locate-icon';
  locationEl.innerHTML = LOCATE_ICON_HTML;
  // Flat on the ground and turned with the map, so the cone points the way you
  // face on the terrain rather than at a fixed angle on the screen.
  const locationMarker = new Marker({ element: locationEl, rotationAlignment: 'map', pitchAlignment: 'map' });
  let locationShown = false;

  // Whether the profile cursor's dot and ball are on the map.
  let profileShown = false;

  // -- clicks --------------------------------------------------------------------

  // queryRenderedFeatures pads its box by how much smaller the top of the screen is
  // drawn than the centre, measured where the top-left corner meets the ground plane.
  // Once that corner is above the horizon it meets the plane behind the camera, the
  // factor comes out negative, and the box shrinks to nothing: walking, that is every
  // look between level and about 25° down, so a trail a few metres ahead could not be
  // picked. Only the query reads the factor, and only to pad the lookup before the
  // exact test against the line's width, so a larger one can only cost time; 1 already
  // covers a line drawn flat on the map. MapLibre replaces the transform only when
  // the projection changes, which style.load above has already done.
  const { transform } = map._camera;
  const pitchScale = transform.maxPitchScaleFactor.bind(transform);
  transform.maxPitchScaleFactor = () => Math.max(1, pitchScale());

  /** The point `layer` draws within `r` pixels of (x, y) on the canvas, among those
   *  `keep` allows. A point the panel list has hidden is filtered out of the layer,
   *  and queryRenderedFeatures honours that, so there is nothing further to ask here. */
  function pointAt(
    layer: string,
    x: number,
    y: number,
    r: number,
    keep: (lat: number, lon: number) => boolean = () => true,
  ): NationalPoint | undefined {
    return map
      .queryRenderedFeatures([[x - r, y - r], [x + r, y + r]], { layers: [layer] })
      .map((hit) => points[hit.properties.index as number])
      .find((point) => keep(point.lat, point.lon));
  }

  /**
   * Moves you to a place, the way the locate button does.
   *
   * A flight lands where following wants it anyway: into Walk from the map centre,
   * back to orbit where you stood. The next fix carries on from there.
   */
  function goTo(lat: number, lon: number): void {
    if (tween) return;
    if (mode === 'orbit') {
      map.panTo([lon, lat]);
      return;
    }
    // Starting playback stops following, so only a click on locate gets here
    // during playback, and it means leave the trail.
    if (mode === 'playback') setMode('walk');
    if (!walker) return;
    const far = haversine(walker.pose, { lat, lon }) > FAR_JUMP;
    const ground = map.queryTerrainElevation([lon, lat]) ?? walker.groundHeight;
    walker.jump({ lat, lon }, far ? JUMP_HEIGHT : null, ground);
    if (far) {
      // The jump may leave the point it names far behind.
      closePopup();
    }
  }

  function openPopup(point: NationalPoint): void {
    // closeOnClick off: the click handlers decide what a click closes.
    popup = new Popup({ offset: 10, maxWidth: '240px', closeOnClick: false })
      .setLngLat([point.lon, point.lat])
      .setDOMContent(popupContent(point))
      .addTo(map);
    // Its own ✕ closes it without closePopup, and lets the preview back.
    popup.on('close', scheduleHover);
    popupPoint = point;
    // Standing still draws no frame, so the first placement cannot wait for one.
    liftPopup();
    opts.onPointPopup(point);
    scheduleHover();
    // A still camera draws no frame, and the nearby label has to make way now.
    map.triggerRepaint();
  }

  function closePopup(): void {
    popup?.remove();
    popup = null;
    popupPoint = null;
    opts.onPointPopup(null);
    scheduleHover();
    // And the nearby label comes back without waiting for a step.
    map.triggerRepaint();
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
    const pick = pickAt(e.point.x, e.point.y);
    if (pick?.point) openPopup(pick.point);
    else if (pick?.trail) opts.onSelect(pick.trail);
  });

  /** What an orbit click at (x, y) on the canvas opens or selects, once nothing is
   *  selected. The click and the hover preview both ask here, so they agree. */
  function pickAt(x: number, y: number): { point?: NationalPoint; trail?: string } | null {
    // A point first, as in 2D, where a pin takes the click. The query already counts
    // the drawn dot, so the pad is what pinReach() adds beyond its edge.
    const point = pointAt(LAYER_POINTS, x, y, pinReach() - (PIN_RADIUS + PIN_STROKE));
    if (point) return { point };
    const trail = trailIn(x, y, tolerance());
    return trail ? { trail } : null;
  }

  /**
   * The id of the visible trail drawn nearest (x, y) on the canvas, within `r`
   * pixels either way. Nearest, as trailAt() picks in 2D, rather than whichever the
   * query happens to list first — which the hover preview would otherwise show
   * flipping between two trails that run close together.
   *
   * Measured against the geometry the query returns, which is only the tiles in
   * the box, so a long trail costs no more than a short one.
   *
   * With `keep`, only the segments with an end it allows count. The track's
   * points are metres apart, so that is as good as cutting the segment.
   */
  function trailIn(
    x: number,
    y: number,
    r: number,
    keep?: (lat: number, lon: number) => boolean,
  ): string | undefined {
    const hits = map.queryRenderedFeatures([[x - r, y - r], [x + r, y + r]], { layers: [LAYER_TRAILS] });
    if (!keep && hits.length <= 1) return hits[0]?.properties.id as string | undefined;
    const at = L.point(x, y);
    let best: string | undefined;
    let bestDistance = Infinity;
    for (const hit of hits) {
      const { geometry } = hit;
      const lines =
        geometry.type === 'LineString'
          ? [geometry.coordinates]
          : geometry.type === 'MultiLineString'
            ? geometry.coordinates
            : [];
      for (const line of lines) {
        let previous: L.Point | null = null;
        let previousKept = false;
        for (const [lon, lat] of line) {
          const p = map.project([lon, lat]);
          const current = L.point(p.x, p.y);
          const kept = !keep || keep(lat, lon);
          const d = !kept && !previousKept
            ? Infinity
            : previous
              ? L.LineUtil.pointToSegmentDistance(at, previous, current)
              : at.distanceTo(current);
          if (d < bestDistance) {
            bestDistance = d;
            best = hit.properties.id as string;
          }
          previous = current;
          previousKept = kept;
        }
      }
    }
    return best;
  }

  // While walking, the pointer looks around and a captured mouse has no cursor, so
  // the crosshair at the screen centre, where the camera looks, is what you aim
  // with. A point is a ball floating over the ground by then, and the view ray is
  // tested against it: anywhere on it counts, or just off it, within 8px — a little
  // past the ends of the crosshair's 7px arms.
  function aimedPoint(): NationalPoint | undefined {
    if (!walker) return undefined;
    const { pose } = walker;
    const halfHeight = map.getCanvas().clientHeight / 2;
    const pad = Math.atan((8 * Math.tan((WALK_FOV * Math.PI) / 360)) / halfHeight);
    return balls.pick({ ...pose, alt: walker.altitude }, pose.yaw, pose.look, pad, inSight);
  }

  /** Whether the ball centred `alt` metres up over (lat, lon) can be seen: a ray cast
   *  through the terrain at it meets no ground more than a ball's radius short of
   *  it. The same tiles drawn are the ones cast against, so a ridge that hides the
   *  ball on screen blocks it here too, however far off. The centre floats over its
   *  spot, so on open ground the ray passes over it and meets the slope behind. */
  function inSight(lat: number, lon: number, alt: number): boolean {
    const p = balls.project(lon, lat, alt);
    if (!walker || !p || !map.terrain) return true;
    const ground = map._camera.transform
      .screenTerrainPointToMercatorCoordinate(new Point(p.x, p.y), map.terrain)
      ?.toLngLat();
    if (!ground) return true;
    const { pose } = walker;
    return haversine(pose, { lat: ground.lat, lon: ground.lng }) >= haversine(pose, { lat, lon }) - BALL_RADIUS;
  }

  /** Whether a spot is within the crosshair's reach for a trail: see TRAIL_REACH.
   *  Measured from where you stand on the ground, so a jump's descent does not
   *  change it. */
  function inTrailReach(lat: number, lon: number): boolean {
    return !walker || haversine(walker.pose, { lat, lon }) <= TRAIL_REACH[eyeIndex];
  }

  /** The trail under the crosshair and within reach, unless it is already the
   *  selected one, which a tap has nothing more to do with. A trail a way off is a
   *  hairline, so anywhere a little past the crosshair's arms counts, not only its
   *  centre. */
  function aimedTrail(): string | undefined {
    const canvas = map.getCanvas();
    const id = trailIn(canvas.clientWidth / 2, canvas.clientHeight / 2, 12, inTrailReach);
    return id === getScene().selectedId ? undefined : id;
  }

  /** Whether a popup at `lngLat` is still on screen from where you stand. MapLibre
   *  projects a point behind the camera to a mirrored spot in front of it, so being
   *  inside the canvas is not enough on its own. Measured at the top of the ball,
   *  where the popup sits, once its ground is known. */
  function inWalkView(lngLat: LngLat): boolean {
    if (!walker) return true;
    const { pose } = walker;
    const there = { lat: lngLat.lat, lon: lngLat.lng };
    if (Math.abs(angleDelta(pose.yaw, bearing(pose, there))) >= 90) return false;
    const p = ballTop(lngLat) ?? map.project(lngLat);
    const canvas = map.getCanvas();
    return p.x >= 0 && p.y >= 0 && p.x <= canvas.clientWidth && p.y <= canvas.clientHeight;
  }

  // Fires every frame the walk camera moves, so nothing here queries the scene: what
  // the crosshair is over is only asked on a tap (onSceneTap).
  map.on('move', () => {
    if (mode === 'orbit') return;
    // Walked or looked away from the point: its popup has nothing left to point at.
    if (popup && !inWalkView(popup.getLngLat())) closePopup();
  });

  // After each frame drawn, not on move: the ball layer has just drawn with the
  // matrix ballTop() projects with, so the popup lands on the ball you see. It also
  // follows the ground as finer terrain tiles arrive, which fires no move.
  map.on('render', () => {
    if (mode !== 'orbit') {
      liftPopup();
      syncNearby();
    } else if (steppedPoint) {
      // The stepped point's label rides along with the camera.
      scheduleHover();
    }
    reportReadout();
  });

  /** The closest point you have walked up to and can see, whose name the label shows
   *  while walking. Only a preview: a tap still opens what the crosshair aims at.
   *  None while a popup is open, which already names its point. */
  function nearbyPoint(): NationalPoint | undefined {
    if (!walker || tween || popup?.isOpen()) return undefined;
    const { pose } = walker;
    // Points are walked directly here rather than queried off the map, so the
    // panel list's hidden set has to be asked about by hand.
    const { hiddenPoints } = getScene();
    let nearest: NationalPoint | undefined;
    let nearestDistance = NEARBY;
    for (const point of points) {
      const d = haversine(pose, point);
      // Distance first: it is the cheap test, and it rejects almost every point.
      if (d > nearestDistance || hiddenPoints.has(point.code)) continue;
      if (!inWalkView(new LngLat(point.lon, point.lat))) continue;
      // That far off, a ridge can hide the ball: the same test the crosshair's pick
      // makes, so the label never names a ball a tap could not reach.
      const ground = map.queryTerrainElevation([point.lon, point.lat]);
      if (ground === null || !inSight(point.lat, point.lon, ground + BALL_HEIGHT)) continue;
      // Nor a ball that is not drawn at all: the one you are standing in is left out
      // of the frame (NEAR_CULL in pointBalls.ts), and this label hangs beside a ball.
      // To the centre and in three dimensions, the way the layer measures. Along the
      // ground it would agree at eye height and nowhere else — at 20 m and 80 m you
      // pass right over a point, never inside its ball, and the name is the whole
      // reason to fly over one.
      if (Math.hypot(d, ground + BALL_HEIGHT - walker.altitude) < NEAR_CULL) continue;
      nearest = point;
      nearestDistance = d;
    }
    return nearest;
  }

  /** The hover label, while walking, beside the ball of nearbyPoint(). After each
   *  frame drawn, like liftPopup, so it sits on the ball you see. */
  function syncNearby(): void {
    const point = nearbyPoint();
    const at = point && ballTop(new LngLat(point.lon, point.lat));
    if (point && at) hoverLabel.show(point.name || point.code, at.x, at.y);
    else hoverLabel.hide();
  }

  /** The last spot handed to onReadout, so a frame that changed nothing sends nothing. */
  let readoutAt = '';
  /** After each frame, since finer terrain tiles arriving change the elevation
   *  under a still camera, and that fires no move. */
  function reportReadout(): void {
    let lat: number;
    let lon: number;
    if (walker) {
      ({ lat, lon } = walker.pose);
    } else {
      const c = map.getCenter();
      lat = c.lat;
      lon = c.lng;
    }
    const ground = map.queryTerrainElevation([lon, lat]) ?? walker?.groundHeight ?? null;
    const ele = ground === null ? null : Math.round(ground);
    // Five decimals is about a metre, which is what the readout shows.
    lat = Number(lat.toFixed(5));
    lon = Number(lon.toFixed(5));
    const key = `${lat},${lon},${ele}`;
    if (key === readoutAt) return;
    readoutAt = key;
    opts.onReadout({ lat, lon, ele });
  }

  // Trails and shadows are drawn into textures cached on the terrain, and MapLibre
  // drops the ones under a source tile as it loads, matching the two by overscaled
  // zoom. Past a source's maxzoom — the trails' 18, below where walking stands — its
  // tile is overscaled and the terrain's never are, so none match: a trail selected
  // while walking kept its old look until you walked onto new ground. Matched here
  // by the tile it was cut from instead.
  map.on('sourcedata', (e) => {
    const id = e.tile ? e.coord : undefined;
    if (id?.isOverscaled()) map.terrain?.tileManager.releaseRTT(id.scaledTo(id.canonical.z));
  });

  /** Where on the canvas the top of the ball over `lngLat` was drawn last frame, or
   *  null while the terrain there has not loaded or the spot is behind the camera. */
  function ballTop(lngLat: LngLat): { x: number; y: number } | null {
    const ground = map.queryTerrainElevation(lngLat);
    if (ground === null) return null;
    return balls.project(lngLat.lng, lngLat.lat, ground + BALL_HEIGHT + BALL_RADIUS);
  }

  /** MapLibre places a popup on the ground. While walking, its point is a ball
   *  floating over that spot, so the popup is lifted to stand the same 10px above
   *  the top of the ball as it does above a dot in orbit. */
  function liftPopup(): void {
    if (!popup) return;
    const top = mode === 'orbit' ? null : ballTop(popup.getLngLat());
    if (!top) {
      popup.setOffset(10);
      return;
    }
    const base = map.project(popup.getLngLat());
    popup.setOffset([top.x - base.x, top.y - base.y - 10]);
  }

  /** A tap or click on the scene while walking. True when it was spent here — on the
   *  controls, a popup or a pick — so the click the browser sends next is swallowed
   *  rather than pressed on what it put there. The mouse is captured either way. */
  function onSceneTap(): boolean {
    // Put away by a tap during playback: this tap only brings the controls back, the
    // way a phone video player does, and picks nothing out from behind them.
    if (hud.reveal()) return true;
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
    // Only while walking: selected, the trail's name shows on the selection bar, with
    // its ▶, reached with the mouse once Escape frees it — and that bar is hidden
    // during playback, where a tap is for the controls instead. The trail playing is
    // skipped anyway as the selected one, but a crossing trail within reach is not,
    // and picking it there ate the tap for nothing you could see. It saves the query
    // per tap too.
    if (mode === 'walk') {
      const trail = aimedTrail();
      if (trail) {
        opts.onSelect(trail);
        return true;
      }
    }
    hud.dismiss();
    return false;
  }

  // -- hover preview -------------------------------------------------------------

  // What an orbit click at the mouse would pick, shown before the click: the same
  // preview as 2D (see syncHover in main.ts), drawn with two filtered layers. Its
  // state is declared with the rest, above: the first syncTrails() already asks.

  /** Coalesces the mouse moves and state changes of one frame into one syncHover. */
  function scheduleHover(): void {
    if (hoverFrame) return;
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = 0;
      syncHover();
    });
  }

  /** The single place the 3D hover preview is derived, by the orbit click's rules:
   *  nothing new while a popup is open or a trail is selected, then pickAt(). Walking
   *  aims with the crosshair instead, and a moving camera is not about to click.
   *  With nothing picked, the pin `;` `'` stepped onto, labelled beside its dot. */
  function syncHover(): void {
    const quiet =
      mode !== 'orbit' ||
      tween !== null ||
      map.isMoving() ||
      !canHover() ||
      (popup?.isOpen() ?? false) ||
      getScene().selectedId !== null;
    const at = quiet ? null : hoverAt;
    const pick = at ? pickAt(at.x, at.y) : null;
    const trail = pick?.trail ?? null;
    const stepped =
      mode === 'orbit' && tween === null && !pick && steppedPoint && !getScene().hiddenPoints.has(steppedPoint.code)
        ? steppedPoint
        : null;
    const pickedPoint = pick?.point ?? stepped;
    // main.ts's copy of the point, not this module's: matched by its 지점번호.
    const pointIndex = pickedPoint ? points.findIndex((p) => p.code === pickedPoint.code) : null;
    if (trail !== hoveredTrail) {
      hoveredTrail = trail;
      map.setFilter(LAYER_TRAIL_HOVER, selectedFilter(trail));
    }
    if (pointIndex !== hoveredPoint) {
      hoveredPoint = pointIndex;
      dots.setHover(pointIndex);
    }
    // Walking owns the cursor while in walk or playback (style.css).
    if (mode === 'orbit') map.getCanvas().style.cursor = pick ? 'pointer' : '';
    // Walking, the label is syncNearby's.
    if (mode !== 'orbit') return;
    const name = pick?.point
      ? pick.point.name || pick.point.code
      : getScene().trails.find((t) => t.id === pick?.trail)?.name;
    const steppedAt = stepped && steppedOnScreen(stepped);
    if (at && name) hoverLabel.show(name, at.x, at.y);
    else if (stepped && steppedAt) hoverLabel.show(stepped.name || stepped.code, steppedAt.x, steppedAt.y);
    else hoverLabel.hide();
  }

  /** Where the stepped point's dot is on the canvas, or null off it. */
  function steppedOnScreen(point: NationalPoint): { x: number; y: number } | null {
    const lngLat = new LngLat(point.lon, point.lat);
    if (!map.getBounds().contains(lngLat)) return null;
    const p = map.project(lngLat);
    const canvas = map.getCanvas();
    return p.x >= 0 && p.y >= 0 && p.x <= canvas.clientWidth && p.y <= canvas.clientHeight ? p : null;
  }

  map.on('mousemove', (e: MapMouseEvent) => {
    // Only the canvas: over a popup or a marker there is nothing to pick through.
    hoverAt = e.originalEvent.target === map.getCanvas() ? { x: e.point.x, y: e.point.y } : null;
    scheduleHover();
  });
  map.on('mouseout', () => {
    hoverAt = null;
    scheduleHover();
  });
  map.on('movestart', scheduleHover);
  // The mouse has not moved, but the terrain has under it.
  map.on('moveend', scheduleHover);

  map.on('dragstart', () => {
    if (mode === 'orbit') opts.onStopFollowing();
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
    closePopup();
    map.stop();
    map.setMaxZoom(WALK_MAX_ZOOM);
    map.setMaxPitch(WALK_MAX_PITCH);
    map.setCenterClampedToGround(false);
    map.getCanvas().style.cursor = '';
    scheduleHover();
  }

  function orbitLimits(): void {
    for (const h of HANDLERS) h.enable();
    map.setCenterClampedToGround(true);
    map.setVerticalFieldOfView(ORBIT_FOV);
    map.setMaxPitch(ORBIT_MAX_PITCH);
    map.setMaxZoom(ORBIT_MAX_ZOOM);
    map.setSky(sky(ORBIT_FOG));
  }

  /** The last camera handed to onCamera, so a frame that changed nothing sends nothing. */
  let cameraAt = '';
  function reportCamera(pose: Pose): void {
    const eye = EYE_HEIGHTS[eyeIndex];
    const key = `${pose.lat},${pose.lon},${pose.yaw},${eye}`;
    if (key === cameraAt) return;
    cameraAt = key;
    opts.onCamera({ lat: pose.lat, lon: pose.lon, yaw: pose.yaw, eye });
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
    const walkControls = controls;
    const next = new FirstPerson(map, controls, pose, height, groundGuess, () => {
      // Before the playback branch below, which returns early: the disc is read in
      // plain walk too, and that is the mode with the least else to go on. The
      // minimap likewise.
      hud.setAttitude(next.pose.yaw, next.pose.look);
      reportCamera(next.pose);
      // The altitude place() just used, so the ball layer culls against the camera it
      // is about to draw with rather than the one before it.
      balls.setEye({ lat: next.pose.lat, lon: next.pose.lon, alt: next.altitude });
      // Before the early return below, so walking reports no point the same way
      // playing reports one.
      syncPlaybackPoint();
      const playback = next.playback;
      if (!playback) {
        // Walking away is how following stops here. Only moving: looking around
        // leaves you where your location puts you.
        const { forward, right } = walkControls.intent();
        if (forward || right) opts.onStopFollowing();
        return;
      }
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
    next.heading = heading;
    next.setSteering(following);

    if (!hinted) {
      hinted = true;
      notify(
        window.matchMedia('(pointer: coarse)').matches
          ? 'Move with the joystick, drag to look around. Aim the crosshair at a point or trail and tap to pick it.'
          : 'W A S D or arrows to move, Shift to run. Drag, or click to capture the mouse, to look around. Aim the crosshair at a point or trail and click to pick it. Esc frees the mouse to reach what you picked, and Esc again goes back.',
        'info',
        6000,
      );
    }
    // Before the loop's first frame, which is a frame behind the one MapLibre draws
    // for the camera the flight down has just landed on: without this, arriving with
    // a ball under the crosshair flashes its inside for that frame.
    balls.setEye({ lat: next.pose.lat, lon: next.pose.lon, alt: next.altitude });
    return next;
  }

  /** Stops the eye-height camera and says where it stood. The camera keeps the walk
   *  limits: the flight back up starts past the orbit's pitch limit. */
  function stopWalking(): { pose: Pose; ground: number } | null {
    const stood = walker ? { pose: { ...walker.pose }, ground: walker.groundHeight } : null;
    // Orbit draws no balls, but the flight up runs frames with none of this loop's,
    // and an eye left behind would cull against where you used to stand.
    balls.setEye(null);
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

  /** The trail and GPX point last reported through onPlaybackPoint, so a frame that
   *  reached the same point again writes nothing — the same compare-before-writing
   *  Hud.setAttitude and FirstPerson.place() do with what they own. */
  let reportedId: string | null = null;
  let reportedPoint: number | null = null;

  /**
   * Where playback has got to, as a GPX point rather than a distance: the profile
   * panel names points, and the two scales of distance do not line up (see
   * Path.point in trailPlayback.ts). The single place onPlaybackPoint is called,
   * so every way out of playback reports the same way in.
   */
  function syncPlaybackPoint(): void {
    const playback = walker?.playback;
    const id = playback ? playingId : null;
    const point = playback
      ? playback.path.point[indexAtDistance(playback.path, playback.s)]
      : null;
    if (id === reportedId && point === reportedPoint) return;
    reportedId = id;
    reportedPoint = point;
    opts.onPlaybackPoint(id, point);
  }

  /** Whether the trails and points are drawn for the ground, as syncGround last set. */
  let groundOn = false;

  /**
   * Walking and playback draw for a camera at eye height: trails a fixed width on
   * the ground rather than a hairline, and points as balls floating over a shadow
   * on the terrain in place of the dots, the profile cursor's among them. Orbit gets
   * back what it had. Run on every mode change, which is when a camera flight
   * starts, so the swap happens while everything moves.
   */
  function syncGround(): void {
    const on = mode !== 'orbit';
    if (on === groundOn) return;
    groundOn = on;
    for (const [id, width] of trailWidths(on ? map.getCenter().lat : null)) {
      map.setPaintProperty(id, 'line-width', width);
    }
    for (const id of [LAYER_POINT_BALLS, LAYER_POINT_SHADOW, LAYER_PROFILE_CURSOR_SHADOW]) {
      map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    }
    for (const id of [LAYER_POINTS, LAYER_POINT_DOTS]) {
      map.setLayoutProperty(id, 'visibility', on ? 'none' : 'visible');
    }
  }

  /** Walk faces your heading while following your location. Playback steers along
   *  its trail instead, and starting one stops following anyway. */
  function syncSteering(): void {
    if (!walker) return;
    walker.heading = heading;
    walker.setSteering(following && mode !== 'playback');
  }

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
            // The view you left orbit from, over the spot you stood on.
            zoom: orbitZoom,
            // Flat, like the view 3D opens with and the one the compass button gives.
            // The bearing still holds the way you walked.
            pitch: 0,
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
        // Before walkLimits() lifts the ceiling to WALK_MAX_ZOOM.
        orbitZoom = map.getZoom();
        const pose: Pose = { lat: centre.lat, lon: centre.lng, yaw: map.getBearing(), look: 0 };
        const ground = map.getCenterElevation();
        const eye = EYE_HEIGHTS[eyeIndex];
        // The minimap shows as soon as the mode changes: put it on the spot now
        // rather than leave it where 2D was for the length of the flight down.
        reportCamera(pose);
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
    syncGround();
    syncSteering();
    // A popup opened while walking would otherwise stay behind in orbit.
    closePopup();
    scheduleHover();
    // Both branches above have already dropped the playback. Orbit runs no frames
    // to report from, and leaving playback should not wait for one.
    syncPlaybackPoint();
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

  function walkTrail(id: string, fromPoint?: number): void {
    settle();
    const trail = getScene().trails.find((t) => t.id === id);
    if (!trail) return;
    const path = buildPath(trail.segments);
    if (path.total < 2) {
      notify(`${trail.name} is too short to walk.`, 'error');
      return;
    }
    // From the last point there would be nothing left to play, so that is the start.
    let s0 = fromPoint === undefined ? 0 : distanceAtPoint(path, fromPoint);
    if (s0 >= path.total) s0 = 0;
    const start = sampleAt(path, s0);
    const first = trail.segments[0]?.[0]?.ele ?? 0;
    const ele = s0 > 0 ? (trail.segments.flat()[fromPoint!]?.ele ?? first) : first;
    const pose: Pose = { ...start, yaw: 0, look: 0 };
    reportCamera(pose);
    if (!walker) {
      // Straight from orbit, so this is the view Esc comes back to.
      orbitZoom = map.getZoom();
      walker = startWalking(pose, JUMP_HEIGHT, ele);
    } else {
      const far = haversine(walker.pose, start) > FAR_JUMP;
      walker.jump(start, far ? JUMP_HEIGHT : null, ele);
    }
    // Or the next fix would pull you off the trail.
    opts.onStopFollowing();
    const playback = new Playback(path);
    // Before setPlayback, which faces you along the trail from wherever this is.
    playback.seek(s0);
    playback.playing = true;
    playingId = id;
    walker.setPlayback(playback);
    mode = 'playback';
    hud.setMode(mode);
    syncGround();
    syncSteering();
    // The jump may leave the point it names far behind.
    closePopup();
  }

  // Escape undoes the most local thing first: playback back to walking, walking
  // back to orbit, and only in orbit does it reach the panel's own handler in
  // ui.ts, which steps back to 2D once it has nothing left to undo. Capture
  // phase, so this runs before that one and can stop it. A mouse captured by
  // pointer lock never sees this: the browser spends that Escape on releasing it.
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
      map.addLayer({ id: LAYER_BASEMAP, type: 'raster', source: SRC_BASEMAP }, LAYER_TRAIL_HOVER);
    },
    syncTrails,
    syncPoints,
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
    setHeading(next) {
      heading = next?.degrees ?? null;
      syncSteering();
      // Rotated by MapLibre rather than through the --heading property the 2D
      // marker uses: the marker's transform is rewritten on every frame, and only
      // setRotation composes with the map's own bearing and pitch.
      if (!next) {
        locationEl.removeAttribute('data-heading');
        return;
      }
      locationEl.setAttribute('data-heading', next.source);
      locationMarker.setRotation(next.degrees);
    },
    setFollowing(on) {
      following = on;
      syncSteering();
    },
    setSteppedPoint(point) {
      if (point === steppedPoint) return;
      steppedPoint = point;
      scheduleHover();
    },
    setProfileCursor(at) {
      if (!at) {
        // Called on every cursor move now, so it only touches the map when there
        // is something on it to take off.
        if (profileShown) {
          map.getSource<GeoJSONSource>(SRC_PROFILE_CURSOR)?.setData(EMPTY);
          balls.setCursor(null);
          dots.setCursor(null);
          profileShown = false;
        }
        return;
      }
      // The shadow of the ball walking draws; orbit draws the dot instead.
      map.getSource<GeoJSONSource>(SRC_PROFILE_CURSOR)?.setData(circlePolygon(at.lat, at.lon, BALL_RADIUS));
      balls.setCursor(at);
      dots.setCursor(at);
      profileShown = true;
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
    panTo: goTo,
    showPoint(point) {
      // Reuses the locate button's own move, so a row click lands you exactly
      // where following would: orbit pans, and walking jumps — from far away, over
      // the terrain, so it has a moment to load before you stand in it.
      goTo(point.lat, point.lon);
      // After goTo, which may have closed a popup of its own on a long jump. The
      // point is the whole payload of a row click, so its popup is opened whether
      // or not its pin is drawn — the popup is placed by coordinate, not bound to
      // the marker, so it reads the same either way.
      closePopup();
      openPopup(point);
    },
    walkTrail,
    seekToPoint(index) {
      // The cursor is not moved here: the next frame reports the point back
      // through onPlaybackPoint and main.ts moves it from there, so the chart,
      // the scrubber and the camera cannot end up saying three different things.
      const playback = walker?.playback;
      if (playback) playback.seek(distanceAtPoint(playback.path, index));
    },
    viewFor2d() {
      // Where the flight was going, not wherever it had got to.
      settle();
      if (walker) return { lat: walker.pose.lat, lon: walker.pose.lon, zoom: 17 };
      const c = map.getCenter();
      return { lat: c.lat, lon: c.lng, zoom: map.getZoom() + ZOOM_OFFSET };
    },
    destroy() {
      settle();
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      walker?.destroy();
      controls?.destroy();
      hud.destroy();
      resizer.disconnect();
      cancelAnimationFrame(pending);
      cancelAnimationFrame(hoverFrame);
      cancelAnimationFrame(pulseFrame);
      locationMarker.remove();
      // Its own element in the container, which the next 3D view reuses: left
      // behind, a name showing when you left would stay on screen for good.
      hoverLabel.remove();
      // Frees the GL context and its tile textures. The module stays cached, so
      // opening 3D again costs no download.
      map.remove();
    },
  };
}
