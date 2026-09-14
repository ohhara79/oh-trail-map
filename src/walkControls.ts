/**
 * Input for the eye-height camera: keyboard, mouse, touch and the phone's own
 * orientation, reduced to "which way do you want to move" and "how far did you
 * turn". No camera code here — firstPerson.ts decides what the intent means.
 */

/** Degrees of turn per pixel. A captured mouse is precise and moves in small
 *  steps; a finger dragging the scene covers far more pixels per intended turn. */
const MOUSE_LOCKED_DEG_PER_PX = 0.15;
const DRAG_DEG_PER_PX = 0.25;
/** Arrow-key turning speed, in degrees per second. */
export const KEY_TURN_RATE = 90;
/** A pointer that moves less than this between down and up was a click. */
const CLICK_SLOP = 4;

export type Intent = {
  /** -1 (back) to 1 (forward); analogue from the joystick. */
  forward: number;
  /** -1 (left) to 1 (right). */
  right: number;
  /** -1 (left) to 1 (right), from the arrow keys: a rate, not a step. */
  turn: number;
  run: boolean;
};

/** The phone's view direction: yaw in degrees clockwise from the device's own
 *  north — true north on some platforms, arbitrary on others — and look from -90
 *  (straight down) to 90 (straight up). */
export type DeviceLook = { yaw: number; look: number };

export type WalkControls = {
  intent(): Intent;
  /** The turn accumulated since the last call, from drags and a captured mouse. */
  consumeLook(): { dyaw: number; dlook: number };
  /** performance.now() of the last look or move input, so playback knows when
   *  you have stopped looking around and it may drift back to the trail ahead. */
  lastInput(): number;
  /** The phone's latest orientation while the gyroscope is on, else null. */
  device(): DeviceLook | null;
  setGyro(on: boolean): void;
  destroy(): void;
};

export type ControlsOptions = {
  /** The map canvas container: drags and clicks here look around. */
  surface: HTMLElement;
  joystick: HTMLElement;
  onSpace: () => void;
  /** A click or tap on the surface, as opposed to a drag. Returns true when the
   *  tap was spent bringing back hidden controls, so it must not also capture the
   *  mouse. */
  onTap?: () => boolean;
};

const RAD = Math.PI / 180;

/**
 * The direction out of the back of the phone, from DeviceOrientation's
 * intrinsic Z-X'-Y'' angles. The device's -Z axis rotated by
 * R = Rz(alpha)·Rx(beta)·Ry(gamma) gives, in east-north-up:
 *
 *   d = −( cosα·sinγ + sinα·sinβ·cosγ,  sinα·sinγ − cosα·sinβ·cosγ,  cosβ·cosγ )
 *
 * An upright phone facing alpha 0 gives (0, 1, 0): north, level. Lying flat gives
 * (0, 0, −1): straight down. Rotating the screen between portrait and landscape
 * only rolls the phone about this axis, so no screen-angle correction is needed.
 */
export function deviceLook(alpha: number, beta: number, gamma: number): DeviceLook {
  const a = alpha * RAD;
  const b = beta * RAD;
  const g = gamma * RAD;
  const x = -(Math.cos(a) * Math.sin(g) + Math.sin(a) * Math.sin(b) * Math.cos(g));
  const y = -(Math.sin(a) * Math.sin(g) - Math.cos(a) * Math.sin(b) * Math.cos(g));
  const z = -(Math.cos(b) * Math.cos(g));
  return {
    yaw: Math.atan2(x, y) / RAD,
    look: Math.asin(Math.max(-1, Math.min(1, z))) / RAD,
  };
}

function typingTarget(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
}

