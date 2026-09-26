/**
 * The National Points block in the control panel: one checkbox per 지점번호, a
 * filter over every column of the TSV, and a master checkbox scoped to whatever
 * the filter left on screen.
 *
 * Its own module rather than a second half of ui.ts, which already owns the
 * drawer, the basemap radios, the notices and three floating buttons. What the
 * two lists must agree on lives in listUi.ts; everything here is the part that is
 * only true of points — 272 rows instead of 36, which is why render() refuses to
 * rebuild the list to change one checkbox, and a five-column haystack, which is
 * why a match is marked on both of a row's lines.
 *
 * It renders and reports; it owns neither the visibility nor the selection.
 * main.ts holds the hidden set and the selected 지점번호 and hands both back on
 * every render, so a row can never disagree with the pin it stands for.
 */
import { highlightName, countLabel, setTristate } from './listUi';
import type { PointRow } from './points';
import { matchesFolded, searchTokens } from './trails';

export type PointsListCallbacks = {
  onToggle: (id: string, visible: boolean) => void;
  /** `ids` is the rows currently on screen, which a filter may have narrowed. */
  onToggleAll: (visible: boolean, ids: string[]) => void;
  onFilterChange: () => void;
  /** A row click off its checkbox: go to the point and open its popup. */
  onSelect: (id: string) => void;
};

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

export class PointsList {
  private readonly panelBody = el('panel-body');
  private readonly list = el<HTMLUListElement>('point-list');
  private readonly search = el<HTMLInputElement>('point-search');
  private readonly toggleAll = el<HTMLInputElement>('point-all');
  private readonly empty = el('point-empty');
  private readonly count = el('point-count');
  /** What syncSelection last drew, so scrollIntoView only runs on a change. */
  private lastSelected: string | null = null;

