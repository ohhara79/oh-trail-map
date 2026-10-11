import { TERRAIN_CREDIT, type Basemap } from './basemaps';

export type Credits = {
  setBasemap: (basemap: Basemap) => void;
};

/**
 * The ⓘ above the 3D button and the credits it folds away: the current basemap's
 * and the terrain's. One element over both views rather than a control in each
 * map, which both keep `attributionControl: false` — so 2D and 3D show the same
 * thing in the same place, and switching views never moves it.
 */
export function createCredits(basemap: Basemap): Credits {
  const root = document.getElementById('credits')!;
  const toggle = document.getElementById('credits-toggle') as HTMLButtonElement;
  const text = document.getElementById('credits-text')!;

  function setOpen(open: boolean): void {
    text.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  }

  toggle.addEventListener('click', () => setOpen(text.hidden));
  // Put away by a click anywhere else, or Escape — but a click inside, on a link
  // or to select the text, leaves it open.
  document.addEventListener('pointerdown', (e) => {
    if (!text.hidden && !root.contains(e.target as Node)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !text.hidden) setOpen(false);
  });

  function setBasemap(next: Basemap): void {
    // Our own constants from basemaps.ts, never user input.
    text.innerHTML = `${next.credit}<br>${TERRAIN_CREDIT}`;
    for (const a of text.querySelectorAll('a')) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
  }

  setBasemap(basemap);
  return { setBasemap };
}
