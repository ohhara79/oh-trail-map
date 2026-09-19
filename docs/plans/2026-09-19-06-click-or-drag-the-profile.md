# Click or drag the elevation profile with a mouse

## Context

On the elevation profile (`#profile-chart`), a mouse moved the cursor — and so the
2D/3D location dot — just by hovering. Passing the mouse over the panel on the way to
somewhere else moved the location by accident. The user wants a mouse to set it only
by click or click-and-drag, as touch and pen already do.

## Change (`src/profilePanel.ts`)

1. **Every pointer drags, the mouse included.** `pointerdown` always records
   `dragging` and takes pointer capture, then scrubs to the press; `pointermove`
   scrubs only for the dragging pointer. Capture keeps the drag going past the
   chart's edge, and the existing `pointerup` / `pointercancel` let it go.
2. **The empty-state hint reads "Drag along the profile,"** in place of "Point at the
   profile,", since hovering no longer does anything.

## Verification

- `npm run build` passes.
- With a mouse: moving over the chart leaves the cursor alone; a click jumps it there;
  press-and-drag scrubs, also past the chart's edge, and stops on release. Arrow keys
  still step after a click, ◀ ▶ still work, and touch is unchanged.
