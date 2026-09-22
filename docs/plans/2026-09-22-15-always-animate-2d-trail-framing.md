# Always animate framing a trail in 2D

## Context

In 3D, `[` and `]` always glide to the next trail. `view3d.fitTrail` calls MapLibre's `fitBounds`, which is a `flyTo` under the hood and animates every time.

In 2D, `zoomToTrail` called Leaflet's `map.fitBounds`, which goes through `setView` and animates only sometimes:

- **The zoom changes by more than 4 levels** (`zoomAnimationThreshold`): the view jumps.
- **The new centre is off-screen**: the view jumps.

So a nearby trail of a similar size glided in, while a far-away one, or one much smaller or larger, snapped.

## Change

1. **`src/main.ts` `zoomToTrail`.** Uses `map.flyToBounds` in place of `map.fitBounds`. It keeps the same `padding` and `maxZoom` cap.
   - It passes `animate: false` under `prefers-reduced-motion`, as `cameraTween.ts` does. Leaflet then falls back to a plain `setView`.
   - Row clicks and the zoom-to-selected key share `zoomToTrail`, so they fly too, as they already did in 3D.

## Verification

1. `npm run build`: typecheck and bundle pass.
2. In 2D, pressing `]` across trails that are far apart, or of very different sizes, flies to each one every time.
3. A trail row click and the zoom-to-selected key also fly.
4. With "reduce motion" on in the OS, the view jumps with no animation.
5. 3D is unchanged.

## Follow-up

In 2D, `;` and `'` (point stepping) still use `map.setView` in `goToPoint`, so they have the same behaviour of animating only sometimes.
