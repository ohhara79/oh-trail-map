# A "show your location" button

## Context

The app already knew where you were the whole time. `startLocating()` runs
`navigator.geolocation.watchPosition` for the life of the page and keeps the
blue dot, the accuracy circle and the heading cone current. What it never did
was let you *go* there: the view followed the position exactly once, on the
first fix, and only when no restored trails had already claimed the view
(`main.ts`, `if (first && !hadTrails) map.setView(latlng, 14)`). Pan away after
that — or start over a saved trail on the other side of the country — and the
dot was somewhere off screen with no way back but dragging.

Every map app answers this with a button in the bottom-right corner, and that is
what was asked for. Two things were settled with the user before writing any of
it:

- **Follow, not a one-shot jump.** A click centres on you *and keeps you
  centred* as you move, with the button lit while it does. A second click, or
  dragging the map away, stops it. A one-shot recentre would have been less
  code, but you would be clicking it again every few seconds on the move, which
  is when this feature is actually used.
- **Zoom is never touched.** No convenience jump to street level in either
  direction. The centre moves; the zoom is yours.

The interesting part of the change is not the button — it is that "where am I"
has three answers, not one, and the button has to be honest about which one it
is holding: following you, following but still waiting for the first fix, or
unable to ever answer because the permission was refused.

## Change

### 1. `src/map.ts` — say whether an error is a dead end

`LocateCallbacks.onError` handed the caller a message and nothing else, which is
enough to raise a toast and not enough to decide anything. A GPS timeout and a
denied permission read identically at the call site, yet one will resolve on its
own within seconds and the other will not resolve for the rest of the page's
life — `watchPosition` does not re-prompt.

So it is now `onError: (message: string, blocked: boolean) => void`, with
`blocked` true for exactly the three dead ends: no `navigator.geolocation`, an
insecure context, and `PERMISSION_DENIED`. `TIMEOUT` and `POSITION_UNAVAILABLE`
pass `false` and change nothing. That one boolean is what lets the button dim
itself instead of pretending a click might work.

Nothing else in `map.ts` moved. The position the button needs was already
flowing out through `onFix(latlng, first)`.

### 2. `index.html` + `src/style.css` — bottom-right, above the zoom control

A plain `<button id="locate">` child of `#app`, exactly like `#expand` and
`#compass` — **not** a Leaflet control. Two reasons: it inherits the app's own
button styling rather than fighting `.leaflet-bar`, and a click on it never
reaches the `map.on('click')` handler that selects and deselects trails, which
a control inside the map container would have needed
`DomEvent.disableClickPropagation` to avoid.

The icon is an inline crosshair using `currentColor` throughout, so every state
below is a single `color` change, plus one diagonal `<line class="locate-slash">`
that CSS reveals only when blocked.

The corner arithmetic is the only fiddly bit, and it is worth writing down
because the numbers come from Leaflet's stylesheet rather than from taste:

- `right: 10px` — Leaflet's own `.leaflet-right .leaflet-control` margin, so the
  button's right edge is flush with the zoom control's. The top-corner buttons
  use 12px, but they have no neighbour to line up with.
- `bottom: 84px` — the zoom control reaches 74px up from the bottom: a 10px
  margin plus 64px of control, being two 30px `.leaflet-bar a` buttons inside a
  2px border. Those are the `.leaflet-touch` sizes, and Leaflet applies that
  class wherever `window.PointerEvent` exists — which is every current desktop
  browser too, not just phones. 84px leaves the same 10px gap above the control
  that the control leaves below itself.

Four states on one `data-state` attribute: `off` (grey), `searching` (accent,
with a slow opacity pulse, dropped under `prefers-reduced-motion`), `on`
(accent), `blocked` (muted, slash shown). `#locate` joins `#expand, #compass` in
the `@media (pointer: coarse)` rule that grows them to 44×44.

Deliberately never `disabled` and never `[hidden]`, even when blocked: a click
still does something useful there, which is to say again why nothing is
happening.

### 3. `src/ui.ts` — the usual plumbing

`onLocate: () => void` on `UiCallbacks`, a cached element, a click listener, and
`setLocateState(state: LocateState)` writing `data-state` plus an `aria-pressed`
that is true while following or searching. `LocateState` is exported so `main.ts`
names the same four strings the CSS does.

### 4. `src/main.ts` — the follow state

Three locals inside `main()`:

```ts
let lastFix: L.LatLng | null = null;   // the only copy outside startLocating
let following = false;
let blockedMessage: string | null = null;
```

and one derivation, `syncLocateButton()`, which every transition ends with:

```ts
blockedMessage !== null ? 'blocked' : !following ? 'off' : lastFix ? 'on' : 'searching'
```

Keeping that expression in one place is the point — the button cannot drift out
of step with the state because no other line writes it.

- **The click** re-raises `blockedMessage` and returns if there is one; else it
  flips `following`, and on the way on either pans to `lastFix` or, if no fix
  has arrived yet, says *Finding your location…* and leaves the panning to the
  fix that eventually lands.
- **Each fix** stores `lastFix`, keeps the existing first-fix recentre exactly
  as it was, and pans when following. `map.panTo`, not `setView` — that *is*
  "keep the current zoom", spelled as one call, and Leaflet already drops the
  animation when the jump is wider than the viewport.
- **Following ends on `dragstart`.** Not `movestart`: that fires for our own
  `panTo` on every fix, which would switch following off the instant it turned
  on, and it fires for every wheel and pinch zoom, where staying centred on you
  is the whole point. Leaflet's keyboard pan goes through `panBy` and fires
  neither, so arrow keys are handled with a `keydown` listener on the map
  container.

Following starts off, and the boot sequence is untouched: the first fix still
recentres once when no restored trail claimed the view.

## Notes

- The button says nothing about heading. `#compass` (top-right, iOS only) still
  owns the one gesture that unlocks the compass, and the cone still comes from
  `heading.ts`.
- A blocked state can only be left by reloading, because that is the only way
  the browser will ask again. The notice says as much.
