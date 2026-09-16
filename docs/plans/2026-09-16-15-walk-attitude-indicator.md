# An attitude disc for 3D walk and playback

## Context

Orbit has an orientation widget — MapLibre's `NavigationControl` compass
(`src/view3d.ts:183`), stacked above `#locate`. Walk and playback have none, because
`src/style.css` hides the whole `.maplibregl-ctrl-bottom-right` group in those two modes;
the compass went out with the zoom buttons, which really are meaningless at eye height.

Two things are missing as a result, and the second is the bigger one.

**Which way am I facing.** At eye height you see a 50° cone (`WALK_FOV`) of SRTM terrain
with no trees or buildings, so every ridge looks like the last. Bearing is the one cue the
view cannot give you, and you turn far more in walk — mouse-look, gyro, joystick, the trail's
tangent — than you ever do in orbit.

**Am I looking up or down.** Orbit gets this free from `visualizePitch`. Walk has no pitch
cue at all except the horizon, and with `look` clamped to −80…60 (`src/firstPerson.ts`) you
can be looking at nothing but sky or nothing but ground with the true horizon off-screen.
Nor is there a way back to level: `frame()` drifts the tilt back **only during playback**,
walk keeping the one you chose, deliberately and for good — including while following your
location. On a mountain the visible skyline sits well above true level, so the terrain
cannot stand in for it.

Reusing MapLibre's compass was never an option, whatever the group did. It draws itself
with `scale(1/√cos(pitch)) rotateX(pitch) rotateZ(-bearing)`, and walking sits at
`look ≈ 0`, which is MapLibre pitch ≈ 90°: `cos` is 0, the scale term goes to infinity and
the disc turns edge-on. Degenerate there, not merely ugly.

## Change

**`index.html`.** A `#attitude3d` button inside `#hud3d`, holding a 26px svg on a
`-16 -16 32 32` viewBox: a clipped face circle over a `.attitude-ball` group (sky rect,
ground rect, horizon line) that translates with `--tilt`, a pale rim, and a `.attitude-card`
group carrying a dark north and pale south triangle that rotates with `--yaw`. A fixed
centre reference — two ticks and a dot — is the part that does not move, and the horizon is
read against it.

The card's triangles clear the rim rather than sit on it: touching it, the dark north one
merges into the stroke and stops reading at a glance. The rim is pale for the same reason —
a rim as dark as the triangle competes with it for the eye. Both were settled by rendering
the variants side by side rather than by argument.

**`src/style.css`.** `#attitude3d` joins the shared floating-button rule, so it takes the
same 34px box, border and radius as `#expand`/`#compass`/`#locate`/`#view3d` and cannot
drift from them. It sits at `right: 10px; bottom: 128px` — measured to land on the orbit
compass's box exactly, so nothing in that column moves when Walk is toggled and the two read
as one instrument. Shown only for `data-mode3d` of `walk` or `playback`, and added to both
chrome-fade lists so it fades with everything else during playback (keep in sync with
`CHROME` in `hud3d.ts`).

Deliberately *not* `.walk-only`: that class's `display: inline-block` outranks the shared
rule's `flex`, which is what centres the svg.

**`src/hud3d.ts`.** `setAttitude(yaw, look)` writes the two custom properties, rounding and
comparing first — it is called every frame, the way `place()` guards its camera. The card
turns against you, a compass card holding still while you turn under it. `PITCH_SPAN = 45`
maps the tilt to the face: past that it is solid sky or solid ground, which is the right
reading, while the full −80…60 clamp would flatten a few degrees off level to almost
nothing.

**`src/view3d.ts`.** Fed from the `onFrame` callback, above the playback branch that
returns early — plain walk needs the disc most, and would otherwise never be updated.
`onAttitude` calls `walker?.recentre()`.

**`src/firstPerson.ts`.** `recentre()` swings the view to north and level, expressed in the
module's own base+offset terms: the base is not ours to change, so the offsets ease to
whatever cancels it. That is the same lever looking around by hand pulls, so the swing ends
the same way — free walk stays at north, following your location drifts back to your
heading, playback drifts back to the trail ahead, each after `LOOK_HOLD_MS`. The drift is
held off while a recentre runs, or the two pull opposite ways.

| Mode | `baseYaw` | After the press |
|---|---|---|
| Free walk | 0 | North, and stays: both offsets land at 0 and nothing drifts. |
| Walk, following your location | `headingYaw` | North, then back to your heading. |
| Playback | `followYaw` | North and level, then yaw back to the trail's tangent. The tilt stays level — the trail never sets one. |

The swing is bounded by `RECENTRE_LIMIT` counted in `dt`, not against the clock. `smooth()`
is frame-rate independent only while `dt` is the real elapsed time, and below ten frames a
second `MAX_DT` throws the rest away; a wall-clock limit would then cut the swing off
part-way and leave the view pointing nowhere in particular. This was not theoretical — the
first version did exactly that under software rendering.

With the gyroscope on the press is inert: the phone owns the direction and there is nothing
to hold the view at.

## Verification

`npm run build` passes. Driven in a real browser over CDP, against the live 3D view:

- Orbit's compass box and the walk disc's box are both `[right 1090, bottom 493, 34, 34]` —
  the same slot to the pixel, so nothing jumps when Walk is toggled. Orbit shows the compass
  and hides the disc; walk and playback the reverse; Escape swaps them back.
- The disc tracks every frame: dragging up and left gave `--yaw: -297.5deg / --tilt: 7px`,
  down and right `-350deg / -3px`.
- Pressed in free walk from 292.5° and 8px, it arrived at north and level and held there.
- Pressed during playback it swung from the tangent to north, held, then drifted back to the
  tangent — the behaviour the table above describes.
- During playback the disc fades with the rest of the chrome (`opacity: 0`,
  `visibility: hidden`).

Not covered by that pass, and worth a look on a phone: the disc against the joystick and
`#selection-bar` at coarse-pointer sizes, and the gyroscope making the press inert.

One thing the pass turned up that is **not** from this change: during playback, a tap on the
scene selects the aimed trail instead of bringing the chrome back, because `onSceneTap`
reaches `hud.tap()` only when nothing is aimed, and playback walks with the trail under the
crosshair. Confirmed identical on unmodified code.
