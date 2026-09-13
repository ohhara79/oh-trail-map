import { basemapById, BASEMAPS } from './basemaps';
import { formatDistance, formatDuration } from './gpx';
import { matchesTokens, searchTokens, type Settings, type Trail } from './trails';

export type UiCallbacks = {
  onToggle: (id: string, visible: boolean) => void;
  /** `ids` is the rows currently on screen, which a filter may have narrowed. */
  onToggleAll: (visible: boolean, ids: string[]) => void;
  onTrailColor: (id: string, color: string) => void;
  onZoomTo: (id: string) => void;
  /** null clears the selection. */
  onSelect: (id: string | null) => void;
  onBasemapChange: (id: string) => void;
  /** The National Point Number layer's on/off checkbox. */
  onPointsChange: (show: boolean) => void;
  onFilterChange: () => void;
  /** The compass button. Only ever fires on iOS, which gates device
   *  orientation behind a grant that must come from a user gesture. */
  onCompass: () => void;
  /** The bottom-right locate button: recentre on, and then follow, the current
   *  position — or stop following if it already is. */
  onLocate: () => void;
};

/** What the locate button is currently saying: not following; following but
 *  still waiting on a first fix; following; or geolocation is a dead end. */
export type LocateState = 'off' | 'searching' | 'on' | 'blocked';

/** Must match the drawer media query in style.css. */
const DRAWER_QUERY = '(max-width: 720px), (max-height: 480px)';

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

export class Ui {
  private readonly app = el('app');
  private readonly panelBody = el('panel-body');
  private readonly list = el<HTMLUListElement>('trail-list');
  private readonly search = el<HTMLInputElement>('trail-search');
  private readonly toggleAll = el<HTMLInputElement>('trail-all');
  private readonly expandAll = el<HTMLButtonElement>('trail-expand-all');
  private readonly empty = el('trail-empty');
  private readonly count = el('trail-count');
  private readonly pointsToggle = el<HTMLInputElement>('points-toggle');
  private readonly notices = el('notices');
  private readonly compass = el<HTMLButtonElement>('compass');
  private readonly locate = el<HTMLButtonElement>('locate');

  /** Trail ids whose name is shown in full rather than clipped to one line.
   *  renderTrails() rebuilds every row, so this cannot live on the elements. */
  private readonly expandedNames = new Set<string>();

  /** Last rendered selection, so a row is only scrolled into view when the
   *  selection actually changed — not on every unrelated re-render. */
  private lastSelectedId: string | null = null;

  constructor(private readonly cb: UiCallbacks) {
    this.buildBasemapOptions();
    this.bind();
  }