  constructor(
    private readonly rows: readonly PointRow[],
    private readonly cb: PointsListCallbacks,
  ) {
    // Scoped to the rendered rows, not every point: with a filter active the
    // master checkbox summarises what is on screen, so it must act on that too.
    this.toggleAll.addEventListener('change', () =>
      this.cb.onToggleAll(this.toggleAll.checked, this.renderedIds()),
    );

    this.search.addEventListener('input', () => this.cb.onFilterChange());

    // Escape is handled here rather than in ui.ts's window listener, which knows
    // about one filter and should not have to learn about a second. Stopping the
    // event only when there was text to clear is what keeps the rest of ui.ts's
    // ladder intact: a second, empty press falls through and closes the drawer,
    // exactly as it does from the trail filter.
    this.search.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || this.search.value === '') return;
      this.search.value = '';
      this.cb.onFilterChange();
      e.stopPropagation();
    });
  }

  /**
   * The one way this list is drawn. `hidden` is main.ts's live set of hidden
   * 지점번호 and `selected` the one whose popup is open, both re-read every time
   * rather than remembered here.
   */
  render(hidden: ReadonlySet<string>, selected: string | null): void {
    const tokens = searchTokens(this.search.value);
    const matches = tokens.length
      ? this.rows.filter((row) => matchesFolded(row.haystack, tokens))
      : this.rows;

    // Hidden on the total, never on the match count: a filter that excludes
    // everything must not take its own escape hatch with it.
    this.search.hidden = this.rows.length === 0;

    this.empty.hidden = matches.length > 0;
    this.empty.textContent =
      this.rows.length === 0
        ? 'No national points in data/national_points_w_name.tsv.'
        : `No point matches “${this.search.value.trim()}”.`;
    this.count.textContent = countLabel(matches.length, this.rows.length);

    // Only the filter can change which rows exist. A checkbox or the selection
    // changes what a row *says*, and rebuilding 272 rows to say it would throw the
    // focus of whoever just pressed Space out to <body> — leaving them unable to
    // carry on down the list — and discard the panel's scroll position for
    // nothing.
    if (!this.sameRows(matches)) this.rebuild(matches, tokens);

    // On both paths, so a freshly built row and a re-synced one are set from the
    // hidden set and the selection by the same lines and can never drift apart.
    this.syncChecks(hidden, matches.length);
    // After rebuild(), never before: it restores the panel's scroll offset, and a
    // scrollIntoView run first would simply be undone by it.
    this.syncSelection(selected);
  }

  /**
   * Whether the rows on screen are already the rows wanted, in order. Cheap
   * enough to ask on every toggle: 272 string compares and no allocation, against
   * a rebuild of some 1400 nodes.
   */
  private sameRows(matches: readonly PointRow[]): boolean {
    const lis = this.list.children;
    if (lis.length !== matches.length) return false;
    for (let i = 0; i < matches.length; i++) {
      if ((lis[i] as HTMLElement).dataset.pointId !== matches[i].id) return false;
    }
    return true;
  }

  private rebuild(matches: readonly PointRow[], tokens: string[]): void {
    // .panel-body is the panel's only scroller and this empties a list inside it,
    // so without carrying the offset across, every keystroke snaps the panel back
    // to the top. A now-out-of-range value is clamped by the browser, which is the
    // right answer for a shorter list.
    const scroll = this.panelBody.scrollTop;
    this.list.replaceChildren();

    for (const row of matches) {
      const li = document.createElement('li');
      li.dataset.pointId = row.id;
      // The whole row goes to the point, so there is something to aim
      // at besides a 13px dot on the map, and the title and the detail under it
      // never answer the same click differently. Guarded rather than scoped to a
      // sub-element: the checkbox keeps its own meaning.
      li.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('input, button')) return;
        this.cb.onSelect(row.id);
      });

      const visible = document.createElement('input');
      visible.type = 'checkbox';
      visible.title = 'Show on map';
      // Named as well as titled, unlike a trail row: 272 checkboxes announced as
      // "checkbox" with nothing to tell them apart is a different problem from 36.
      visible.setAttribute('aria-label', `Show ${row.title} on map`);
      visible.addEventListener('change', () => this.cb.onToggle(row.id, visible.checked));

      // Only there to match a row to its pin; a click falls through to the row.
      const swatch = document.createElement('span');
      swatch.className = 'point-swatch';
      swatch.style.background = row.color;

      const text = document.createElement('div');
      text.className = 'grow';
      const title = document.createElement('div');
      title.className = 'point-title';
      title.replaceChildren(highlightName(row.title, tokens));
      const detail = document.createElement('div');
      detail.className = 'point-detail';
      detail.replaceChildren(highlightName(row.detail, tokens));
      title.title = `${row.title} — click to go there`;
      detail.title = `${row.detail} — click to go there`;
      // Not highlighted: the filter does not search it (see PointRow.coords).
      const coords = document.createElement('div');
      coords.className = 'point-detail point-code';
      coords.textContent = row.coords;
      text.append(title, detail, coords);

      li.append(visible, swatch, text);
      this.list.append(li);
    }

    this.panelBody.scrollTop = scroll;
  }

  /** The checkboxes and the master, set from the hidden set in one place. */
  private syncChecks(hidden: ReadonlySet<string>, total: number): void {
    let shown = 0;
    for (const li of this.list.children) {
      const id = (li as HTMLElement).dataset.pointId ?? '';
      const box = li.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (!box) continue;
      box.checked = !hidden.has(id);
      if (box.checked) shown++;
    }
    setTristate(this.toggleAll, shown, total);
  }

  /**
   * The tint on the row whose point has a popup open, and nothing else — the same
   * `.selected` the trail list uses, so the two can never look like two things.
   *
   * Toggled per row rather than stamped at creation as ui.ts does, because this
   * list does not rebuild to change what a row says (see render).
   */
  private syncSelection(selected: string | null): void {
    for (const li of this.list.children) {
      const on = (li as HTMLElement).dataset.pointId === selected;
      li.classList.toggle('selected', on);
      if (on) li.setAttribute('aria-current', 'true');
      else li.removeAttribute('aria-current');
    }

    // Only on a change, and only towards a point: a row already on screen is left
    // alone by block: 'nearest', and a selection the filter is hiding simply has
    // no row, which needs no special case.
    const changed = selected !== this.lastSelected;
    this.lastSelected = selected;
    if (changed && selected) {
      this.list
        .querySelector(`li[data-point-id="${CSS.escape(selected)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    }
  }

  /** The ids on screen, in list order, read back off the rows rather than cached
   *  alongside them. The master checkbox acts on these, and `;` `'` step through them. */
  renderedIds(): string[] {
    return Array.from(this.list.children)
      .map((li) => (li as HTMLElement).dataset.pointId ?? '')
      .filter(Boolean);
  }
}
