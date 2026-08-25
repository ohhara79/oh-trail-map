# Mobile-friendly layout: overlay drawer, live map sizing, device canvas limits

## Context

Two symptoms were reported from a phone: the control panel could be hidden with
no apparent way to reopen it, and the trail "doesn't show correctly". Both were
real, and neither was a matter of general polish — the app had no mobile
handling at all. A grep across `src/` and `index.html` found zero `@media`
queries, zero `invalidateSize` calls, zero `dvh`, and no `ResizeObserver`,
`matchMedia`, or touch handling.

**The reopen button existed but was buried.** `#expand` sat at `top:12px;
left:12px; z-index:1000`. Leaflet's default zoom control renders at
`.leaflet-top .leaflet-left` with the *same* `z-index: 1000`
(`leaflet.css:138-141`), a 10 px margin, and 30×30 px on touch. Since `#expand`
precedes `#map` in DOM order, equal z-index meant the zoom control won the paint
and covered the button entirely. It was also a ~24 px `»` glyph, well under the
~44 px touch-target floor.

**The map was a sliver.** `#sidebar` was `flex: 0 0 310px` with no breakpoint,
so a 390 px phone left roughly 80 px of map and the trail was drawn into it. Two
defects compounded it. `#app { height: 100vh }` put the bottom of the map under
the mobile URL bar, unreachable behind `overflow: hidden`. And because nothing
ever called `map.invalidateSize()`, Leaflet — which caches its container size
and only recomputes on a window resize — never learned about the panel toggling
a 310 px width change, leaving a stale tile grid and pointer hit-testing offset
by the same amount. That last one was a guaranteed bug on the desktop too.

## Approach

### 1. `src/style.css` — one breakpoint, one state attribute

Panel state moved off the `hidden` property onto `data-panel="open" | "closed"`
on `#app`. `hidden` implies `display: none`, which cannot transition; the
attribute lets one piece of state drive `display` on desktop and `transform` on
small screens without a second markup tree.

Below the breakpoint the sidebar leaves the flex row entirely
(`position: absolute`) and becomes a drawer over a permanently full-width map,
with a dimmed `#backdrop` behind it. `visibility` is transitioned with a delay
rather than animated, because a panel moved off-screen with `translateX` alone
stays in the tab order.

The media query is `(max-width: 720px), (max-height: 480px)`. The height arm
catches landscape phones, which are wider than 720 px but have so little
vertical room that a fixed column is the wrong trade.

`height: 100dvh` follows `height: 100vh` so the plain value remains the
fallback, and `env(safe-area-inset-*)` keeps the panel body, toasts, and the
menu button clear of notches and the home indicator.

Two ordering constraints are load-bearing and easy to break later:

- The `@media` block must come *after* the base
  `#app[data-panel='closed'] #sidebar { display: none }` rule. Both are one
  attribute plus one id, so specificity is tied and source order decides.
- `#sidebar` moved from `z-index: 1000` to `1100`, and `#backdrop` sits at
  `1050`. This is the same trap that produced the original bug: an overlay
  drawer covers map area, and Leaflet's control containers are *also*
  `z-index: 1000` and come later in DOM order, so the zoom control and the
  attribution strip would have painted straight through the open panel.

### 2. The reopen affordance

`#expand` became a `☰` at 40 px (44 px on coarse pointers) with an `aria-label`,
at `z-index: 1100`, and lost its `hidden` attribute — CSS now derives its
visibility from `data-panel`, so there is one source of truth rather than two
booleans kept in step by hand.

The real fix for the overlap, though, is in `src/map.ts`: `zoomControl: false`
plus `L.control.zoom({ position: 'bottomright' })`. Raising the button's
z-index alone would have left a 24 px target under the corner where a future
top-left control would collide again; moving the control frees the corner and
puts zoom in thumb reach on a phone.

On small screens the panel starts **closed**, so the first thing a phone user
sees is the map. That state is deliberately not persisted: `Settings` describes
how trails render, and panel visibility is per-device chrome, not a rendering
choice.

### 3. `src/map.ts` — a `ResizeObserver`, not a toggle callback

The obvious fix for the stale tile grid is an `onPanelToggle` callback in
`UiCallbacks` calling `invalidateSize()`. It was rejected: it addresses only the
toggle, and it fires *during* the drawer animation, so Leaflet reads a half-way
width.

Observing the container instead fixes the toggle, the mobile URL bar collapsing
against `100dvh`, and orientation changes with one block, needs no callback
threading, and is correctly timed by construction — it reports the final size
whatever caused the change:

```ts
let pending = 0;
new ResizeObserver(() => {
  cancelAnimationFrame(pending);          // coalesce animation frames
  pending = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
}).observe(container);
```

On small screens the drawer overlays rather than displacing the map, so `#map`
never resizes on toggle and no invalidation happens. That is correct, not a gap.