  private buildBasemapOptions(): void {
    const container = el('basemap-options');
    for (const basemap of BASEMAPS) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'basemap';
      input.value = basemap.id;
      input.addEventListener('change', () => this.cb.onBasemapChange(basemap.id));
      label.append(input, document.createTextNode(basemap.label));
      container.append(label);
    }
  }

  private bind(): void {
    // Scoped to the rendered rows, not every trail: with a filter active the
    // master checkbox summarises what is on screen, so it must act on that too.
    this.toggleAll.addEventListener('change', () =>
      this.cb.onToggleAll(this.toggleAll.checked, this.renderedIds()),
    );

    this.search.addEventListener('input', () => this.cb.onFilterChange());

    this.expandAll.addEventListener('click', () =>
      this.setAllNamesExpanded(this.expandedNames.size < this.list.children.length),
    );

    this.pointsToggle.addEventListener('change', () =>
      this.cb.onPointsChange(this.pointsToggle.checked),
    );

    this.compass.addEventListener('click', () => this.cb.onCompass());
    this.locate.addEventListener('click', () => this.cb.onLocate());

    el('collapse').addEventListener('click', () => this.setPanel(false));
    el('expand').addEventListener('click', () => this.setPanel(true));
    el('backdrop').addEventListener('click', () => this.setPanel(false));
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      // Escape belongs to the filter while it holds text, or typing a query and
      // reaching for the usual way to dismiss it would slam the drawer shut. A
      // second press falls through and closes the panel as before.
      if (document.activeElement === this.search && this.search.value !== '') {
        this.search.value = '';
        this.cb.onFilterChange();
        return;
      }
      // Then the selection, and only then the panel: Escape undoes the most
      // local thing first, so dismissing a highlight never costs you the drawer.
      if (this.lastSelectedId !== null) {
        this.cb.onSelect(null);
        return;
      }
      this.setPanel(false);
    });

    // On a phone the map is the point, so start with it unobstructed. Not
    // persisted: Settings describes how trails render, and panel state is
    // per-device chrome rather than a rendering choice.
    this.setPanel(!window.matchMedia(DRAWER_QUERY).matches);
  }

  /**
   * The single source of truth for panel visibility. CSS reads it to pick
   * between hiding the column (desktop) and sliding the drawer (small
   * screens); `hidden` could not do both, since display:none has no transition.
   */
  private setPanel(open: boolean): void {
    this.app.dataset.panel = open ? 'open' : 'closed';
  }

  applySettings(settings: Settings): void {
    this.pointsToggle.checked = settings.showPoints;
    // Resolved rather than read raw: a saved id whose basemap has since been
    // removed must check the radio for the fallback the map actually loaded.
    const radio = document.querySelector<HTMLInputElement>(
      `input[name="basemap"][value="${basemapById(settings.basemapId).id}"]`,
    );
    if (radio) radio.checked = true;
  }

  renderTrails(trails: Trail[], selectedId: string | null): void {
    // .panel-body is the panel's only scroller and this rebuild empties the list
    // inside it, so without carrying the offset across, every toggle or recolor
    // snaps the panel back to the top. A now-out-of-range value is
    // clamped by the browser, which is the right answer for a shorter list.
    const scroll = this.panelBody.scrollTop;
    this.list.replaceChildren();

    // Expanded names outlive a rebuild, but not the trail itself. Pruned
    // against every trail rather than the matches: a name expanded and then
    // filtered out must still be expanded once the query is cleared.
    const ids = new Set(trails.map((t) => t.id));
    for (const id of this.expandedNames) if (!ids.has(id)) this.expandedNames.delete(id);

    // The query lives in the input and nowhere else, so a render never needs to
    // be told about it. The filter narrows the list only — every trail stays on
    // the map.
    const tokens = searchTokens(this.search.value);
    const matches = tokens.length
      ? trails.filter((t) => matchesTokens(t.name, tokens))
      : trails;

    // Hidden on the total, never on the match count: a filter that excludes
    // everything must not take its own escape hatch with it.
    this.search.hidden = trails.length === 0;

    this.empty.hidden = matches.length > 0;
    this.empty.textContent =
      trails.length === 0
        ? 'No GPX files in data/gpx.'
        : `No trail matches “${this.search.value.trim()}”.`;
    this.count.textContent = !trails.length
      ? ''
      : matches.length === trails.length
        ? `(${trails.length})`
        : `(${matches.length} of ${trails.length})`;

    // Derived here rather than tracked separately, so the master checkbox can
    // never drift from the rows it summarises. `indeterminate` is a property,
    // not an attribute: it must be cleared explicitly, since setting `checked`
    // does not clear it.
    const shown = matches.filter((t) => t.visible).length;
    this.toggleAll.hidden = matches.length === 0;
    this.toggleAll.checked = matches.length > 0 && shown === matches.length;
    this.toggleAll.indeterminate = shown > 0 && shown < matches.length;

    for (const trail of matches) {
      const li = document.createElement('li');
      if (trail.id === selectedId) {
        li.className = 'selected';
        li.setAttribute('aria-current', 'true');
      }
      // The whole row selects and zooms, so there is something to aim at besides
      // the name — a name click reaches this through bubbling, which keeps the
      // zoom in one place. Guarded rather than scoped to a sub-element: the
      // checkbox and colour swatch keep their own meaning.
      li.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('input, button')) return;
        this.cb.onSelect(trail.id);
        this.cb.onZoomTo(trail.id);
      });

      const visible = document.createElement('input');
      visible.type = 'checkbox';
      visible.checked = trail.visible;
      visible.title = 'Show on map';
      visible.addEventListener('change', () =>
        this.cb.onToggle(trail.id, visible.checked),
      );

      const color = document.createElement('input');
      color.type = 'color';
      color.value = trail.color;
      color.title = 'Trail color';
      color.addEventListener('input', () => this.cb.onTrailColor(trail.id, color.value));

      const text = document.createElement('div');
      text.className = 'grow';
      const name = document.createElement('div');
      name.className = 'trail-name';
      name.replaceChildren(highlightName(trail.name.normalize('NFC'), tokens));
      name.title = `${trail.name} — click to zoom and show the full name`;
      name.style.cursor = 'pointer';
      name.dataset.trailId = trail.id;
      name.classList.toggle('expanded', this.expandedNames.has(trail.id));
      name.addEventListener('click', () => {
        // Toggled unconditionally rather than only when the text overflows:
        // unclamping a name that already fits changes nothing on screen, and
        // measuring scrollWidth here would force a layout on every click.
        const open = !this.expandedNames.has(trail.id);
        if (open) this.expandedNames.add(trail.id);
        else this.expandedNames.delete(trail.id);
        name.classList.toggle('expanded', open);
        this.syncExpandAll();
        // Selecting and zooming is the row's job; the click bubbles to it.
      });
      const stats = document.createElement('div');
      stats.className = 'trail-stats';
      stats.textContent = this.statsLine(trail);
      text.append(name, stats);

      li.append(visible, color, text);
      this.list.append(li);
    }

    this.syncExpandAll();
    this.panelBody.scrollTop = scroll;

    // After the scroll restore above, never before, or the two fight. A row
    // already on screen is left alone by block: 'nearest'; a selection whose
    // trail the filter is hiding simply has no row, which needs no special case.
    const changed = selectedId !== this.lastSelectedId;
    this.lastSelectedId = selectedId;
    if (changed && selectedId) {
      this.list
        .querySelector(`.trail-name[data-trail-id="${CSS.escape(selectedId)}"]`)
        ?.closest('li')
        ?.scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * Label and visibility are derived from the rows, like the master checkbox
   * above: a partly expanded list offers "Expand all" and finishes the job.
   */
  private syncExpandAll(): void {
    const total = this.list.children.length;
    this.expandAll.hidden = total === 0;
    this.expandAll.textContent =
      total > 0 && this.expandedNames.size >= total ? 'Collapse all' : 'Expand all';
  }

  /** The ids on screen, read back off the rows rather than cached alongside them. */
  private renderedIds(): string[] {
    return Array.from(this.list.querySelectorAll<HTMLElement>('.trail-name'))
      .map((node) => node.dataset.trailId ?? '')
      .filter(Boolean);
  }

  /** Walks the rendered rows instead of re-rendering, so the panel does not scroll. */
  private setAllNamesExpanded(open: boolean): void {
    this.expandedNames.clear();
    for (const node of this.list.querySelectorAll<HTMLElement>('.trail-name')) {
      const id = node.dataset.trailId;
      if (!id) continue;
      if (open) this.expandedNames.add(id);
      node.classList.toggle('expanded', open);
    }
    this.syncExpandAll();
  }

  private statsLine(trail: Trail): string {
    const parts = [formatDistance(trail.stats.distance)];
    if (trail.stats.ascent >= 1) parts.push(`↑ ${Math.round(trail.stats.ascent)} m`);
    if (trail.stats.duration) parts.push(formatDuration(trail.stats.duration));
    parts.push(`${trail.stats.points} pts`);
    return parts.join('  ·  ');
  }

  /** Shown only where the compass needs an explicit grant, and hidden again the
   *  moment one is given — there is nothing left to ask for. */
  setCompassButton(show: boolean): void {
    this.compass.hidden = !show;
  }

  /** The button is never hidden or disabled: even in 'blocked' a click still
   *  answers, by re-raising the notice that says why. */
  setLocateState(state: LocateState): void {
    this.locate.dataset.state = state;
    this.locate.setAttribute('aria-pressed', String(state === 'on' || state === 'searching'));
  }

  notify(message: string, kind: 'info' | 'error' = 'info', timeout = 7000): void {
    const notice = document.createElement('div');
    notice.className = kind === 'error' ? 'notice error' : 'notice';
    const text = document.createElement('span');
    text.textContent = message;
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.addEventListener('click', () => notice.remove());
    notice.append(text, close);
    this.notices.append(notice);
    if (timeout > 0) setTimeout(() => notice.remove(), timeout);
  }
}

