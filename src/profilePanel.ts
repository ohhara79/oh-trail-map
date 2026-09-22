/**
 * The selected trail's elevation over distance, with a cursor that picks one GPX
 * point and a readout of that point over the chart's top-left corner: its number,
 * lat/lon, elevation, and how far and how long into the trail it is. The national
 * points the trail passes sit on the line as small pins, and the readout names the
 * one the cursor is on, on a line of its own.
 *
 * It renders and reports, like pointsList.ts: main.ts owns which point the cursor
 * is on, hears about every move through onCursor, and hands the answer back with
 * setCursor — so the panel, the 2D dot and the 3D dot are set by one writer.
 */
import { haversine } from './gpx';
import { PIN_COLOR_NAMED, PIN_COLOR_UNNAMED } from './points';
import { formatElapsed, indexAtDistance, PASS_DISTANCE, type PointPass, type Profile } from './trailProfile';

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
/** A point's pin on the line: smaller than the cursor's dot (r 4), which it sits under. */
const PASS_RADIUS = 3.5;
const SVG_NS = 'http://www.w3.org/2000/svg';

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
  private readonly pointsGroup = this.svg.querySelector<SVGGElement>('.profile-points')!;
  private readonly cursorLine = this.svg.querySelector<SVGLineElement>('.profile-cursor-line')!;
  private readonly cursorDot = this.svg.querySelector<SVGCircleElement>('.profile-cursor-dot')!;
  private readonly eleMax = el<HTMLElement>('profile-ele-max');
  private readonly eleMin = el<HTMLElement>('profile-ele-min');
  private readonly total = el<HTMLElement>('profile-total');
  private readonly lines = [
    el<HTMLElement>('profile-line1'),
    el<HTMLElement>('profile-line2'),
    el<HTMLElement>('profile-line3'),
    el<HTMLElement>('profile-line4'),
  ];
  private readonly prev = el<HTMLButtonElement>('profile-prev');
  private readonly next = el<HTMLButtonElement>('profile-next');

  private profile: Profile | null = null;
  private cursor: number | null = null;
  private passes: readonly PointPass[] = [];
  /** The 지점번호 turned off in the National Points list: off the chart and unnamed. */
  private hiddenPoints: ReadonlySet<string> = new Set();
  /** The chart's size when it was last drawn, and the elevation range it maps. */
  private width = 0;
  private height = 0;
  private lo = 0;
  private hi = 1;
  /** The pointer pressed on the chart and dragging the cursor. */
  private dragging: number | null = null;
  /** Put away with its profile kept, so the cursor goes on following and the panel
   *  comes back on the same point. */
  private hiddenByUser = false;

  constructor(private readonly cb: ProfilePanelCallbacks) {
    // Drawn to the pixel, so a resize — the window, or the drawer on desktop taking
    // the map's width — draws it again rather than stretching it.
    new ResizeObserver(() => this.draw()).observe(this.chart);

    this.chart.addEventListener('pointerdown', (e) => {
      if (!this.profile || e.button !== 0) return;
      // A mouse too scrubs only while pressed: by hovering, it moved the location
      // whenever it merely passed over the panel. Captured, so the drag goes on
      // past the chart's edge.
      this.dragging = e.pointerId;
      this.chart.setPointerCapture(e.pointerId);
      this.scrubTo(e.clientX);
    });
    this.chart.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.dragging) this.scrubTo(e.clientX);
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

  /** Shows the panel for `profile`, read from `fileName`, with the national points
   *  it passes, or hides it for null. The same profile again keeps everything as it
   *  is. */
  show(profile: Profile | null, fileName = '', passes: readonly PointPass[] = []): void {
    if (profile === this.profile) return;
    this.profile = profile;
    this.passes = passes;
    this.cursor = null;
    this.root.hidden = !profile || this.hiddenByUser;
    if (!profile) return;
    const n = profile.s.length;
    // Not shown, to leave the readout room on a narrow phone; a screen reader still
    // hears which file the points come from.
    this.chart.setAttribute('aria-label', fileName ? `GPX point along ${fileName}` : 'GPX point along the trail');
    this.chart.setAttribute('aria-valuemax', String(n));
    this.draw();
    this.syncCursor();
  }

  /** Hides the panel without letting go of its profile or cursor. Coming back, the
   *  ResizeObserver sees the chart grow from nothing and draws it again. */
  setHidden(hidden: boolean): void {
    this.hiddenByUser = hidden;
    this.root.hidden = !this.profile || hidden;
  }

  setHiddenPoints(hidden: ReadonlySet<string>): void {
    this.hiddenPoints = hidden;
    this.drawPoints();
    this.syncCursor();
  }

  setCursor(index: number | null): void {
    if (index === this.cursor) return;
    this.cursor = index;
    this.syncCursor();
  }

  /** The cursor to where the pointer is along the chart. */
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
      this.drawPoints();
      this.syncCursor();
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
    this.drawPoints();
    this.syncCursor();
  }

  /** A pin on the line for each pass of a point that is on, coloured as its map pin.
   *  Without elevation it sits on the flat baseline the line is drawn as then. */
  private drawPoints(): void {
    const profile = this.profile;
    this.pointsGroup.replaceChildren();
    if (!profile || !this.width) return;
    const hasEle = Number.isFinite(profile.eleMin);
    for (const { index, point } of this.passes) {
      if (this.hiddenPoints.has(point.code)) continue;
      const ele = profile.ele[index];
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', this.x(profile.s[index]).toFixed(1));
      circle.setAttribute(
        'cy',
        (hasEle && !Number.isNaN(ele) ? this.y(ele) : this.height - PAD_BOTTOM).toFixed(1),
      );
      circle.setAttribute('r', String(PASS_RADIUS));
      circle.setAttribute('fill', point.name ? PIN_COLOR_NAMED : PIN_COLOR_UNNAMED);
      this.pointsGroup.append(circle);
    }
  }

  /** The point on, closest to GPX point `i` and within PASS_DISTANCE of it. */
  private pointAt(i: number): PointPass['point'] | null {
    const profile = this.profile;
    if (!profile) return null;
    const here = { lat: profile.lat[i], lon: profile.lon[i] };
    let found: PointPass['point'] | null = null;
    let nearest = PASS_DISTANCE;
    for (const { point } of this.passes) {
      if (this.hiddenPoints.has(point.code)) continue;
      const d = haversine(here, point);
      if (d < nearest) {
        nearest = d;
        found = point;
      }
    }
    return found;
  }

  /** The cursor on the chart, the readout, ◀ ▶ and the slider's value, from this.cursor. */
  private syncCursor(): void {
    const profile = this.profile;
    if (!profile) return;
    const n = profile.s.length;
    const i = this.cursor;
    this.lines[3].style.color = '';
    this.lines[3].classList.remove('profile-point-name');
    this.prev.disabled = i === null || i === 0;
    this.next.disabled = i === n - 1;
    this.cursorLine.style.display = this.cursorDot.style.display = i === null ? 'none' : '';

    if (i === null) {
      this.chart.setAttribute('aria-valuenow', '1');
      this.chart.setAttribute('aria-valuetext', 'No point picked');
      this.setLines(`${n.toLocaleString()} GPX points`, 'Drag along the profile,', 'or step with ◀ ▶', '');
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
    // On a national point, its name gets the fourth line, under the point number
    // and the distance rather than in their place.
    const point = this.pointAt(i);
    const pointName = point ? point.name || point.code : '';
    this.setLines(
      `${profile.lat[i].toFixed(6)}, ${profile.lon[i].toFixed(6)}`,
      `${Number.isNaN(ele) ? 'no elevation' : `${ele.toFixed(1)} m`} · ${elapsed}`,
      `#${(i + 1).toLocaleString()} / ${n.toLocaleString()} · ${formatAlong(profile.s[i])}`,
      pointName,
    );
    if (point) {
      this.lines[3].classList.add('profile-point-name');
      this.lines[3].style.color = point.name ? PIN_COLOR_NAMED : PIN_COLOR_UNNAMED;
    }
    this.chart.setAttribute('aria-valuenow', String(i + 1));
    this.chart.setAttribute('aria-valuetext', `Point ${i + 1} of ${n}${point ? `, at ${pointName}` : ''}`);
  }

  private setLines(...text: string[]): void {
    text.forEach((t, k) => {
      this.lines[k].textContent = t;
      // The full text for a line a narrow screen cuts short.
      this.lines[k].title = t;
    });
  }
}
