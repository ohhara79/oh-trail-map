/**
 * A short camera flight between the orbit and walk views, so switching modes does
 * not lose track of where you are.
 *
 * Why not map.easeTo: it ignores `elevation` and always eases the centre onto the
 * terrain, and it leaves the field of view alone. The walk camera's centre floats at
 * eye height with its own field of view, so this places the camera with jumpTo, which
 * does honour `elevation`, on every frame.
 */
import { LngLat, type Map as MlMap } from 'maplibre-gl';
import { angleDelta } from './geo';

export type CameraState = {
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
  /** Metres above sea level of the centre point. */
  elevation: number;
  fov: number;
};

export type Tween = {
  /** Places the end state now and runs onDone, if the flight has not already ended. */
  finish(): void;
};

/** Milliseconds: a short hop does not drag, a dive from far out is not a blur. */
const MIN_DURATION = 700;
const MAX_DURATION = 1600;
const BASE_DURATION = 500;
const PER_ZOOM = 90;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

export function cameraState(map: MlMap): CameraState {
  return {
    center: map.getCenter(),
    zoom: map.getZoom(),
    pitch: map.getPitch(),
    bearing: map.getBearing(),
    elevation: map.getCenterElevation(),
    fov: map.getVerticalFieldOfView(),
  };
}

export function tweenCamera(map: MlMap, to: CameraState, onDone: () => void): Tween {
  const from = cameraState(map);
  const turn = angleDelta(from.bearing, to.bearing);
  const dz = to.zoom - from.zoom;
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : Math.max(MIN_DURATION, Math.min(MAX_DURATION, BASE_DURATION + PER_ZOOM * Math.abs(dz)));

  const place = (k: number) => {
    // The tilt follows the height: it stays looking down while the camera is high
    // and levels out only near the ground. Levelling early would swing the camera
    // low behind the centre, where a slope rising behind you can hide it.
    const kp = dz > 0 ? k * k : 1 - (1 - k) ** 2;
    map.setVerticalFieldOfView(lerp(from.fov, to.fov, k));
    map.jumpTo({
      center: [lerp(from.center.lng, to.center.lng, k), lerp(from.center.lat, to.center.lat, k)],
      zoom: lerp(from.zoom, to.zoom, k),
      pitch: lerp(from.pitch, to.pitch, kp),
      bearing: from.bearing + turn * k,
      elevation: lerp(from.elevation, to.elevation, k),
    });
  };

  let frameId = 0;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(frameId);
    place(1);
    onDone();
  };

  const start = performance.now();
  const step = (now: number) => {
    const t = duration > 0 ? (now - start) / duration : 1;
    if (t >= 1) {
      finish();
      return;
    }
    place(easeInOut(t));
    frameId = requestAnimationFrame(step);
  };
  // Even an instant flight ends on the next frame, never inside this call, so the
  // caller has its Tween in hand before onDone runs.
  frameId = requestAnimationFrame(step);
  return { finish };
}
