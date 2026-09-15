# The 3D compass is only a button

## Context

Every other icon works like a plain button. If you press it, drag off and release,
nothing happens. The 3D compass didn't work that way. MapLibre's `NavigationControl`
attaches a `MouseRotateWrapper` to its compass button. That wrapper listens for
`mousedown` / `touchstart` on the button, then `mousemove` / `touchmove` on `window`,
and turns the drag into `setBearing` / `setPitch`. So pressing the compass and dragging
away turned and tilted the map.

Goal: the compass only resets north and pitch. Press and release on it resets the
camera. Press, drag off and release does nothing.

## Change

**`src/view3d.ts`**: keep the compass `NavigationControl` in a variable and call
`compass._handler.off()` right after `addControl`. `_handler` is declared in MapLibre's
published `maplibre-gl.d.ts`, so this type-checks. `off()` removes the wrapper's
listeners. `onRemove` calls it again on `map.remove()`, and that second call does
nothing.

What remains is the button's own `click` listener (`resetNorthPitch`). The browser fires
it only when press and release both land on the button. A touch that moves past tap
slop fires no click. Tapping on touch still works: the native tap click takes over from
the wrapper's synthetic `element.click()`.

## Verification

- `npm run build` passes.
- `npm run dev`, 3D Orbit:
  - Rotate or tilt the map, then click the compass: it resets north and pitch.
  - Press the compass, drag well outside it, release: nothing moves or resets.
  - On touch, a tap resets, and a drag off the button does nothing.
