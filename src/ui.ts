import { basemapById, BASEMAPS } from './basemaps';
import { formatDistance, formatDuration } from './gpx';
import { countLabel, highlightName, setTristate } from './listUi';
import { matchesTokens, searchTokens, type Settings, type Trail } from './trails';

export type UiCallbacks = {
  onToggle: (id: string, visible: boolean) => void;
  /** `ids` is the rows currently on screen, which a filter may have narrowed. */
  onToggleAll: (visible: boolean, ids: string[]) => void;
  onZoomTo: (id: string) => void;
  /** null clears the selection. */
  onSelect: (id: string | null) => void;
  onBasemapChange: (id: string) => void;
  onFilterChange: () => void;
  /** The compass button. Only ever fires on iOS, which gates device
   *  orientation behind a grant that must come from a user gesture. */
  onCompass: () => void;
  /** The bottom-right locate button: recentre on, and then follow, the current
   *  position — or stop following if it already is. */
  onLocate: () => void;
  /** The top-right 3D button: open the 3D view, or close it. */
  onToggle3d: () => void;
  /** A trail row's ▶: play the trail at eye height in the 3D view. */
  onWalkTrail: (id: string) => void;
  /** The selection bar's profile button: open the elevation profile, or close it. */
  onToggleProfile: () => void;
};

/** What the locate button is currently saying: not following; following but
 *  still waiting on a first fix; following; or geolocation is a dead end. */
export type LocateState = 'off' | 'searching' | 'on' | 'blocked';

/** The 3D button: 2D showing; MapLibre downloading or starting; 3D showing; or
 *  no WebGL2, which 3D cannot run without. */
export type View3dState = 'off' | 'loading' | 'on' | 'unavailable';

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
  private readonly empty = el('trail-empty');
  private readonly count = el('trail-count');
  private readonly notices = el('notices');
  private readonly compass = el<HTMLButtonElement>('compass');
  private readonly locate = el<HTMLButtonElement>('locate');
  private readonly view3d = el<HTMLButtonElement>('view3d');
  private readonly selectionBar = el('selection-bar');
  private readonly selectionName = el('selection-name');
  private readonly selectionStats = el('selection-stats');
  private readonly selectionWalk = el<HTMLButtonElement>('selection-walk');
  private readonly selectionProfile = el<HTMLButtonElement>('selection-profile');

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

    this.compass.addEventListener('click', () => this.cb.onCompass());
    this.locate.addEventListener('click', () => this.cb.onLocate());
    this.view3d.addEventListener('click', () => this.cb.onToggle3d());
    this.selectionWalk.addEventListener('click', () => {
      if (this.lastSelectedId !== null) this.cb.onWalkTrail(this.lastSelectedId);
    });
    this.selectionProfile.addEventListener('click', () => this.cb.onToggleProfile());
    el('selection-clear').addEventListener('click', () => this.cb.onSelect(null));

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
    this.count.textContent = countLabel(matches.length, trails.length);

    // Derived here rather than tracked separately, so the master checkbox can
    // never drift from the rows it summarises.
    setTristate(this.toggleAll, matches.filter((t) => t.visible).length, matches.length);

    for (const trail of matches) {
      const li = document.createElement('li');
      if (trail.id === selectedId) {
        li.className = 'selected';
        li.setAttribute('aria-current', 'true');
      }
      // The whole row selects and zooms, so there is something to aim at besides
      // the name, and the name and the stats under it never answer the same click
      // differently. Guarded rather than scoped to a sub-element: the checkbox and
      // the ▶ button keep their own meaning.
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

      // Only there to match a row to its line; a click falls through to the row.
      const swatch = document.createElement('span');
      swatch.className = 'trail-swatch';
      swatch.style.background = trail.color;

      const text = document.createElement('div');
      text.className = 'grow';
      const name = document.createElement('div');
      name.className = 'trail-name';
      name.replaceChildren(highlightName(trail.name.normalize('NFC'), tokens));
      name.title = `${trail.name} — click to zoom`;
      name.dataset.trailId = trail.id;
      const stats = document.createElement('div');
      stats.className = 'trail-stats';
      stats.textContent = this.statsLine(trail);
      text.append(name, stats);

      // A button, so the row's own click handler above leaves it alone.
      const walk = document.createElement('button');
      walk.type = 'button';
      walk.className = 'trail-walk';
      walk.textContent = '▶';
      walk.title = 'Walk this trail in 3D';
      walk.setAttribute('aria-label', `Walk ${trail.name} in 3D`);
      walk.addEventListener('click', () => this.cb.onWalkTrail(trail.id));

      li.append(visible, swatch, text, walk);
      this.list.append(li);
    }

    this.panelBody.scrollTop = scroll;
    this.renderSelection(trails.find((t) => t.id === selectedId) ?? null);

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
   * The bar over the map that names the selected trail and plays it, so a trail
   * clicked on the map can be walked without opening the panel to find its row.
   * Found among every trail, not the filter's matches: the query narrows the
   * list, never the map.
   */
  private renderSelection(trail: Trail | null): void {
    this.selectionBar.hidden = !trail;
    if (!trail) {
      delete this.app.dataset.selection;
      return;
    }
    // Lets style.css lift the notices clear of the bar.
    this.app.dataset.selection = '';
    this.selectionName.textContent = trail.name.normalize('NFC');
    this.selectionName.title = trail.name;
    this.selectionStats.textContent = formatDistance(trail.stats.distance);
    this.selectionWalk.setAttribute('aria-label', `Walk ${trail.name} in 3D`);
  }

  /**
   * Whether the profile is showing: the button's pressed state, and data-profile
   * on #app, which lets style.css lift the notices and the scale bar clear of it.
   * main.ts owns the flag and calls this whenever the panel opens or closes.
   */
  setProfileShown(shown: boolean): void {
    this.selectionProfile.setAttribute('aria-pressed', String(shown));
    if (shown) this.app.dataset.profile = '';
    else delete this.app.dataset.profile;
  }

  /** The ids on screen, read back off the rows rather than cached alongside them. */
  private renderedIds(): string[] {
    return Array.from(this.list.querySelectorAll<HTMLElement>('.trail-name'))
      .map((node) => node.dataset.trailId ?? '')
      .filter(Boolean);
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

  /** Like the locate button, never disabled: 'unavailable' still answers a
   *  click with the reason. */
  set3dState(state: View3dState): void {
    this.view3d.dataset.state = state;
    this.view3d.setAttribute('aria-pressed', String(state === 'on'));
    this.view3d.title = state === 'on' ? 'Back to the 2D map' : '3D view';
  }

  /** On a phone the drawer covers the map, so an action that needs the map closes it. */
  closeDrawer(): void {
    if (window.matchMedia(DRAWER_QUERY).matches) this.setPanel(false);
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
