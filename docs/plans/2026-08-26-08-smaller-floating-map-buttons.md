# Smaller floating map buttons

## Context

Three buttons float over the map: `#expand` (the hamburger, top-left),
`#compass` (top-right, iOS only) and `#locate` (bottom-right). All three were
40×40, growing to 44×44 on coarse pointers. Leaflet's zoom control, which sits
directly below `#locate` in the same corner, is 34px square. Two controls a
10px gap apart, one half again as big as the other, and the bigger one is the
app's — which reads as the app shouting over the map. That mismatch is what was
asked to be fixed.

The size was the ask; the chrome came with it. Once the boxes match, a 1px
`var(--border)` and a 6px radius sitting 10px above a 2px `rgba(0,0,0,.2)` and a
4px radius is the *next* thing you notice. Both were settled with the user
before writing anything:

- **34px everywhere**, touch included. The alternative was 34px on desktop and
  44px on phones, keeping the recommended finger target — but then the two
  controls match on exactly the devices where nobody is looking closely, and
  disagree on the ones where they sit under your thumb. Being below 44px is the
  same trade Leaflet already makes for zooming; a button that misses is a button
  you press again, and the corner is otherwise empty.
- **The full zoom-control look**, not just its size. Border, radius and shadow
  as well as width and height.

## Change

`src/style.css` only. Nothing in `index.html` or the TypeScript moved — in
particular the `#locate` icon stays a 20px SVG, which still has room inside the
30px content box.

### One rule for the three of them

The three id rules already repeated `position`, `display` and the flex centring
between them, so the shared chrome would have been a fourth copy of everything.
It is a single rule instead, placed above them:

```css
#expand, #compass, #locate {
  width: 34px; height: 34px;
  display: flex; align-items: center; justify-content: center;
  padding: 0;
  border: 2px solid rgba(0,0,0,.2);
  border-radius: 4px;
  box-shadow: none;
}
```

Those numbers are Leaflet's, not ours: under `.leaflet-touch` a `.leaflet-bar a`
is 30px inside the bar's 2px border, with the shadow explicitly removed — 34px
square all told. The `.leaflet-touch` qualifier matters less than it sounds,
because Leaflet adds that class wherever `window.PointerEvent` exists, which is
every current desktop browser too.

`padding: 0` is load-bearing for `#expand` and `#compass`. They inherited
`padding: 4px 8px` from the base `button` rule, which nobody had to think about
at 40px; at 34px with `box-sizing: border-box` and a 2px border it leaves 14px
of content width for an 18px ☰. `#locate` had already zeroed it for its icon.

The three id rules keep only what actually differs: their corner offsets, the
`z-index: 1100` that has to beat Leaflet's control panes, `font-size` for the
two glyph buttons, and `#locate`'s state colours.

Specificity is a wash — a selector list of three ids scores the same as each id
alone — so the shared rule goes *first* and the id rules win any overlap. There
is no overlap left, but the ordering is what makes that true by construction
rather than by luck.

### The offsets did not move

`#locate` is still `right: 10px; bottom: 84px`, and the comment explaining them
still holds: 10px is Leaflet's own control margin, and 84px clears a control
that reaches 74px up, leaving the same 10px gap above it that the control leaves
below itself. The change makes the comment *more* true — with both boxes now
34px wide, the two line up on their right edges exactly, rather than one merely
being flush with the other's.

### The coarse-pointer bump is gone

```css
@media (pointer: coarse) {
  #expand, #compass, #locate { width: 44px; height: 44px; }
```

Deleted, and replaced by a comment saying why those three are absent from a
block whose entire subject is growing things for fingers. Without it, the next
person to read the file fixes the "oversight". The rest of the block — the
sidebar's own touch targets — is untouched.

## Notes

- On a browser with no `window.PointerEvent`, Leaflet skips `.leaflet-touch` and
  the zoom control falls back to 26px buttons with a 1px border and its shadow
  intact, so the three would be slightly larger and flatter than it. No current
  mainstream browser lands there, and the `#locate` offset comment has always
  assumed the touch branch.
- `#compass` was resized along with the other two. It is only ever visible on
  iOS, but it shares the recipe, and leaving it at 40px would have made it the
  one odd button on the one platform where nobody would think to look.
