# Credits ⓘ in the corner

## Context

[2026-10-11-02](2026-10-11-02-map-credits.md) put the credits ⓘ in a 34×12px box
centred over `#view3d`. The user wanted it pushed right-most, into the free corner:
the 12px strip above the 3D button and the 10px margin to its right. The 3D button
stays where it is.

## Change

`src/style.css`, the `#credits` block:

1. `#credits` sits at `right: env(safe-area-inset-right)` rather than 10px in, and
   is 16px wide, flush in the corner above and right of the button.
2. `#credits-toggle` is 16×12px. The glyph is unchanged.
3. `#credits-text` opens at `right: 48px` from the edge. That is the button's 44px
   plus a 4px gap, the same clearance as before.

`README.md` now says the ⓘ is in the top-right corner.

## Verification

1. `npm run build` passes.
2. Desktop and narrow screenshots: the ⓘ is in the corner without touching the 3D
   button, and the open box sits left of the button and fits on screen.
