/**
 * The eye-height camera: one requestAnimationFrame loop that turns input (or a
 * trail being played) into a position on the ground and a view direction, and
 * places MapLibre's camera there.
 *
 * Why the camera is placed with calculateCameraOptionsFromTo and a short look-at
 * distance, rather than calculateCameraOptionsFromCameraLngLatAltRotation, which
 * reads like the obvious fit: MapLibre derives its near clipping plane from the
 * camera-to-centre distance (about D/75 at the default field of view, D·tan(fov/2)/25
 * in general), and that helper falls back to a 10 km centre whenever the view is
 * within about 6° of level — which at eye height is nearly always. A 10 km centre
 * puts the near plane ~130 m out and clips away every bit of ground you are standing
 * on. A fixed D of 15 m keeps it at about 0.3 m.
 */
import { LngLat, type CameraOptions, type Map as MlMap } from 'maplibre-gl';
import { angleDelta, offset } from './geo';
import { Playback, sampleAt, tangentBearing } from './trailPlayback';
import { KEY_TURN_RATE, type WalkControls } from './walkControls';

/** Camera-to-centre distance, in metres. See the module comment for the upper
 *  bound; the lower one is MapLibre's maxZoom, which a tiny D would exceed. */
const LOOK_DISTANCE = 15;
/** Vertical field of view while walking. Wider than MapLibre's 36.87° default,
 *  which at eye height feels like looking through a tube. */
export const WALK_FOV = 50;
/** Down to a little short of your feet, and up to well above the ridge line. */
const LOOK_MIN = -80;
const LOOK_MAX = 60;
/** Seconds for the ground height to settle when a finer terrain tile arrives —
 *  fast enough to follow a slope, slow enough that the swap is not a jolt. */
const GROUND_TAU = 0.15;
/** Seconds for playback to swing round to face along the trail. */
const FOLLOW_TAU = 0.5;
/** Seconds for following your location to swing round to your heading. Shorter
 *  than FOLLOW_TAU, since you are turning your own body, yet enough to hide the
 *  compass's 1° steps and its jitter. */
const HEADING_TAU = 0.3;
/** How long after you stop looking around playback, or following your heading,
 *  leaves the view alone, then how quickly it drifts back. */
const LOOK_HOLD_MS = 2000;
const LOOK_RETURN_TAU = 0.8;
/** The camera never goes nearer the ground than this, whatever the smoothing says.
 *  Well clear of the near plane (see the module comment): the smoothed ground lags
 *  behind a fast climb, and a floor inside the near plane lets the slope ahead be
 *  clipped away. */
const MIN_CLEARANCE = 1.0;
/** Seconds for the descent from a jump's height down to eye height. */
const DESCENT_TAU = 0.45;
/** Playback looks slightly down, as you would walking a path. */
const PLAYBACK_LOOK = -6;
/** Free-walk speed in m/s, before running and height. Ten times a real walk: the
 *  mountain is kilometres across, and real pace makes crossing it a chore. */
const MOVE_SPEED = 14;
/** Longest frame step, so a stall or a backgrounded tab cannot fling you across the map. */
const MAX_DT = 0.1;

export type Pose = { lat: number; lon: number; yaw: number; look: number };

const clampLook = (look: number) => Math.max(LOOK_MIN, Math.min(LOOK_MAX, look));
const smooth = (tau: number, dt: number) => 1 - Math.exp(-dt / tau);

/**
 * The camera options that put the eye at `alt` metres, standing at `pose`, seen
 * with a `fov` field of view. Exported so the flight down from orbit ends exactly
 * where walking's first frame begins.
 */
export function eyeCamera(map: MlMap, pose: Pose, alt: number, fov = map.getVerticalFieldOfView()): CameraOptions {
  const { lat, lon, yaw, look } = pose;
  const rad = look * (Math.PI / 180);
  const h = LOOK_DISTANCE * Math.cos(rad);
  const target = offset(lat, lon, h * Math.sin(yaw * (Math.PI / 180)), h * Math.cos(yaw * (Math.PI / 180)));
  const camera = map.calculateCameraOptionsFromTo(
    new LngLat(lon, lat),
    alt,
    new LngLat(target.lon, target.lat),
    alt + LOOK_DISTANCE * Math.sin(rad),
  );
  // MapLibre solves the zoom for the field of view it has now, and the camera sits
  // 0.5·H / tan(fov/2) pixels back, so another field of view shifts the zoom.
  if (camera.zoom !== undefined) {
    const halfTan = (deg: number) => Math.tan(deg * (Math.PI / 360));
    camera.zoom += Math.log2(halfTan(map.getVerticalFieldOfView()) / halfTan(fov));
  }
  return camera;
}

