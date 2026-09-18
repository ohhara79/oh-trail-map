# Show the 3D profile cursor as a floating ball while walking

## Context

`2026-09-18-08` draws the profile cursor dot in 3D as a `circle` layer, as the national point
dots in orbit are drawn. While walking, the camera sits at about z21 and national points are no
longer dots. They are 1 m balls floating at eye height (`BALL_RADIUS`, `BALL_HEIGHT`) over a
draped shadow disc. The cursor stayed a 7.5 px dot on the ground, tiny from eye height and the
only marker lying flat. While walking it is now a ball like theirs, in the trail's colour.

## Change

### `src/pointBalls.ts`

- `setCursor(at)` sets or clears one more ball, over the cursor's GPX point, and repaints.
- `render()` keeps one instance slot past the points and appends the cursor's ball there, at
  the same `BALL_HEIGHT` with the same radius and shading, in the trail's colour.
- `pick()` only loops over the points, so the cursor's ball opens nothing, as the orbit dot
  opens nothing.

### `src/scene3d.ts`

- `LAYER_PROFILE_CURSOR_SHADOW` is a draped fill on `SRC_PROFILE_CURSOR`, painted like
  `LAYER_POINT_SHADOW` and hidden in orbit.
- The source now holds both the dot's point and the shadow's disc, so each layer filters on
  its geometry type.

### `src/view3d.ts`

- `setProfileCursor` writes the point and a `circlePolygon` of `BALL_RADIUS`, and passes the
  cursor on to the balls.
- `syncGround` shows the cursor's shadow and hides its dot while walking, as it does for the
  points. The ball layer is already visible only then.

## Trade-offs

- A GPX point right on a national point puts two balls in the same place. They differ in
  colour, and an exact overlap is rare.
- The white ring of the flat dot has no counterpart on the ball. Its colour and shadow mark it.

## Verification

1. `npm run build` passes.
2. `npm run dev`: select a trail, open the profile, and switch to 3D walk. Scrub the profile.
   A ball in the trail's colour floats at eye height over the trail, with a shadow under it,
   and follows the cursor. Ridges hide it. Orbit still shows the flat dot. Playback shows
   neither. Clearing the selection removes both.
