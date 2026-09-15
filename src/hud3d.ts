/**
 * The 3D view's on-screen controls. The markup is static in index.html; this
 * binds it and writes state back into it. Which parts show in which mode is
 * decided in style.css from data-mode3d on #app, so there is one place a mode's
 * layout lives.
 *
 * While a trail plays, the controls over the scene fade out after a few seconds
 * so they stop blocking the view, and a tap on the scene brings them back. That
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
};

export type PlaybackState = { playing: boolean; speed: number; s: number; total: number; name: string };

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

/** The scrubber's resolution. Fine enough that a drag looks continuous on any trail. */
const SCRUB_STEPS = 1000;
/** How long the playback controls stay up after they were last shown or used. */
const HIDE_DELAY = 3000;
/** Everything over the scene that fades out during playback. Keep in sync with
 *  the data-chrome rules in style.css. */
const CHROME = '#expand, #compass, #locate, #view3d, #mode3d, #playback3d';

export class Hud {
  private readonly app = el('app');
  private readonly root = el('hud3d');
  readonly joystick = el('joystick');
  private readonly crosshair = el('crosshair3d');
  private readonly walk = el<HTMLButtonElement>('walk3d');
  private readonly eye = el<HTMLButtonElement>('eye3d');
  private readonly gyro = el<HTMLButtonElement>('gyro3d');
  private readonly play = el<HTMLButtonElement>('play3d');
  private readonly speed = el<HTMLButtonElement>('speed3d');
  private readonly scrub = el<HTMLInputElement>('scrub3d');
  private readonly label = el('scrub3d-label');
  private readonly title = el('playback3d-name');
  private readonly abort = new AbortController();
  /** True while the scrubber is held, so playback does not drag it out from under you. */
  private seeking = false;
  private mode: Mode3d = 'orbit';
  /** Whether the trail was playing at the last setPlayback, so a change can be told apart. */
  private playing = false;
  private hideTimer = 0;

  constructor(cb: HudCallbacks) {
    const signal = this.abort.signal;
    this.walk.addEventListener('click', () => cb.onWalk(), { signal });
    this.eye.addEventListener('click', () => cb.onEye(), { signal });
    this.gyro.addEventListener('click', () => cb.onGyro(), { signal });
    this.play.addEventListener('click', () => cb.onPlayToggle(), { signal });
    this.speed.addEventListener('click', () => cb.onSpeed(), { signal });
    el('close3d-playback').addEventListener('click', () => cb.onClosePlayback(), { signal });
    this.scrub.max = String(SCRUB_STEPS);
    this.scrub.addEventListener('input', () => {
      this.seeking = true;
      cb.onSeek(Number(this.scrub.value) / SCRUB_STEPS);
    }, { signal });
    this.scrub.addEventListener('change', () => (this.seeking = false), { signal });
    // Using a control keeps them all up: the bar must not fade out under the
    // finger pressing it. The scene itself is left to tap().
    const keepAlive = (e: Event) => {
      if (this.hideTimer && !(e.target as Element).closest('#map3d')) this.scheduleHide();
    };
    this.app.addEventListener('pointerdown', keepAlive, { signal });
    this.app.addEventListener('input', keepAlive, { signal });
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
    if (mode !== 'playback') this.playing = false;
    this.show();
    // Another trail started while one was already playing: setPlayback sees no
    // change, so the timer starts here.
    if (mode === 'playback' && this.playing) this.scheduleHide();
    this.walk.setAttribute('aria-pressed', String(mode !== 'orbit'));
  }

  setEye(metres: number): void {
    this.eye.textContent = metres < 10 ? `${metres} m` : `${Math.round(metres)} m`;
  }

  /** Whether the crosshair is over something a tap would open. */
  setAimed(on: boolean): void {
    this.crosshair.toggleAttribute('data-aimed', on);
  }

  setGyro(on: boolean): void {
    this.gyro.setAttribute('aria-pressed', String(on));
  }

  setPlayback(state: PlaybackState): void {
    // Called every frame, so only a change of playing does anything. Paused, the
    // controls come back and stay.
    if (state.playing !== this.playing) {
      this.playing = state.playing;
      if (state.playing) this.scheduleHide();
      else this.show();
    }
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
   * A tap or click on the scene. During playback it toggles the controls. Returns
   * true when it brought them back, so the caller leaves the mouse uncaptured
   * and able to reach them.
   */
  tap(): boolean {
    if (this.mode !== 'playback') return false;
    if (this.app.dataset.chrome === 'hidden') {
      this.reveal();
      return true;
    }
    this.hide();
    return false;
  }

  /** Shows the controls, and while playing, only for a while. */
  private reveal(): void {
    if (this.mode !== 'playback') return;
    this.show();
    if (this.playing) this.scheduleHide();
  }

  private show(): void {
    clearTimeout(this.hideTimer);
    this.hideTimer = 0;
    delete this.app.dataset.chrome;
  }

  private hide(): void {
    clearTimeout(this.hideTimer);
    this.hideTimer = 0;
    this.app.dataset.chrome = 'hidden';
    // A hidden button left focused would swallow Space, which walkControls then
    // leaves alone rather than toggling playback.
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused.closest(CHROME)) focused.blur();
  }

  private scheduleHide(): void {
    clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = 0;
      if (this.mode !== 'playback' || !this.playing) return;
      // Still in use: the scrubber held, or a mouse resting on a control.
      const hovered = matchMedia('(hover: hover)').matches && this.app.querySelector(`:is(${CHROME}):hover`);
      if (this.seeking || hovered) this.scheduleHide();
      else this.hide();
    }, HIDE_DELAY);
  }

  destroy(): void {
    this.abort.abort();
    this.show();
    this.setAimed(false);
    this.root.hidden = true;
    delete this.app.dataset.mode3d;
  }
}