export class FirstPerson {
  pose: Pose;
  /** Metres above the ground: eye height, or a drone's. */
  eye = 1.7;
  playback: Playback | null = null;
  /** The way you are facing, from the compass or GPS course, while steering is
   *  on. Null keeps the view on whatever it last eased to. */
  heading: number | null = null;

  /** User turn on top of whatever the base direction is — see frame(). */
  private yawOffset: number;
  private lookOffset: number;
  /** The direction playback is easing towards, trailing the path's tangent. */
  private followYaw = 0;
  /** Following your location outside playback: the view faces `heading`. */
  private steering = false;
  /** The direction steering is easing towards, trailing `heading`. */
  private headingYaw = 0;
  /** Where the phone was pointing when the gyroscope was switched on, since on
   *  some platforms its yaw has no fixed north. */
  private deviceRef: number | null = null;

  /** Smoothed ground height under the eye. Starts as a guess, see jump(). */
  private ground: number;
  /** Height above the ground right now, falling towards `eye` after entering. */
  private height: number;
  private frameId = 0;
  private lastTime = 0;
  private lastCamera = '';

  constructor(
    private readonly map: MlMap,
    private readonly controls: WalkControls,
    start: Pose,
    startHeight: number,
    groundGuess: number,
    private readonly onFrame: () => void,
  ) {
    this.pose = { ...start, look: clampLook(start.look) };
    this.yawOffset = this.pose.yaw;
    this.lookOffset = this.pose.look;
    this.height = Math.max(startHeight, this.eye);
    this.ground = groundGuess;
    document.addEventListener('visibilitychange', this.onVisibility);
    this.run();
  }

  /** Starts walking `playback` from its current position, turned to face along it. */
  setPlayback(playback: Playback | null): void {
    const { yaw, look } = this.pose;
    this.playback = playback;
    if (playback) {
      this.followYaw = tangentBearing(playback.path, playback.s);
      // Kept as an offset from the trail, so the view swings round to it smoothly
      // rather than snapping.
      this.yawOffset = angleDelta(this.followYaw, yaw);
      this.lookOffset = look - PLAYBACK_LOOK;
    } else {
      this.rebaseYaw();
      this.lookOffset = look;
    }
    this.deviceRef = null;
  }

  /** Turns facing your heading on or off, from wherever the view points now. */
  setSteering(on: boolean): void {
    if (on === this.steering) return;
    this.steering = on;
    this.deviceRef = null;
    if (!this.playback) this.rebaseYaw();
  }

  /** Outside playback: the offset takes the whole direction, or, while steering,
   *  none of it, so the view swings from where it points round to your heading. */
  private rebaseYaw(): void {
    if (this.steering) {
      this.headingYaw = this.pose.yaw;
      this.yawOffset = 0;
    } else {
      this.yawOffset = this.pose.yaw;
    }
  }

  /**
   * Moves to a new place. From `height` metres up when given, which is how a jump
   * to somewhere far away gets its terrain loaded before you are standing in it.
   * `groundGuess` stands in until that terrain answers — without a camera over the
   * place, its tiles are never requested and it never would.
   */
  jump(to: { lat: number; lon: number }, height: number | null, groundGuess: number): void {
    this.pose.lat = to.lat;
    this.pose.lon = to.lon;
    if (height !== null) {
      this.height = Math.max(this.height, height);
      this.ground = groundGuess;
    }
  }

  setGyro(on: boolean): void {
    this.controls.setGyro(on);
    this.deviceRef = null;
    // Whatever the phone reported is no longer part of the view, so the offsets
    // take over the whole direction and nothing jumps.
    const baseYaw = this.playback ? this.followYaw : this.steering ? this.headingYaw : 0;
    const baseLook = this.playback ? PLAYBACK_LOOK : 0;
    this.yawOffset = angleDelta(baseYaw, this.pose.yaw);
    this.lookOffset = on ? 0 : this.pose.look - baseLook;
  }

  /** The smoothed ground height under the eye, in metres. */
  get groundHeight(): number {
    return this.ground;
  }

