/**
 * The name of whatever a click would pick, next to the mouse. Shared by both
 * views: each one decides what that is, with the same function its click handler
 * uses, and hands the name and the pointer's position here.
 */

/** Gap between the pointer and the label, in CSS pixels. */
const OFFSET = 12;

export type HoverLabel = {
  /** Shows `text` beside (x, y), in `container`'s coordinates. */
  show(text: string, x: number, y: number): void;
  hide(): void;
  /** Takes the label out of its container, for a view that is going away. */
  remove(): void;
};

/**
 * Whether the pointer can hover at all. A finger has no position until it is
 * already tapping, so on touch there is nothing to preview and the tap itself is
 * the only answer.
 */
export function canHover(): boolean {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function createHoverLabel(container: HTMLElement): HoverLabel {
  const el = document.createElement('div');
  el.className = 'map-hover-label';
  el.hidden = true;
  container.appendChild(el);

  return {
    show(text, x, y) {
      if (el.textContent !== text) el.textContent = text;
      el.hidden = false;
      // Below and to the right of the pointer, as a native tooltip sits, flipped
      // to the other side where that would run off the map.
      const left = x + OFFSET + el.offsetWidth > container.clientWidth ? x - OFFSET - el.offsetWidth : x + OFFSET;
      const top = y + OFFSET + el.offsetHeight > container.clientHeight ? y - OFFSET - el.offsetHeight : y + OFFSET;
      el.style.transform = `translate(${Math.max(0, left)}px, ${Math.max(0, top)}px)`;
    },
    hide() {
      el.hidden = true;
    },
    remove() {
      el.remove();
    },
  };
}
