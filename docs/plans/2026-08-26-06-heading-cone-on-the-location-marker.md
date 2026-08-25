# A heading cone on the location marker

## Context

The map could say where you are and nothing about which way you were pointing:
`startLocating()` drew an `L.circleMarker` — a bare blue disc — and read exactly
three fields off each fix, `latitude`, `longitude` and `accuracy`. The request
was to turn that dot into something that also shows the current direction.

Direction has two possible sources and neither is sufficient on its own, which
is the whole design problem here.

`position.coords.heading` was already arriving free on every fix and was simply
being ignored. It is also null whenever you are standing still, and null on
essentially every desktop browser, so an arrow driven by it alone would be blank
in most of the moments you are actually looking at the screen — including the
moment right after you open the app, which is when the feature would be judged.

The device compass answers while stationary, which is the case that matters, but
it is gated: iOS 13+ will not deliver `deviceorientation` at all until
`DeviceOrientationEvent.requestPermission()` has been called *from a user
gesture*, and there was no gesture anywhere in this app that could carry one.

So the answer taken to the user, and agreed with them, was both: compass first,
GPS course behind it, and a button that exists only where a grant is needed.
The visual was settled the same way — keep the dot exactly as it was and add a
translucent cone, so that "no heading available" degrades to the app's current
appearance rather than to a broken-looking arrow stuck pointing north.

## Change

### 1. `src/heading.ts` — new, and deliberately Leaflet-free

It answers "which way", and `map.ts` decides what to draw with the answer. Three
exports: `compassNeedsPermission()`, `requestCompassPermission()`, and
`startHeading(cb)` returning `{ pushFix, stop }`.

Both orientation events are listened to, because the two engines disagree about
which one to fire. Chrome emits `deviceorientationabsolute` carrying a true-north
`alpha`; Safari emits only `deviceorientation` and puts the bearing in the
non-standard `webkitCompassHeading`. `bearingOf()` prefers the webkit field, and
otherwise **rejects anything without `absolute === true`** — a device-relative
`alpha` is measured from wherever the phone happened to be when the page loaded,
which is worse than showing no cone at all. That guard is why subscribing to
both events cannot leak a meaningless reading.

The two conversions worth recording:

- `alpha` runs counter-clockwise from north and a compass bearing runs
  clockwise, hence `360 - alpha`.
- The browser rotates the orientation frame along with the page, so a phone held
  sideways reports a heading turned by the same amount; `screen.orientation.angle`
  is added back to undo it. Optional-chained, because older Safari has no
  `screen.orientation`.

Arbitration between the two sources is a **latch, not a per-sample comparison**.
Any compass event stamps `lastCompass`; a GPS course is only emitted once the
compass has been silent for 5s. Since `deviceorientation` fires at tens of hertz,
a real compass wins permanently and the two can never trade the cone back and
forth on alternating samples. GPS course is additionally dropped below 0.6 m/s —
under a slow walk the fix wanders a few metres between samples and the reported
bearing spins with it.

Events are folded into one pending value and flushed on `requestAnimationFrame`,
with sub-degree changes discarded, so a phone lying on a table costs nothing
rather than sixty style writes a second.

`requestCompassPermission()` is a free function rather than a method on a handle
because `new Ui({...})` is built long before `startLocating()` is called, and the
button's callback needs something to call at construction time. On a grant it
re-attaches the listeners of every live `startHeading()`, so the already-running
watch starts receiving events without being torn down and rebuilt.

### 2. `src/map.ts` — the dot becomes a divIcon marker

The `circleMarker` became an `L.marker` carrying an `L.divIcon`: an SVG wedge in
a `.locate-rotor`, then a `.locate-dot` styled to match the old disc exactly
(12px of blue inside a 2px white ring, which is what `radius: 6` plus
`weight: 2` drew). The accuracy `L.circle` was not touched.

A vector path could not have done this — the cone has to rotate, and rotation is
a CSS transform on an HTML element, not something a Leaflet path option can
express. Three consequences fell out of the switch:

- Marker icons live in `markerPane`, above the `overlayPane` that every trail
  shares. That **fixes a real defect in passing**: `Halo.show()` calls
  `bringToFront()` on the selected trail (`src/selection.ts:76-77`), which used
  to raise trails *over* the location dot, because everything vector shares one
  `<g>` and z-order there is DOM order.
- `interactive: false` was set. The old `circleMarker` was interactive by
  default and could swallow a click meant for the map handler — the same hazard
  the halo already avoids at `src/selection.ts:65`. Hit-testing is geometric
  (`trailAt`), so nothing is lost by opting out.
- `className: 'locate-icon'` replaces Leaflet's default `leaflet-div-icon`,
  whose white box and grey border would otherwise frame the whole marker.

