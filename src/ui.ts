import { BASEMAPS } from './basemaps';
import { formatDistance, formatDuration } from './gpx';
import type { ExportFormat, ExportPlan } from './export';
import { matchesTokens, searchTokens, type Settings, type Trail } from './trails';

export type UiCallbacks = {
  onImport: (files: File[]) => void;
  onToggle: (id: string, visible: boolean) => void;
  /** `ids` is the rows currently on screen, which a filter may have narrowed. */
  onToggleAll: (visible: boolean, ids: string[]) => void;
  onTrailColor: (id: string, color: string) => void;
  onRemove: (id: string) => void;
  onZoomTo: (id: string) => void;
  /** null clears the selection. */
  onSelect: (id: string | null) => void;
  onUniformChange: (enabled: boolean, color: string) => void;
  onTrailWidthChange: (weight: number) => void;
  onBasemapChange: (id: string) => void;
  onExport: (format: ExportFormat, scale: number) => void;
  onExportOptionChange: () => void;
  onFilterChange: () => void;
  /** The compass button. Only ever fires on iOS, which gates device
   *  orientation behind a grant that must come from a user gesture. */
  onCompass: () => void;
};

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
  private readonly uniformToggle = el<HTMLInputElement>('uniform-toggle');
  private readonly uniformColor = el<HTMLInputElement>('uniform-color');
  private readonly trailWidth = el<HTMLInputElement>('trail-width');
  private readonly trailWidthValue = el<HTMLOutputElement>('trail-width-value');
  private readonly formatSelect = el<HTMLSelectElement>('export-format');
  private readonly scaleSelect = el<HTMLSelectElement>('export-scale');
  private readonly estimate = el('export-estimate');
  private readonly exportButton = el<HTMLButtonElement>('export-button');
  private readonly progress = el('export-progress');
  private readonly progressBar = el('export-progress').firstElementChild as HTMLElement;
  private readonly notices = el('notices');
  private readonly dropOverlay = el('drop-overlay');
  private readonly compass = el<HTMLButtonElement>('compass');

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
    const fileInput = el<HTMLInputElement>('file-input');
    fileInput.addEventListener('change', () => {
      if (fileInput.files?.length) this.cb.onImport(Array.from(fileInput.files));
      // Reset so re-picking the same file still fires a change event.
      fileInput.value = '';
    });

    // Scoped to the rendered rows, not every trail: with a filter active the
    // master checkbox summarises what is on screen, so it must act on that too.
    this.toggleAll.addEventListener('change', () =>
      this.cb.onToggleAll(this.toggleAll.checked, this.renderedIds()),
    );

    this.search.addEventListener('input', () => this.cb.onFilterChange());

    this.expandAll.addEventListener('click', () =>
      this.setAllNamesExpanded(this.expandedNames.size < this.list.children.length),
    );

    this.uniformToggle.addEventListener('change', () => this.emitUniform());
    this.uniformColor.addEventListener('input', () => this.emitUniform());

    this.trailWidth.addEventListener('input', () => {
      const weight = Number(this.trailWidth.value);
      this.trailWidthValue.textContent = `${weight} px`;
      this.cb.onTrailWidthChange(weight);
    });

    this.formatSelect.addEventListener('change', () => this.cb.onExportOptionChange());
    this.scaleSelect.addEventListener('change', () => this.cb.onExportOptionChange());
    this.exportButton.addEventListener('click', () => {
      this.cb.onExport(this.formatSelect.value as ExportFormat, Number(this.scaleSelect.value));
    });

    this.compass.addEventListener('click', () => this.cb.onCompass());

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

    this.bindDropZone();
  }

  /**
   * The single source of truth for panel visibility. CSS reads it to pick
   * between hiding the column (desktop) and sliding the drawer (small
   * screens); `hidden` could not do both, since display:none has no transition.
   */
  private setPanel(open: boolean): void {
    this.app.dataset.panel = open ? 'open' : 'closed';
  }

  private bindDropZone(): void {
    let depth = 0;
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files');

    window.addEventListener('dragenter', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      // Counter, not a boolean: dragenter fires again for every child element.
      if (++depth === 1) this.dropOverlay.hidden = false;
    });
    window.addEventListener('dragover', (e) => {
      if (hasFiles(e)) e.preventDefault();
    });
    window.addEventListener('dragleave', () => {
      if (--depth <= 0) {
        depth = 0;
        this.dropOverlay.hidden = true;
      }
    });
    window.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      this.dropOverlay.hidden = true;
      const files = Array.from(e.dataTransfer?.files ?? []).filter((f) =>
        f.name.toLowerCase().endsWith('.gpx'),
      );
      if (files.length) this.cb.onImport(files);
      else this.notify('Only .gpx files can be imported.', 'error');
    });
  }

  private emitUniform(): void {
    this.cb.onUniformChange(this.uniformToggle.checked, this.uniformColor.value);
  }

  applySettings(settings: Settings): void {
    this.uniformToggle.checked = settings.uniformColor;
    this.uniformColor.value = settings.uniformColorValue;
    this.trailWidth.value = String(settings.trailWeight);
    this.trailWidthValue.textContent = `${settings.trailWeight} px`;
    const radio = document.querySelector<HTMLInputElement>(
      `input[name="basemap"][value="${settings.basemapId}"]`,
    );
    if (radio) radio.checked = true;
  }

  renderTrails(trails: Trail[], settings: Settings, selectedId: string | null): void {
    // .panel-body is the panel's only scroller and this rebuild empties the list
    // inside it, so without carrying the offset across, every toggle, recolor or
    // removal snaps the panel back to the top. A now-out-of-range value is
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
    // the map, and so in the export.
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
        ? 'No trails imported yet.'
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
      // checkbox, colour swatch and remove button keep their own meaning.
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
      // Uniform mode overrides the per-trail colour, so editing it here would
      // change nothing visible — disable rather than mislead.
      color.disabled = settings.uniformColor;
      color.title = settings.uniformColor
        ? 'Turn off uniform color to edit'
        : 'Trail color';
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

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'trail-remove';
      remove.textContent = '×';
      remove.title = 'Remove trail';
      remove.addEventListener('click', () => this.cb.onRemove(trail.id));

      li.append(visible, color, text, remove);
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

  exportSelection(): { format: ExportFormat; scale: number } {
    return {
      format: this.formatSelect.value as ExportFormat,
      scale: Number(this.scaleSelect.value),
    };
  }

  showEstimate(plan: ExportPlan, requestedScale: number): void {
    if (plan.problem) {
      this.estimate.textContent = plan.problem;
      this.estimate.style.color = '#a4262c';
      this.exportButton.disabled = true;
      return;
    }
    this.estimate.style.color = '';
    this.exportButton.disabled = false;
    const size = `${plan.width} × ${plan.height} px, ${plan.tileCount} tiles`;
    this.estimate.textContent = plan.clamped
      ? `${size} — this basemap tops out at zoom ${plan.tileZoom}, so ${requestedScale}× becomes ${plan.achievedScale}×.`
      : size;
  }

  setExporting(active: boolean): void {
    // When switching off, the caller re-runs showEstimate to settle the
    // disabled state — an unexportable view must stay disabled.
    this.exportButton.disabled = active;
    this.exportButton.textContent = active ? 'Exporting…' : 'Export';
    this.progress.hidden = !active;
    if (!active) this.progressBar.style.width = '0';
  }

  setProgress(done: number, total: number): void {
    this.progressBar.style.width = total > 0 ? `${(done / total) * 100}%` : '0';
  }

  /** Shown only where the compass needs an explicit grant, and hidden again the
   *  moment one is given — there is nothing left to ask for. */
  setCompassButton(show: boolean): void {
    this.compass.hidden = !show;
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
