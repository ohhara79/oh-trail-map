# A filled blue on state for the locate button

## Context

`#locate` sits above the zoom control bottom-right and said it was following you
with `color: var(--accent)` alone — a blue glyph on the same white chip it wears
when off. The user could not tell on from off at a glance, and pointed at `#view3d`
directly above it, which has said the same thing since it was written with
`color: #fff; background: var(--accent)`. The button carries no label to fall back
on, so hue on the ink was the whole signal.

This is the reverse of `2026-09-20-04-blue-elevation-toggle.md`, and deliberately.
That toggle lives on a bar you are meant to see through, so its on state had to
shed weight and let hue carry it. `#locate` is a solid chip in a column of solid
chips; it can take the full fill, and `#view3d` two buttons up is the thing it
should match.

## Change (`src/style.css`)

1. **On goes to `color: #fff; background: var(--accent)`**, byte for byte
   `#view3d[data-state='on']`. The ID beats the base `button:hover` rule, so the
   fill holds under the pointer — the same trade `#view3d` already makes.
2. **Searching takes the fill too**, the user's call between the two offered. It
   shares the selector as before: `aria-pressed` is already true the moment you
   tap, so the chip should look pressed, and the pulse is left to carry "no fix
   yet" on its own.
3. **The pulse moves from `#locate[data-state='searching'] svg` to the button.**
   Over an accent fill a fading glyph dissolves into the blue behind it; the whole
   chip fading reads as one thing waiting.
4. **The reduced-motion rule follows the selector**, dropping `svg`. Its comment
   is rewritten: searching no longer needs the pulse to read as pressed, it just
   stops being told apart from on — a transient difference the missing map marker
   reports anyway.
5. **Off and blocked are untouched**: `#2b3138` and `var(--muted)` on white, with
   `.locate-slash` still showing under blocked.

Nothing in `src/ui.ts` or `src/main.ts` changes. `setLocateState` already writes
`data-state` and `aria-pressed`, and the four states are unchanged.

## Verification

- `npm run build` passes.
- Tap the locate button: it fills blue with a white crosshair and pulses as a whole
  chip while it waits, then goes steady once the fix lands. Tap again and it
  returns to the dark glyph on white.
- Hover it while on: the fill stays, as `#view3d`'s does.
- The two buttons in the right-hand column read as one family — `#view3d` on and
  `#locate` on are the same blue.
- Deny location: still the dimmed glyph with its slash, still clickable, still
  re-raising the notice.
- With `prefers-reduced-motion: reduce`, searching is a steady blue chip rather
  than a pulsing one.
