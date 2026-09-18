/**
 * The 3D view's on-screen controls. The markup is static in index.html; this
 * binds it and writes state back into it. Which parts show in which mode is
 * decided in style.css from data-mode3d on #app, so there is one place a mode's
 * layout lives.
 *
 * While a trail plays, a tap on the scene hides the controls over the scene, so
 * they stop blocking the view, and another tap brings them back. Nothing else
 * moves them: no timer takes them away, and pausing leaves them as they are. That
 * state is data-chrome on #app, read by style.css the same way.
 */
import { formatDistance } from './gpx';

export type Mode3d = 'orbit' | 'walk' | 'playback';

export type HudCallbacks = {
  /** Walk pressed: walking or playing a trail. Not pressed: orbit. */
  onWalk: () => void;
  onPlayToggle: () => void;
  onSpeed: () => void;
  /** 0..1 along the trail. */
  onSeek: (fraction: number) => void;
  onClosePlayback: () => void;
  onEye: () => void;
  onGyro: () => void;
  /** The attitude disc pressed: face north and level. */
  onAttitude: () => void;
};

export type PlaybackState = { playing: boolean; speed: number; s: number; total: number; name: string };

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

/** The scrubber's resolution. Fine enough that a drag looks continuous on any trail. */
const SCRUB_STEPS = 1000;
/** Everything over the scene that a tap hides during playback. Keep in sync with
 *  the data-chrome rules in style.css. */
const CHROME = '#expand, #compass, #locate, #view3d, #attitude3d, #mode3d, #playback3d, #profile';

/** The attitude face's radius, in the svg's user units — see the markup in index.html. */
const FACE_RADIUS = 10;
/** The tilt that fills that face. Past it the disc is solid sky or solid ground, which
 *  is the right reading of looking that far up or down; the full −80..60 clamp would
 *  flatten a few degrees off level to almost nothing. */
const PITCH_SPAN = 45;

export class Hud {
  private readonly app = el('app');
  private readonly root = el('hud3d');
  readonly joystick = el('joystick');
  private readonly walk = el<HTMLButtonElement>('walk3d');
  private readonly eye = el<HTMLButtonElement>('eye3d');
  private readonly gyro = el<HTMLButtonElement>('gyro3d');
  private readonly attitude = el<HTMLButtonElement>('attitude3d');
  private readonly play = el<HTMLButtonElement>('play3d');
  private readonly speed = el<HTMLButtonElement>('speed3d');
  private readonly scrub = el<HTMLInputElement>('scrub3d');
  private readonly label = el('scrub3d-label');
  private readonly title = el('playback3d-name');
  private readonly abort = new AbortController();
  /** True while the scrubber is held, so playback does not drag it out from under you. */
  private seeking = false;
  private mode: Mode3d = 'orbit';
  /** The last attitude written, so a frame that changed nothing touches no style. */
  private attitudeAt = '';

  constructor(cb: HudCallbacks) {
    const signal = this.abort.signal;
    this.walk.addEventListener('click', () => cb.onWalk(), { signal });
    this.eye.addEventListener('click', () => cb.onEye(), { signal });
    this.gyro.addEventListener('click', () => cb.onGyro(), { signal });
    this.attitude.addEventListener('click', () => cb.onAttitude(), { signal });
    this.play.addEventListener('click', () => cb.onPlayToggle(), { signal });
    this.speed.addEventListener('click', () => cb.onSpeed(), { signal });
    el('close3d-playback').addEventListener('click', () => cb.onClosePlayback(), { signal });
    this.scrub.max = String(SCRUB_STEPS);
    this.scrub.addEventListener('input', () => {
      this.seeking = true;
      cb.onSeek(Number(this.scrub.value) / SCRUB_STEPS);
    }, { signal });
    this.scrub.addEventListener('change', () => (this.seeking = false), { signal });
    // Escape spent on releasing a captured mouse: the cursor is back, so should the
    // controls be.
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement) this.reveal();
    }, { signal });
    this.root.hidden = false;
  }

  setMode(mode: Mode3d): void {
    this.mode = mode;
    this.app.dataset.mode3d = mode;
    // Entering playback, or starting another trail while one plays, opens with the
    // controls up: only a tap on the scene puts them away.
    this.show();
    this.walk.setAttribute('aria-pressed', String(mode !== 'orbit'));
  }

  setEye(metres: number): void {
    this.eye.textContent = metres < 10 ? `${metres} m` : `${Math.round(metres)} m`;
  }

  setGyro(on: boolean): void {
    this.gyro.setAttribute('aria-pressed', String(on));
  }

  /**
   * Where the view points, from the walk camera's pose. Called every frame, so it
   * rounds and compares before writing, the way place() in firstPerson.ts does with
   * its camera.
   *
   * The card turns against you — a compass card holds still while you turn under it —
   * and the ball drops as you look up, since the horizon falls in view as your gaze
   * rises and svg y grows downwards.
   */
  setAttitude(yaw: number, look: number): void {
    const half = (n: number) => Math.round(n * 2) / 2;
    const deg = half(-yaw);
    const px = half(Math.max(-1, Math.min(1, look / PITCH_SPAN)) * FACE_RADIUS);
    const next = `${deg} ${px}`;
    if (next === this.attitudeAt) return;
    this.attitudeAt = next;
    this.attitude.style.setProperty('--yaw', `${deg}deg`);
    this.attitude.style.setProperty('--tilt', `${px}px`);
  }

  setPlayback(state: PlaybackState): void {
    // Called every frame, so it only writes what the frame changed.
    this.play.textContent = state.playing ? '❚❚' : '▶';
    this.play.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
    this.speed.textContent = `${state.speed}×`;
    this.title.textContent = state.name;
    this.label.textContent = `${formatDistance(state.s)} / ${formatDistance(state.total)}`;
    if (!this.seeking) {
      this.scrub.value = String(state.total > 0 ? Math.round((state.s / state.total) * SCRUB_STEPS) : 0);
    }
  }

  /**
   * A tap or click on the scene with the controls hidden: it only brings them back.
   * True when it did, so the tap is spent here — nothing behind them is picked — and
   * the click the browser sends after it is swallowed rather than pressed on what
   * just appeared. A captured mouse reaches them after Escape, which shows them too.
   */
  reveal(): boolean {
    if (this.mode !== 'playback' || this.app.dataset.chrome !== 'hidden') return false;
    this.show();
    return true;
  }

  /** A tap or click on the scene that picked nothing, with the controls up: away
   *  they go, until the next tap. */
  dismiss(): void {
    if (this.mode === 'playback') this.hide();
  }

  private show(): void {
    delete this.app.dataset.chrome;
  }

  private hide(): void {
    this.app.dataset.chrome = 'hidden';
    // A hidden button left focused would swallow Space, which walkControls then
    // leaves alone rather than toggling playback.
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused.closest(CHROME)) focused.blur();
  }

  destroy(): void {
    this.abort.abort();
    this.show();
    this.root.hidden = true;
    delete this.app.dataset.mode3d;
  }
}
