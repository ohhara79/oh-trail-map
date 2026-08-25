# Small screens: the trail list collapsed to zero height

## Context

On a phone the drawer showed the `TRAILS` heading with nothing under it — the
imported trails were on the map, but the list that toggles and recolors them was
unreachable. Nothing was wrong with the drawer from
`2026-08-25-03-mobile-friendly-layout.md`: it opened, slid, and scrolled. The
list itself was being laid out at zero pixels tall.

The cause is a flexbox interaction in `src/style.css`. `.panel-body` is both a
**scroll container** (`overflow-y: auto`) and a **flex column**. Its children are
`.block` sections with the default `flex-shrink: 1`, so when the combined content
— import, colors, trails, basemap, export — is taller than the drawer, the flex
algorithm shrinks the children *before* the container ever scrolls.

Which child gets shrunk is decided by the automatic minimum size. Plain `.block`s
have `min-height: auto` and refuse to compress below their content. But
`.grow-block` sets `min-height: 0` and `#trail-list` sets `overflow-y: auto` —
both opt out of that floor. So the trails section was the *only* element the
algorithm could take space from, and it took all of it. The `<h2>` still painted
(it keeps its own auto minimum), the `<ul>` went to zero.

The desktop never showed this because a full-height window has spare room, so no
shrinking happens. Any short window hits it: on a 390×844 phone the panel content
runs to roughly 500 px against a ~500 px drawer, and it degrades from there in
landscape.

## Approach

### 1. Panel blocks never compress

```css
.block { ...; flex-shrink: 0; }
```

The `.panel-body` scroller already exists to handle overflow; letting flex steal
height from sections first is the bug, not the fix. `.grow-block` keeps
`flex: 1; min-height: 0` so it still absorbs *spare* height on desktop and its
list still scrolls internally there — it simply can no longer be crushed. This
also covers short desktop windows, which sit above the drawer breakpoint and
would otherwise collapse the same way.

### 2. Inside the drawer breakpoint, one scroller instead of two

```css
  .grow-block { flex: 0 0 auto; }
  #trail-list { overflow-y: visible; }
```

Where vertical room is scarce, a nested scroller inside the couple of hundred
pixels left over is worse than scrolling the panel: the list renders at natural
height and `.panel-body` scrolls the lot. Added to the existing
`@media (max-width: 720px), (max-height: 480px)` block, so the landscape-phone
arm gets the same treatment.

Both changes are CSS only — no markup or TypeScript touched, and `DRAWER_QUERY`
in `src/ui.ts` still matches the query it is documented against.

## Verification

Built clean (`npm run build`), then checked in a browser at 390×844 and 844×390
with several `samples/` GPX files imported: the rows appear under `TRAILS`, and
scrolling the panel reaches both the end of the list and the Export button. Above
720 px wide the desktop layout is unchanged — the list scrolls inside its own box
with Basemap and Export fixed below it — and a ~560 px-tall desktop window now
shows rows where it previously showed none.