export function createControls(opts: ControlsOptions): WalkControls {
  const { surface, joystick } = opts;
  const thumb = joystick.firstElementChild as HTMLElement | null;
  const keys = new Set<string>();
  let dyaw = 0;
  let dlook = 0;
  let last = 0;
  let stick = { forward: 0, right: 0 };
  let stickId: number | null = null;
  const drags = new Map<number, { x: number; y: number; startX: number; startY: number }>();
  let gyro: DeviceLook | null = null;
  let gyroOn = false;

  const touch = () => (last = performance.now());

  // e.code, not e.key: with the Korean IME on, W arrives as key 'ㅈ' but code
  // 'KeyW'. Code names the physical key, which is what a movement binding means.
  const BOUND = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'ShiftLeft', 'ShiftRight', 'Space',
  ]);

  function onKeyDown(e: KeyboardEvent) {
    if (!BOUND.has(e.code) || typingTarget() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') {
      // A focused button already answers Space by clicking itself; toggling here
      // as well would undo that click.
      if (document.activeElement instanceof HTMLButtonElement) return;
      if (!e.repeat) opts.onSpace();
    } else {
      keys.add(e.code);
      touch();
    }
    e.preventDefault();
  }
  function onKeyUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }
  // A key released while the window is not focused never sends keyup, and you
  // would keep walking into the distance.
  function onBlur() {
    keys.clear();
  }

  function onMouseMove(e: MouseEvent) {
    if (document.pointerLockElement !== surface) return;
    dyaw += e.movementX * MOUSE_LOCKED_DEG_PER_PX;
    dlook -= e.movementY * MOUSE_LOCKED_DEG_PER_PX;
    touch();
  }

  function onPointerDown(e: PointerEvent) {
    if (document.pointerLockElement === surface) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drags.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY });
    surface.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent) {
    const drag = drags.get(e.pointerId);
    if (!drag) return;
    // Grab semantics, like Street View: the scene follows the finger, so dragging
    // left turns you right.
    dyaw -= (e.clientX - drag.x) * DRAG_DEG_PER_PX;
    dlook += (e.clientY - drag.y) * DRAG_DEG_PER_PX;
    drag.x = e.clientX;
    drag.y = e.clientY;
    touch();
  }
  function onPointerUp(e: PointerEvent) {
    const drag = drags.get(e.pointerId);
    drags.delete(e.pointerId);
    if (!drag) return;
    const moved = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
    if (e.type !== 'pointerup' || moved >= CLICK_SLOP) return;
    // A click that brought the hidden playback controls back leaves the mouse
    // free, or it could never reach them.
    if (opts.onTap?.()) return;
    // A plain click with a mouse captures it, game-style, so looking no longer
    // needs a held button; Escape gives it back. Only on click, never on a drag,
    // so dragging to look keeps working for anyone who would rather not.
    // pointerup is a user activation, which requestPointerLock requires.
    if (e.pointerType === 'mouse' && surface.requestPointerLock) {
      Promise.resolve(surface.requestPointerLock()).catch(() => {});
    }
  }

  function setStick(e: PointerEvent) {
    const box = joystick.getBoundingClientRect();
    const radius = box.width / 2;
    let dx = e.clientX - (box.left + radius);
    let dy = e.clientY - (box.top + radius);
    const len = Math.hypot(dx, dy);
    if (len > radius) {
      dx *= radius / len;
      dy *= radius / len;
    }
    stick = { forward: -dy / radius, right: dx / radius };
    if (thumb) thumb.style.transform = `translate(${dx}px, ${dy}px)`;
    touch();
  }
  function onStickDown(e: PointerEvent) {
    // Handled here and stopped, or the surface underneath would also treat the
    // thumb as a drag to look.
    e.stopPropagation();
    e.preventDefault();
    if (stickId !== null) return;
    stickId = e.pointerId;
    joystick.setPointerCapture(e.pointerId);
    setStick(e);
  }
  function onStickMove(e: PointerEvent) {
    if (e.pointerId === stickId) setStick(e);
  }
  function onStickUp(e: PointerEvent) {
    if (e.pointerId !== stickId) return;
    stickId = null;
    stick = { forward: 0, right: 0 };
    if (thumb) thumb.style.transform = '';
  }

  function onOrientation(e: DeviceOrientationEvent) {
    if (e.alpha == null || e.beta == null || e.gamma == null) return;
    gyro = deviceLook(e.alpha, e.beta, e.gamma);
    touch();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('mousemove', onMouseMove);
  surface.addEventListener('pointerdown', onPointerDown);
  surface.addEventListener('pointermove', onPointerMove);
  surface.addEventListener('pointerup', onPointerUp);
  surface.addEventListener('pointercancel', onPointerUp);
  joystick.addEventListener('pointerdown', onStickDown);
  joystick.addEventListener('pointermove', onStickMove);
  joystick.addEventListener('pointerup', onStickUp);
  joystick.addEventListener('pointercancel', onStickUp);

  const held = (...codes: string[]) => codes.some((c) => keys.has(c));

  return {
    intent() {
      const forward = (held('KeyW', 'ArrowUp') ? 1 : 0) - (held('KeyS', 'ArrowDown') ? 1 : 0);
      const right = (held('KeyD') ? 1 : 0) - (held('KeyA') ? 1 : 0);
      const turn = (held('ArrowRight') ? 1 : 0) - (held('ArrowLeft') ? 1 : 0);
      return {
        forward: Math.max(-1, Math.min(1, forward + stick.forward)),
        right: Math.max(-1, Math.min(1, right + stick.right)),
        turn,
        run: held('ShiftLeft', 'ShiftRight'),
      };
    },
    consumeLook() {
      const out = { dyaw, dlook };
      dyaw = 0;
      dlook = 0;
      return out;
    },
    lastInput: () => last,
    device: () => (gyroOn ? gyro : null),
    setGyro(on) {
      gyroOn = on;
      gyro = null;
      window.removeEventListener('deviceorientation', onOrientation);
      if (on) window.addEventListener('deviceorientation', onOrientation);
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('deviceorientation', onOrientation);
      document.removeEventListener('mousemove', onMouseMove);
      surface.removeEventListener('pointerdown', onPointerDown);
      surface.removeEventListener('pointermove', onPointerMove);
      surface.removeEventListener('pointerup', onPointerUp);
      surface.removeEventListener('pointercancel', onPointerUp);
      joystick.removeEventListener('pointerdown', onStickDown);
      joystick.removeEventListener('pointermove', onStickMove);
      joystick.removeEventListener('pointerup', onStickUp);
      joystick.removeEventListener('pointercancel', onStickUp);
      if (document.pointerLockElement === surface) document.exitPointerLock();
      if (thumb) thumb.style.transform = '';
    },
  };
}
