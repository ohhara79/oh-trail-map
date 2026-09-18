/**
 * The selected trail's elevation over distance, with a cursor that picks one GPX
 * point and a readout of that point: its number, lat/lon, elevation, and how far
 * and how long into the trail it is. A corner of the chart names the .gpx file
 * the points come from.
 *
 * It renders and reports, like pointsList.ts: main.ts owns which point the cursor
 * is on, hears about every move through onCursor, and hands the answer back with
 * setCursor — so the panel, the 2D dot and the 3D dot are set by one writer.
 */
import { formatElapsed, indexAtDistance, type Profile } from './trailProfile';

export type ProfilePanelCallbacks = {
  /** The cursor was moved to point `index` — by the chart, a key or ◀ ▶. */
  onCursor: (index: number) => void;
};

/** Space kept above and below the line inside the chart, in CSS pixels. */
const PAD_TOP = 16;
const PAD_BOTTOM = 4;
/** The least elevation range the chart spans. Scaled to the trail's own range, a
 *  flat riverside walk would draw 3 m of barometer noise as a mountain range. */
const MIN_ELE_SPAN = 30;

function el<T extends Element>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as unknown as T;
}

function formatAlong(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(2)} km` : `${Math.round(metres)} m`;
}

export class ProfilePanel {
  private readonly root = el<HTMLElement>('profile');
  private readonly chart = el<HTMLElement>('profile-chart');
  private readonly svg = el<SVGSVGElement>('profile-svg');
  private readonly area = this.svg.querySelector<SVGPathElement>('.profile-area')!;
  private readonly line = this.svg.querySelector<SVGPathElement>('.profile-line')!;
  private readonly cursorLine = this.svg.querySelector<SVGLineElement>('.profile-cursor-line')!;
  private readonly cursorDot = this.svg.querySelector<SVGCircleElement>('.profile-cursor-dot')!;
  private readonly eleMax = el<HTMLElement>('profile-ele-max');
  private readonly eleMin = el<HTMLElement>('profile-ele-min');
  private readonly total = el<HTMLElement>('profile-total');
  private readonly file = el<HTMLElement>('profile-file');
  private readonly lines = [el<HTMLElement>('profile-line1'), el<HTMLElement>('profile-line2'), el<HTMLElement>('profile-line3')];
  private readonly prev = el<HTMLButtonElement>('profile-prev');
  private readonly next = el<HTMLButtonElement>('profile-next');

  private profile: Profile | null = null;
  private cursor: number | null = null;
  /** The chart's size when it was last drawn, and the elevation range it maps. */
  private width = 0;
  private height = 0;
  private lo = 0;
  private hi = 1;
  /** The pointer dragging the cursor, for touch and pen, which have no hover. */
  private dragging: number | null = null;

  constructor(private readonly cb: ProfilePanelCallbacks) {
    // Drawn to the pixel, so a resize — the window, or the drawer on desktop taking
    // the map's width — draws it again rather than stretching it.
    new ResizeObserver(() => this.draw()).observe(this.chart);

    this.chart.addEventListener('pointerdown', (e) => {
      if (!this.profile || e.button !== 0) return;
      // A mouse scrubs by hovering; pressing just focuses the chart for the keys.
      if (e.pointerType !== 'mouse') {
        this.dragging = e.pointerId;
        this.chart.setPointerCapture(e.pointerId);
      }
      this.scrubTo(e.clientX);
    });
    this.chart.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' || e.pointerId === this.dragging) this.scrubTo(e.clientX);
    });
    const release = (e: PointerEvent): void => {
      if (e.pointerId === this.dragging) this.dragging = null;
    };
    this.chart.addEventListener('pointerup', release);
    this.chart.addEventListener('pointercancel', release);

    this.chart.addEventListener('keydown', (e) => {
      const step =
        e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1
        : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1
        : e.key === 'PageDown' ? -100
        : e.key === 'PageUp' ? 100
        : e.key === 'Home' ? -Infinity
        : e.key === 'End' ? Infinity
        : 0;
      if (!step) return;
      this.step(e.shiftKey && Number.isFinite(step) ? step * 10 : step);
      e.preventDefault();
      // Walking listens for the arrows on window, and would walk you off while you
      // step through the points.
      e.stopPropagation();
    });

    this.prev.addEventListener('click', () => this.step(-1));
    this.next.addEventListener('click', () => this.step(1));
  }

  /** Shows the panel for `profile`, read from `fileName`, or hides it for null. The
   *  same profile again keeps everything as it is. */
  show(profile: Profile | null, fileName = ''): void {
    if (profile === this.profile) return;
    this.profile = profile;
    this.cursor = null;
    this.root.hidden = !profile;
    if (!profile) return;
    const n = profile.s.length;
    this.file.textContent = fileName;
    this.file.title = fileName;
    // The label takes no pointer, so a screen reader and a cut-short name both need
    // the full name here.
    this.chart.setAttribute('aria-label', fileName ? `GPX point along ${fileName}` : 'GPX point along the trail');
    this.chart.setAttribute('aria-valuemax', String(n));
    this.draw();
    this.syncCursor();
  }

  setCursor(index: number | null): void {
    if (index === this.cursor) return;
    this.cursor = index;
    this.syncCursor();
  }

  private scrubTo(clientX: number): void {
    const profile = this.profile;
    if (!profile) return;
    const rect = this.chart.getBoundingClientRect();
    const t = rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0;
    const index = indexAtDistance(profile, t * profile.total);
    if (index !== this.cursor) this.cb.onCursor(index);
  }

  /** Moves the cursor by `delta` points; from no cursor, onto the first point. */
  private step(delta: number): void {
    const profile = this.profile;
    if (!profile) return;
    const last = profile.s.length - 1;
    const index = this.cursor === null ? 0 : Math.min(last, Math.max(0, this.cursor + delta));
    if (index !== this.cursor) this.cb.onCursor(index);
  }

  private x(s: number): number {
    const total = this.profile?.total ?? 0;
    return total > 0 ? (s / total) * this.width : 0;
  }

  private y(ele: number): number {
    const t = (ele - this.lo) / (this.hi - this.lo);
    return PAD_TOP + (1 - t) * (this.height - PAD_TOP - PAD_BOTTOM);
  }

  /**
   * The line and the area under it. Some 3000 points across a few hundred pixels
   * would be ten vertices a pixel, so each pixel column keeps only its lowest and
   * highest point, in the order they come: the outline is the same, and a spike a
   * single fix wide still shows.
   */
  private draw(): void {
    const profile = this.profile;
    if (!profile) return;
    this.width = this.chart.clientWidth;
    this.height = this.chart.clientHeight;
    this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    this.total.textContent = formatAlong(profile.total);

    const hasEle = Number.isFinite(profile.eleMin);
    this.eleMax.textContent = hasEle ? `${Math.round(profile.eleMax)} m` : 'No elevation';
    this.eleMin.textContent = hasEle ? `${Math.round(profile.eleMin)} m` : '';
    if (!hasEle) {
      this.lo = 0;
      this.hi = 1;
      const base = `M0 ${this.height - PAD_BOTTOM} H${this.width}`;
      this.line.setAttribute('d', base);
      this.area.setAttribute('d', '');
      return;
    }
    const mid = (profile.eleMin + profile.eleMax) / 2;
    const half = Math.max(MIN_ELE_SPAN, profile.eleMax - profile.eleMin) / 2;
    this.lo = mid - half;
    this.hi = mid + half;

    const xs: number[] = [];
    const ys: number[] = [];
    const n = profile.s.length;
    let column = -1;
    let minI = -1;
    let maxI = -1;
    const flush = (): void => {
      if (minI < 0) return;
      for (const i of minI === maxI ? [minI] : minI < maxI ? [minI, maxI] : [maxI, minI]) {
        xs.push(this.x(profile.s[i]));
        ys.push(this.y(profile.ele[i]));
      }
    };
    for (let i = 0; i < n; i++) {
      const ele = profile.ele[i];
      if (Number.isNaN(ele)) continue;
      const c = Math.floor(this.x(profile.s[i]));
      if (c !== column) {
        flush();
        column = c;
        minI = maxI = i;
      } else {
        if (ele < profile.ele[minI]) minI = i;
        if (ele > profile.ele[maxI]) maxI = i;
      }
    }
    flush();

    let d = '';
    for (let i = 0; i < xs.length; i++) d += `${i ? 'L' : 'M'}${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`;
    this.line.setAttribute('d', d);
    this.area.setAttribute(
      'd',
      xs.length ? `${d}L${xs[xs.length - 1].toFixed(1)} ${this.height}L${xs[0].toFixed(1)} ${this.height}Z` : '',
    );
    this.syncCursor();
  }

  /** The cursor on the chart, the readout, ◀ ▶ and the slider's value, from this.cursor. */
  private syncCursor(): void {
    const profile = this.profile;
    if (!profile) return;
    const n = profile.s.length;
    const i = this.cursor;
    this.prev.disabled = i === null || i === 0;
    this.next.disabled = i === n - 1;
    this.cursorLine.style.display = this.cursorDot.style.display = i === null ? 'none' : '';

    if (i === null) {
      this.chart.setAttribute('aria-valuenow', '1');
      this.chart.setAttribute('aria-valuetext', 'No point picked');
      this.setLines(`${n.toLocaleString()} GPX points`, 'Point at the profile,', 'or step with ◀ ▶');
      return;
    }

    const x = this.x(profile.s[i]);
    this.cursorLine.setAttribute('x1', String(x));
    this.cursorLine.setAttribute('x2', String(x));
    this.cursorLine.setAttribute('y1', '0');
    this.cursorLine.setAttribute('y2', String(this.height));
    const ele = profile.ele[i];
    if (Number.isNaN(ele) || !Number.isFinite(profile.eleMin)) {
      this.cursorDot.style.display = 'none';
    } else {
      this.cursorDot.setAttribute('cx', String(x));
      this.cursorDot.setAttribute('cy', String(this.y(ele)));
    }

    const time = profile.time[i];
    // Only the time since the start, not the clock time: a date and a clock beside
    // the elevation was more than a narrow phone's line could hold.
    const elapsed =
      Number.isNaN(time) || Number.isNaN(profile.startTime)
        ? 'no time'
        : `+${formatElapsed((time - profile.startTime) / 1000)}`;
    this.setLines(
      `${profile.lat[i].toFixed(6)}, ${profile.lon[i].toFixed(6)}`,
      `${Number.isNaN(ele) ? 'no elevation' : `${ele.toFixed(1)} m`} · ${elapsed}`,
      `#${(i + 1).toLocaleString()} / ${n.toLocaleString()} · ${formatAlong(profile.s[i])}`,
    );
    this.chart.setAttribute('aria-valuenow', String(i + 1));
    this.chart.setAttribute('aria-valuetext', `Point ${i + 1} of ${n}`);
  }

  private setLines(...text: string[]): void {
    text.forEach((t, k) => {
      this.lines[k].textContent = t;
      // The full text for a line a narrow screen cuts short.
      this.lines[k].title = t;
    });
  }
}
