/**
 * The three things the trail list and the national point list must render
 * identically: the <mark>s a filter leaves on a match, the "(n of N)" beside a
 * heading, and the tri-state master checkbox.
 *
 * Deliberately not a shared list class. The two lists differ in the half that
 * matters — selection, scrollIntoView, expand-all and a ▶ button are the trail
 * list's alone; a five-column filter and a rebuild-only-when-the-rows-change path
 * are the point list's — and a class general enough to cover both would take more
 * parameters than either has code. What is here instead is the part where a second
 * implementation would be subtly, invisibly wrong.
 */

/**
 * Renders `display` with every query token wrapped in <mark>.
 *
 * Indices come from the lowercased copy, so it bails out in the rare case
 * lowercasing changes length (ẞ, İ) rather than slicing at shifted offsets.
 * NFC normalisation — the other half of the fold — is applied by the caller, so
 * what is measured here is exactly what is drawn.
 */
export function highlightName(display: string, tokens: string[]): Node {
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

/** The count beside a list heading: nothing when the list is empty, the total
 *  when nothing is filtered out, and both numbers when something is. */
export function countLabel(matched: number, total: number): string {
  if (!total) return '';
  return matched === total ? `(${total})` : `(${matched} of ${total})`;
}

/**
 * Points a master checkbox at the rows it summarises: checked when they are all
 * on, indeterminate when only some are, and hidden when there are none.
 *
 * `indeterminate` is a property, not an attribute, and setting `checked` does not
 * clear it — which is the whole reason this is one function and not two copies.
 */
export function setTristate(box: HTMLInputElement, on: number, total: number): void {
  box.hidden = total === 0;
  box.checked = total > 0 && on === total;
  box.indeterminate = on > 0 && on < total;
}
