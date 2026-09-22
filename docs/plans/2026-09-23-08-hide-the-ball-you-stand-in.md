# Don't draw a ball you are standing inside

## Context

Leaving 3D playback for walk mode (Esc, or the ✕ on the playback bar) sometimes fills
the whole screen with a flat coloured field, and nothing is visible until you walk away.

That field is the inside of the profile cursor's ball. The camera is **not** moved on
the way out — `setMode('walk')` from playback only does `walker.setPlayback(null)`
(`src/view3d.ts`), and `walker.pose` was already the playback position, so you are left
standing exactly where playback stopped. That is the cause, not a cure:

- A ball is a sphere of `BALL_RADIUS = 1` m centred `BALL_HEIGHT = 2` m over the ground
  (`src/scene3d.ts`), drawn as an instanced WebGL mesh by `src/pointBalls.ts`.
- The walking eye sits at `EYE_HEIGHTS[0] = 1.7` m over the ground, i.e. 0.3 m below
  that centre and well inside the 1 m radius.
- The near plane is only ~0.28 m out (see the `src/firstPerson.ts` module comment), so
  nothing clips the sphere away. You see its interior back faces, edge to edge.

Why the cursor ball is there at all: `applyCursor()` in `src/main.ts` already knows
about this — it passes `null` to `setProfileCursor` while `playbackTrail` is set, "so
the dot would sit on the lens rather than mark anything". But the moment playback ends,
`onPlaybackPoint(null, null)` clears `playbackTrail` while `cursorIndex` keeps the point
playback stopped on, and `applyCursor()` hands that point — your own spot — to the ball
layer.

Only *sometimes*, because the 20 m and 80 m eye heights put you above the ball.

The same hazard needs no playback: free-walk with `W` straight onto a national point and
you end up inside its ball too. Nothing guarded that.

The fix keeps the position exactly as it is, which is the right one to be left at, and
has the ball layer skip any ball whose centre is too close to the eye.

## Change

### `src/pointBalls.ts`

1. **`NEAR_CULL = BALL_RADIUS + 1`**, exported, with the geometry above as its doc
   comment. The margin over the radius drops a ball a stride before you reach it rather
   than at its skin, where it already fills more of the view than it tells you anything.
2. **`setEye(at: {lat, lon, alt} | null)`** on the `PointBalls` type. There is no public
   MapLibre call for the camera's position inside a custom layer's `render`
   (`CustomRenderMethodInput` carries only matrices, and `transform.cameraPosition` is
   `@internal`), so the eye is plumbed in rather than read back. A plain assignment —
   **no `map.triggerRepaint()`**, unlike `setCursor`: it is called every frame, and a
   repaint a frame would keep the map drawing while you stand still. Nothing is lost,
   because the cull can only change when the camera moves, and a camera that moves has
   already jumped the map (`place()` in `src/firstPerson.ts`).
3. **`render()`** puts the eye into the same local metre frame as the instances
   (`origin` / `unit`) and compares squared distances. That frame is the one the shader
   scales `BALL_RADIUS` in, so the threshold means the same thing as the size you see.
   Both the point loop and the cursor ball below it use it.
4. A culled point sets **`grounds[i] = NaN`**, the same as a ball whose terrain has not
   loaded. `grounds` is what `pick()` aims against and is documented as only the balls
   drawn last frame, so the crosshair stops reaching a ball the moment it stops being
   there — no separate test in `pick()`.

### `src/view3d.ts`

- `startWalking`'s `FirstPerson` callback feeds `balls.setEye({...pose, alt})` beside
  `reportCamera`. It runs after `place()`, so `FirstPerson.altitude` is the altitude the
  camera was just put at and the cull matches what is about to be drawn. `startWalking`
  also feeds it once before returning: the flight down finishes with a `jumpTo`, so
  MapLibre has a repaint queued before the walk loop registers its first frame, and
  arriving with a ball under the crosshair would flash its inside for that one frame.
- `stopWalking()` clears it. Orbit draws no balls, but the flight back up runs frames
  with none of the walk loop's, and an eye left behind would cull against where you
  used to stand.
- `nearbyPoint()` skips a point whose ball is culled, after the `inSight` test that
  already uses the ball's centre. Measured in three dimensions to that centre, the way
  the layer measures — a ground distance agrees at eye height and nowhere else, and
  would drop the name at 20 m and 80 m, where you pass right over a point without ever
  being inside its ball and the name is the whole reason to fly over one.

Nothing else moves. `applyCursor()`'s `playbackTrail` guard stays as it is — with the
cull in place, the cursor really does mark the spot you stepped off. The ground shadows
(`LAYER_PROFILE_CURSOR_SHADOW`, `LAYER_POINT_SHADOW`) stay too: a 1 m disc drawn flat on
the terrain blocks nothing and is the only thing left saying "this is the spot". And no
fade: the fragment shader writes `vec4(color, 1.0)` with no blending set up, and by the
time a ball is inside `NEAR_CULL` it covers most of the view, so a fade would be a
full-screen wash rather than a softer edge.

`README.md` gains a sentence in the Walk bullet.

## Verification

- `npm run build` — `tsc --noEmit` plus the bundle. Passes.
- `npm run dev`, load a trail from `data/gpx/`, then:
  - Select it, `Enter` to play it at the 1.7 m eye height, let it run, `Esc`. The view
    is clear; the ball is gone and its shadow is on the ground under you. `S` back a
    couple of metres — the ball appears, in the trail's colour, over its shadow.
  - The same through the ✕ on the playback bar, the other way out.
  - `Esc` out of a *paused* playback and stand still: the ball stays gone, and nothing
    redraws on its own.
  - Cycle to 20 m and 80 m and fly straight over a national point: from up there you
    are never inside its ball, so it stays drawn below you **and keeps its name label**.
  - From orbit, put the crosshair exactly on a national point and press Walk: no
    one-frame flash of colour as the flight down lands.
  - Free walk (`V`, then `W`) straight onto a national point: its ball drops out as you
    reach it instead of swallowing the screen, its name label goes with it, and a tap at
    that moment opens no popup. Back off and both come back.
  - `Esc` to orbit: dots, not balls, and nothing missing near the screen centre.
  - Play a trail that runs close by national points: each drops only when you are on top
    of it, not while it is still worth looking at.