/**
 * Renders `display` with every query token wrapped in <mark>.
 *
 * Indices come from the lowercased copy, so it bails out in the rare case
 * lowercasing changes length (ẞ, İ) rather than slicing at shifted offsets.
 * NFC normalisation — the other half of the fold — is applied by the caller, so
 * what is measured here is exactly what is drawn.
 */
function highlightName(display: string, tokens: string[]): Node {
  const hay = display.toLowerCase();
  if (!tokens.length || hay.length !== display.length) {
    return document.createTextNode(display);
  }

  const ranges: Array<[number, number]> = [];
  for (const token of tokens) {
    for (let i = hay.indexOf(token); i >= 0; i = hay.indexOf(token, i + token.length)) {
      ranges.push([i, i + token.length]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);

  // Tokens that overlap or merely touch collapse into one range: emitting two
  // adjacent <mark>s instead would draw a seam through contiguous text.
  const merged: Array<[number, number]> = [];
  for (const [start, end] of ranges) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  const frag = document.createDocumentFragment();
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) frag.append(display.slice(cursor, start));
    const mark = document.createElement('mark');
    mark.textContent = display.slice(start, end);
    frag.append(mark);
    cursor = end;
  }
  if (cursor < display.length) frag.append(display.slice(cursor));
  return frag;
}