  destroy(): void {
    cancelAnimationFrame(this.frameId);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private onVisibility = () => {
    cancelAnimationFrame(this.frameId);
    if (!document.hidden) this.run();
    else if (this.playback) this.playback.playing = false;
  };

  private run(): void {
    this.lastTime = performance.now();
    const step = (now: number) => {
      const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
      this.lastTime = now;
      this.frame(dt, now);
      this.frameId = requestAnimationFrame(step);
    };
    this.frameId = requestAnimationFrame(step);
  }

  /**
   * The view direction is always base + offset. The base is what something other
   * than you says: nothing while walking, your heading while following your
   * location, the trail ahead during playback, the phone's orientation when the
   * gyroscope is on. The offset is your own turning
   * from drags and keys. Keeping the two apart is what lets playback steer while
   * you look around, and lets it drift back once you stop.
   */
  private frame(dt: number, now: number): void {
    const intent = this.controls.intent();
    const { dyaw, dlook } = this.controls.consumeLook();
    this.yawOffset += dyaw + intent.turn * KEY_TURN_RATE * dt;
    this.lookOffset += dlook;

    let baseYaw = 0;
    let baseLook = 0;
    const playback = this.playback;
    if (playback) {
      playback.tick(dt);
      const at = sampleAt(playback.path, playback.s);
      this.pose.lat = at.lat;
      this.pose.lon = at.lon;
      const tangent = tangentBearing(playback.path, playback.s);
      this.followYaw += angleDelta(this.followYaw, tangent) * smooth(FOLLOW_TAU, dt);
      baseYaw = this.followYaw;
      baseLook = PLAYBACK_LOOK;
    }
    const steering = this.steering && !playback;
    if (steering) {
      if (this.heading !== null) {
        this.headingYaw += angleDelta(this.headingYaw, this.heading) * smooth(HEADING_TAU, dt);
      }
      baseYaw = this.headingYaw;
    }

    const device = this.controls.device();
    if (device) {
      // While steering the compass already turns with the phone, so the phone
      // only tilts the view; its yaw on top would count every turn twice.
      if (!steering) {
        this.deviceRef ??= device.yaw;
        baseYaw += angleDelta(this.deviceRef, device.yaw);
      }
      baseLook = device.look;
    } else if ((playback || steering) && now - this.controls.lastInput() > LOOK_HOLD_MS) {
      const k = smooth(LOOK_RETURN_TAU, dt);
      this.yawOffset -= angleDelta(0, this.yawOffset) * k;
      // Your heading says nothing about tilt, so walking keeps the one you chose.
      if (playback) this.lookOffset -= this.lookOffset * k;
    }

    // Clamped as a total, and the offset pulled back to match, so looking past
    // the limit and back does not have to unwind the overshoot first.
    const look = clampLook(baseLook + this.lookOffset);
    this.lookOffset = look - baseLook;
    this.pose.look = look;
    this.pose.yaw = (((baseYaw + this.yawOffset) % 360) + 360) % 360;

    if (!playback) {
      // Faster the higher you are, so a drone is not stuck at walking pace.
      const speed = MOVE_SPEED * Math.max(1, this.eye / 20);
      const rad = this.pose.yaw * (Math.PI / 180);
      const f = intent.forward * speed * dt;
      const r = intent.right * speed * dt;
      if (f || r) {
        const next = offset(
          this.pose.lat,
          this.pose.lon,
          f * Math.sin(rad) + r * Math.cos(rad),
          f * Math.cos(rad) - r * Math.sin(rad),
        );
        this.pose.lat = next.lat;
        this.pose.lon = next.lon;
      }
    }

    this.place(dt);
    this.onFrame();
  }

  private place(dt: number): void {
    const { lat, lon, yaw, look } = this.pose;
    // Null until the terrain under you has loaded, and the last known ground is
    // the best guess meanwhile. Smoothed, because a finer terrain tile replacing a
    // coarse one can move the ground by metres in a single frame.
    const g = this.map.queryTerrainElevation([lon, lat]) ?? this.ground;
    this.ground += (g - this.ground) * smooth(GROUND_TAU, dt);
    this.height += (this.eye - this.height) * smooth(DESCENT_TAU, dt);
    // The max is what keeps the camera above the raw ground as well as the
    // smoothed one, which also keeps MapLibre from lifting it out of the terrain
    // on its own and fighting this loop.
    const alt = Math.max(this.ground + this.height, g + MIN_CLEARANCE);

    // Standing still costs no redraw.
    const key = `${lat},${lon},${yaw},${look},${alt}`;
    if (key === this.lastCamera) return;
    this.lastCamera = key;

    this.map.jumpTo(eyeCamera(this.map, this.pose, alt));
  }
}
