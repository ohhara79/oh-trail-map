# Steady profile cursor dot in 3D

## Context

Moving the elevation profile's cursor puts a dot on the trail at that GPX point. In 2D the dot
is always solid. In 3D it switched between solid and faint as the cursor or camera moved.

The cause is in MapLibre (6.9.0), `Marker._updateOpacity`. With terrain on, it compares the
marker's camera depth with a terrain depth sample at the marker's pixel, using a 0.006
tolerance. If the marker seems to be behind the ground, it drops to `opacityWhenCovered`
(default 0.2). The dot stands exactly on the terrain, so the test z-fights: it flips between
1 and 0.2.

One alternative was drawing the dot a little above the ground. It was not taken: a `Marker` has
no altitude, because it always takes its height from the terrain. A pixel offset would move the
dot off the trail. A WebGL dot like `pointBalls.ts` would work but is far more code.

## Change

### `src/view3d.ts`

The profile marker is created with `opacityWhenCovered: 1`, so it is always fully drawn, like
the 2D `ProfileCursor`. The comment above it explains why. Side effect: the dot also shows
through a ridge standing in front of it. This matches 2D, where the dot is never hidden.

### Untouched

- The location marker keeps MapLibre's default fading.

## Verification

1. `npm run build` passes.
2. `npm run dev`: select a trail, open the profile, switch to 3D, tilt, and move the cursor
   along the profile and orbit the camera. The dot stays solid. 2D is unchanged.