### 4. `src/export.ts` — the device's real canvas ceiling

`MAX_CANVAS_DIMENSION = 16000` and `MAX_CANVAS_AREA = 200_000_000` are desktop
figures. Phones cap far lower — iOS Safari near 4096 px per side and 16.7 Mpx
total — and past the limit `toBlob()` returns a **blank image rather than
throwing**. An over-large mobile export therefore "succeeded" and downloaded a
useless file, sailing straight past the specific-message machinery `planExport`
already had.

`canvasLimits()` picks the tighter pair on a coarse pointer — the closest proxy
the platform offers, since the true ceiling cannot be queried without allocating
against it — and feeds the existing `problem` chain rather than adding a second
failure path. The default 4× is unchanged: a 390×844 view at 4× is 1560×3376 and
passes, while 8× is 3120×6752 and now reports why. `canvasToBlob`'s message no
longer blames canvas tainting for every failure.

### 5. Touch targets

Scoped to `@media (pointer: coarse)` so the desktop layout is untouched: the
colour swatches (26×22), the per-trail remove buttons, the header buttons, the
list rows, and the width slider all come up to comfortable sizes. `.notice`'s
`max-width: 62ch` became `min(62ch, calc(100vw - 32px))`, and toasts inset to
clear the relocated zoom control.

### 6. `vite.config.ts`

`server.host: true` binds the LAN address so a phone on the same Wi-Fi can reach
the dev server. Noted in the README: geolocation still refuses a LAN-IP URL over
plain HTTP, because `startLocating` requires a secure context, so testing
*location* on a device needs localhost or HTTPS. Everything else works there.

## Files

| File | Change |
|------|--------|
| `src/style.css` | `100dvh`, `data-panel` rules, drawer + backdrop media query, z-index restack above Leaflet's 1000, coarse-pointer touch targets, notice width, safe-area insets |
| `index.html` | `#backdrop` element; `#expand` → `☰` with `aria-label`, `hidden` dropped; `aria-label` on `#collapse` |
| `src/ui.ts` | `setPanel()` replaces the two-boolean `hidden` juggling; backdrop and `Escape` wired; initial state from `matchMedia(DRAWER_QUERY)` |
| `src/map.ts` | `zoomControl: false` + `L.control.zoom({position:'bottomright'})`; `ResizeObserver` → `invalidateSize({pan:false})` |
| `src/export.ts` | `canvasLimits()` folded into `planExport`'s `problem`; `canvasToBlob` message corrected |
| `vite.config.ts` | `server.host: true` |
| `README.md` | Mobile bullet, LAN-vs-geolocation caveat, mobile export cap |

`DRAWER_QUERY` in `src/ui.ts` and the media query in `src/style.css` must stay
in sync; both carry a comment saying so.

## Verification

`npm run build` (`tsc --noEmit` + Vite) clean.

Driven against `npm run dev` through the Chrome DevTools Protocol at three form
factors, with touch emulation on for the phone viewports so `(pointer: coarse)`
applies. Measurements rather than eyeballing, since the two headline bugs were
both invisible-by-inspection:

**Phone, 390×844** — panel `closed` on load; `#map` 390 px wide and Leaflet
agreeing at 390 (it read ~80 px before); `elementFromPoint` over `#expand`
returns `#expand` itself, i.e. the button is genuinely on top rather than under
the zoom control, which now reports its parent as `leaflet-bottom
leaflet-right`; the imported trail's path spans x 63→328 inside a 390 px
viewport. Hamburger opens the drawer, the exposed backdrop strip closes it, and
`Escape` closes it.

**Export guard, same viewport** — 4× → enabled, "1560 × 3376 px, 98 tiles";
8× → button disabled, "8x needs 3120x6752 px, past the ~4096 px browser canvas
limit". Previously this would have downloaded a blank PNG.

**Drawer scroll** — with the body scrolled to the bottom the Export button's
`bottom` is 832 against a 844 px viewport, fully visible: the `100dvh` fix.

**Desktop, 1280×800** — sidebar `position: static`, map 970 px, backdrop inert
(`opacity: 0; pointer-events: none`); the layout is unchanged. Collapsing gives
map CSS width 1280 **and Leaflet reporting 1280**, with the rightmost loaded
tile edge at 1443 ≥ 1280, so tiles genuinely cover the reclaimed strip instead
of leaving the grey gutter this used to produce. Reopening returns to 970/970.

**Landscape phone, 844×390** — the `max-height` arm engages: sidebar
`position: absolute`, map the full 844 px, Leaflet agreeing, panel closed on
load.

Not covered automatically, worth a pass on a real handset: pinch-zoom and
one-finger pan feel, iOS Safari's actual URL-bar behaviour against `100dvh`
(headless Chrome cannot reproduce it), and a real 4× export opening correctly
in a photo library.
