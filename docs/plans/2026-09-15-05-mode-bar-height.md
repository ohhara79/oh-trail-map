# Match the 3D mode bar height to the 3D button

## Context

In 3D the `#mode3d` bar (Orbit / Walk / eye height / Gyro) sits at the top centre, at
the same `top: 12px` as the `#view3d` button in the top-right corner, but it is taller.
`#view3d` is the shared 34px floating-button box (`src/style.css`, the
`#expand, #compass, #locate, #view3d` rule). `.hud-bar` gets its height from its
contents instead: 2px border + 3px padding on each side, plus buttons with 4px vertical
padding around a 14px × 1.45 line, which comes to ≈38px. On coarse pointers
`.hud-bar button { padding: 8px 12px }` makes it ≈46px. The user wants both the same
height, so their top and bottom edges line up.

## Change

1. **`src/style.css`, the `#mode3d` rule** (next to `.hud-bar`): give the bar the
   floating buttons' 34px and let its buttons fill the space inside:
   ```css
   #mode3d {
     top: calc(12px + env(safe-area-inset-top));
     left: 50%; transform: translateX(-50%);
     /* The 34px of #view3d beside it, so the two share top and bottom edges. */
     height: 34px;
   }
   #mode3d button { align-self: stretch; padding-block: 0; }
   ```
   With border-box sizing that leaves 24px for the buttons (34 − 2×2 border − 2×3
   padding). The `#mode3d button` selector is more specific than `.hud-bar button`, so it
   also wins inside the `(pointer: coarse)` block. The 8px vertical padding there is
   dropped, and the 12px horizontal padding stays. `#playback3d` is left alone: its
   scrub track needs the extra height, and nothing sits beside it.
2. **`src/style.css`, touch-targets comment** (`@media (pointer: coarse)`): mention that
   `#mode3d` also keeps 34px on touch to match `#view3d`, the same sub-44px trade the
   comment already describes.
3. **Plan doc**: save as `docs/plans/2026-09-15-05-mode-bar-height.md`.

## Verification

- `npm run build` passes.
- `npm run dev`, switch to 3D. The Orbit/Walk bar's top and bottom edges line up with
  the 3D button in Orbit and Walk (with the eye-height button showing), on desktop and
  in a ~400px touch-emulated viewport. Labels are still vertically centred, and the
  pressed (blue) state fills the button.
