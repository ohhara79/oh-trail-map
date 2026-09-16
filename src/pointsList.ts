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
 * It renders and reports; it owns no visibility state. main.ts holds the hidden
 * set and hands it back on every render, so a row can never disagree with the pin.
 */
import { highlightName, countLabel, setTristate } from './listUi';
import type { PointRow } from './points';
import { matchesFolded, searchTokens } from './trails';

export type PointsListCallbacks = {
  onToggle: (code: string, visible: boolean) => void;
  /** `codes` is the rows currently on screen, which a filter may have narrowed. */
  onToggleAll: (visible: boolean, codes: string[]) => void;
  onFilterChange: () => void;
  /** A row click off its checkbox: go to the point and open its popup. */
  onSelect: (code: string) => void;
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

  constructor(
    private readonly rows: readonly PointRow[],
    private readonly cb: PointsListCallbacks,
  ) {
    // Scoped to the rendered rows, not every point: with a filter active the
    // master checkbox summarises what is on screen, so it must act on that too.
    this.toggleAll.addEventListener('change', () =>
      this.cb.onToggleAll(this.toggleAll.checked, this.renderedCodes()),
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
   * 지점번호, re-read every time rather than remembered here.
   */
  render(hidden: ReadonlySet<string>): void {
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

    // Only the filter can change which rows exist. A checkbox changes what a row
    // *says*, and rebuilding 272 rows to say it would throw the focus of whoever
    // just pressed Space out to <body> — leaving them unable to carry on down the
    // list — and discard the panel's scroll position for nothing. The trail list
    // makes the same trade in setAllNamesExpanded, for the same second reason.
    if (!this.sameRows(matches)) this.rebuild(matches, tokens);

    // On both paths, so a freshly built row and a re-synced one are set from the
    // hidden set by the same line and can never drift apart.
    this.syncChecks(hidden, matches.length);
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
      if ((lis[i] as HTMLElement).dataset.pointCode !== matches[i].code) return false;
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
      li.dataset.pointCode = row.code;
      // The whole row goes to the point, so there is something to aim at besides
      // a 13px dot on the map. Guarded rather than scoped to a sub-element: the
      // checkbox and the colour swatch keep their own meaning.
      li.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('input, button')) return;
        this.cb.onSelect(row.code);
      });

      const visible = document.createElement('input');
      visible.type = 'checkbox';
      visible.title = 'Show on map';
      // Named as well as titled, unlike a trail row: 272 checkboxes announced as
      // "checkbox" with nothing to tell them apart is a different problem from 36.
      visible.setAttribute('aria-label', `Show ${row.code} on map`);
      visible.addEventListener('change', () => this.cb.onToggle(row.code, visible.checked));

      // Only there to match a row to its pin; a click falls through to the row.
      const swatch = document.createElement('span');
      swatch.className = 'point-swatch';
      swatch.style.background = row.color;

      const text = document.createElement('div');
      text.className = 'grow';
      const code = document.createElement('div');
      code.className = 'point-code';
      code.replaceChildren(highlightName(row.code, tokens));
      const detail = document.createElement('div');
      detail.className = 'point-detail';
      detail.replaceChildren(highlightName(row.detail, tokens));
      // The line is clipped to keep 272 rows scannable, so the full text has to be
      // reachable: here on hover, and in the popup a click away.
      detail.title = row.detail;
      text.append(code, detail);

      li.append(visible, swatch, text);
      this.list.append(li);
    }

    this.panelBody.scrollTop = scroll;
  }

  /** The checkboxes and the master, set from the hidden set in one place. */
  private syncChecks(hidden: ReadonlySet<string>, total: number): void {
    let shown = 0;
    for (const li of this.list.children) {
      const code = (li as HTMLElement).dataset.pointCode ?? '';
      const box = li.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (!box) continue;
      box.checked = !hidden.has(code);
      if (box.checked) shown++;
    }
    setTristate(this.toggleAll, shown, total);
  }

  /** The codes on screen, read back off the rows rather than cached alongside them. */
  private renderedCodes(): string[] {
    return Array.from(this.list.children)
      .map((li) => (li as HTMLElement).dataset.pointCode ?? '')
      .filter(Boolean);
  }
}
