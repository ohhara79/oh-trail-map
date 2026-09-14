/**
 * The 3D view's on-screen controls. The markup is static in index.html; this
 * binds it and writes state back into it. Which parts show in which mode is
 * decided in style.css from data-mode3d on #app, so there is one place a mode's
 * layout lives.
 */
import { formatDistance } from './gpx';

export type Mode3d = 'orbit' | 'walk' | 'playback';

export type HudCallbacks = {
  onMode: (mode: 'orbit' | 'walk') => void;
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

export class Hud {
  private readonly app = el('app');
  private readonly root = el('hud3d');
  readonly joystick = el('joystick');
  private readonly modeButtons = Array.from(
    el('mode3d').querySelectorAll<HTMLButtonElement>('button[data-mode]'),
  );
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

  constructor(cb: HudCallbacks) {
    const signal = this.abort.signal;
    for (const button of this.modeButtons) {
      button.addEventListener('click', () => cb.onMode(button.dataset.mode as 'orbit' | 'walk'), { signal });
    }
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
    this.root.hidden = false;
  }

  setMode(mode: Mode3d): void {
    this.app.dataset.mode3d = mode;
    for (const button of this.modeButtons) {
      const on = button.dataset.mode === mode || (mode === 'playback' && button.dataset.mode === 'walk');
      button.setAttribute('aria-pressed', String(on));
    }
  }

  setEye(metres: number): void {
    this.eye.textContent = metres < 10 ? `${metres} m` : `${Math.round(metres)} m`;
  }

  setGyro(on: boolean): void {
    this.gyro.setAttribute('aria-pressed', String(on));
  }

  setPlayback(state: PlaybackState): void {
    this.play.textContent = state.playing ? '❚❚' : '▶';
    this.play.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
    this.speed.textContent = `${state.speed}×`;
    this.title.textContent = state.name;
    this.label.textContent = `${formatDistance(state.s)} / ${formatDistance(state.total)}`;
    if (!this.seeking) {
      this.scrub.value = String(state.total > 0 ? Math.round((state.s / state.total) * SCRUB_STEPS) : 0);
    }
  }

  destroy(): void {
    this.abort.abort();
    this.root.hidden = true;
    delete this.app.dataset.mode3d;
  }
}
