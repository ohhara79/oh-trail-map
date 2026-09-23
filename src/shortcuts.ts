/**
 * Single-key shortcuts for a desktop keyboard, and the `?` sheet that lists them.
 *
 * Most keys press a button already on screen rather than calling what it calls,
 * so a key does exactly what the click would — and does nothing where the button
 * is not showing, which is what keeps 3D's keys out of 2D and the other way round.
 *
 * Matched on e.code, like walkControls.ts, so the Korean IME does not turn `v`
 * into `ㅍ`. W A S D, the arrows, Space and Shift are left to walking, and
 * Ctrl/Alt/Meta to the browser.
 */

export type ShortcutCallbacks = {
  /** `L`: the side panel, open or closed. */
  togglePanel: () => void;
  /** `,` and `.`: move the profile cursor by this many points. */
  stepProfile: (delta: number) => void;
  /** `[` and `]`: the previous or next trail in the panel list. */
  stepTrail: (delta: number) => void;
  /** `;` and `'`: the previous or next national point on the selected trail's
   *  profile, or in the panel list with no trail selected. */
  stepPoint: (delta: 1 | -1) => void;
  /** `K`: the 3D minimap, small or large. */
  toggleMinimapSize: () => void;
  /** `C`: frame the selected trail. */
  zoomToSelected: () => void;
  /** `B`: the next basemap. */
  nextBasemap: () => void;
  /** `H`: every national point off, or back on if they already are. */
  togglePoints: () => void;
  /** `T`: every trail off, or back on if they already are. */
  toggleTrails: () => void;
};

/** Keys that press a button, by e.code; the first one showing is pressed. */
const BUTTONS: Record<string, string[]> = {
  Digit3: ['view3d'],
  // The playback bar's while a trail plays, else the selection bar's.
  KeyE: ['playback3d-profile', 'selection-profile'],
  KeyG: ['locate'],
  KeyV: ['walk3d'],
  KeyP: ['play3d'],
  KeyX: ['speed3d'],
  KeyM: ['minimap3d'],
  // The attitude disc at eye height, MapLibre's compass in orbit; 2D has neither.
  KeyN: ['attitude3d', 'compass3d'],
  Enter: ['selection-walk'],
};

/** A text box, where a letter is typing and not a shortcut. A checkbox or a
 *  slider with focus is not, or clicking one would leave the keys dead. */
function typing(): boolean {
  const el = document.activeElement;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  return !['checkbox', 'radio', 'range', 'button', 'submit', 'reset'].includes(el.type);
}

/** Laid out, somewhere on the page: display:none on it or any ancestor, or a
 *  `hidden` attribute, leaves it with no boxes at all. */
function showing(el: HTMLElement): boolean {
  return el.getClientRects().length > 0;
}

function pressButton(ids: string[]): boolean {
  for (const id of ids) {
    const button = document.getElementById(id);
    if (button instanceof HTMLButtonElement && !button.disabled && showing(button)) {
      button.click();
      return true;
    }
  }
  return false;
}

export function installShortcuts(cb: ShortcutCallbacks): void {
  const sheet = document.getElementById('shortcuts') as HTMLDialogElement;
  const toggleSheet = (): void => {
    if (sheet.open) sheet.close();
    else sheet.showModal();
  };
  document.getElementById('shortcuts-open')?.addEventListener('click', toggleSheet);
  document.getElementById('shortcuts-close')?.addEventListener('click', () => sheet.close());
  // A click on the dialog itself, rather than anything inside it, is the backdrop.
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) sheet.close();
  });

  // Capture phase, and registered before view3d.ts's own capture listener, so
  // Escape with the sheet open closes the sheet and nothing else — not a walk,
  // not the selection, not the panel.
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || !sheet.open) return;
      sheet.close();
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    { capture: true },
  );

  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey || typing()) return;

    // Shift+/ on most layouts, and read off e.key since that is the layout's own answer.
    if (e.key === '?') {
      if (!e.repeat) toggleSheet();
      e.preventDefault();
      return;
    }
    if (sheet.open) return;

    // The profile steps repeat while held, like the chart's own arrows.
    if (e.code === 'Comma' || e.code === 'Period') {
      const dir = e.code === 'Comma' ? -1 : 1;
      cb.stepProfile(e.shiftKey ? dir * 10 : dir);
      e.preventDefault();
      return;
    }
    // Every other key is a toggle or a jump, which a held key would only undo.
    if (e.repeat || e.shiftKey) return;

    if (e.code === 'Enter') {
      // A focused button or link answers Enter itself.
      const el = document.activeElement;
      if (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement || el instanceof HTMLInputElement) {
        return;
      }
    }

    const action: (() => void) | undefined = {
      KeyL: cb.togglePanel,
      KeyC: cb.zoomToSelected,
      KeyB: cb.nextBasemap,
      KeyH: cb.togglePoints,
      KeyT: cb.toggleTrails,
      KeyK: cb.toggleMinimapSize,
      BracketLeft: () => cb.stepTrail(-1),
      BracketRight: () => cb.stepTrail(1),
      Semicolon: () => cb.stepPoint(-1),
      Quote: () => cb.stepPoint(1),
    }[e.code];
    if (action) {
      action();
      e.preventDefault();
      return;
    }
    const ids = BUTTONS[e.code];
    if (ids && pressButton(ids)) e.preventDefault();
  });
}