The rotation carries the one genuinely subtle piece of arithmetic. A CSS
transition from `rotate(350deg)` to `rotate(10deg)` spins 340° *backwards*, so
the angle written to the DOM is an **unwrapped accumulator** that only ever moves
by the shortest signed step:

```ts
const delta = ((((next.degrees - displayed) % 360) + 540) % 360) - 180;
displayed += delta;
```

`displayed` is free to drift past 360 or below 0 — that is the point of it.

`applyHeading` is also called once from the first fix, because
`marker.getElement()` returns null until the marker is on the map and a compass
reading can easily arrive before the first GPS fix does.

`LocateCallbacks` did not change; no consumer needs the heading.

### 3. The button

`#compass` sits top-right in `index.html`, `hidden` by default, clearing both the
panel on the left and the zoom control bottom-right. `src/main.ts` reveals it
only when `compassNeedsPermission()` is true — iOS 13+ and nowhere else, since on
every other platform there is either nothing to ask or no compass to ask about,
and an inert button would be worse than none.

On a grant the button is hidden: there is nothing left to ask. On a denial it
stays, with an error notice, because iOS will not prompt again in the same page
load and the button is the only route back after a reload.

## Files

| File | Change |
|------|--------|
| `src/heading.ts` | **new** — compass/GPS arbitration, iOS permission, rAF throttling |
| `src/map.ts` | `circleMarker` → `divIcon` marker with cone; `interactive: false`; heading fed from the watch and stopped with it |
| `src/style.css` | `.locate-icon` / `.locate-rotor` / `.locate-cone` / `.locate-dot`, `#compass`, plus reduced-motion and coarse-pointer entries |
| `index.html` | `#compass` button, initially `hidden` |
| `src/ui.ts` | `#compass` element, `onCompass` callback, `setCompassButton()` |
| `src/main.ts` | wires `onCompass`, reveals the button when `compassNeedsPermission()` |

## Verification

1. `npm run build` — passes. `tsc --noEmit` runs first and is the real check on
   the `webkitCompassHeading` typing, which is declared as a local intersection
   rather than a global augmentation so no other module sees a Safari-only field.
2. The heading module was exercised directly under DOM stubs (bundled with
   esbuild, driven from Node), 20 assertions, all passing:
   - `webkitCompassHeading` preferred over `alpha`; absolute `alpha` converted
     clockwise (alpha 90 → bearing 270); a non-absolute `alpha` rejected outright.
   - `screen.orientation.angle` folded in — at angle 90, alpha 90 → bearing 0.
   - sub-degree jitter suppressed; a 40-event burst collapsing to a single
     emission carrying the last value, and nothing emitted before the frame ran.
   - the latch: a live compass blocking GPS course entirely, GPS taking over only
     after the 5s timeout, course dropped below walking speed, null course
     clearing the cone, unknown speed still accepted.
   - `stop()` detaching both listeners.
   - the rotation accumulator: 0→350 stepping back 10 rather than forward 350,
     350→10 stepping forward 20 rather than back 340, and the accumulator
     staying unwrapped (−10) across the wrap.
3. Confirmed against Leaflet's own source that `_setIconStyles` produces
   `class="leaflet-marker-icon locate-icon"` and applies `width`/`height` from
   `iconSize` and negative margins from `iconAnchor`, and that
   `.leaflet-marker-icon` is `position: absolute` — which is what makes the
   absolutely-positioned cone and dot centre on the anchor.
4. Confirmed `src/export.ts` draws tiles and trail polylines only, so neither the
   dot nor the cone can reach an exported PNG or SVG.

### Not yet verified — needs a device

Browser automation was unavailable in the session that made this change, so the
following were reasoned through and typechecked but never watched on real
hardware. They are the first things to check:

- **The cone on screen at all**, on desktop, where the expectation is that it
  never appears and the marker looks exactly as it did before.
- **Rotation across north**, walked through in both directions — the accumulator
  is unit-tested, but not the CSS transition reading it.
- **Landscape.** If the cone is off by exactly 90°, the `screenAngle()` term has
  the wrong sign. This is the one piece of the compass math that cannot be
  settled without a phone, and it is the single most likely thing to be wrong.
- **The iOS grant button**, end to end.
- **Click-through**: with a trail selected and the marker sitting on top of it,
  the marker should now draw above the trail *and* still let the click reach
  `trailAt()`.

## Follow-up

- The 5s compass timeout and 0.6 m/s speed floor are judgement calls, not
  measurements. If the cone flickers off while walking slowly, the speed floor
  is the dial to turn.
- The cone shows heading but not confidence. A compass reading indoors can be
  20-30° out with no indication; the `data-heading` attribute already records
  which source is in play (`compass` or `gps`), so widening the cone for a
  low-confidence source is a small change if it ever matters.
- Nothing rotates the *map* to match. That is a much larger change — the
  exporter assumes a north-up viewport — and was not asked for.
