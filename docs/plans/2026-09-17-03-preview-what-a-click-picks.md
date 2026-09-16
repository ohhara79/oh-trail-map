# Preview what a click would pick

## Context

Right now you can't tell what a click will pick before you click:
- **2D:** trails have no hover feedback at all. The picker `trailAt()` chooses the nearest trail within 15px, so a click can land on a trail the cursor isn't visibly on, and where trails overlap you can't tell which one wins. Pins show only a pointer cursor and a slow native `title` tooltip.
- **3D orbit:** the cursor turns into a pointer on `mouseenter` of the 2px rendered line. The click itself uses a ±15px box and takes the *first* `queryRenderedFeatures` result, so the cursor and the click disagree, and the pick among nearby trails is arbitrary.
- **Both views:** while something is selected, a click only clears it. The cursor still suggests you're about to pick something.

Goal: with a mouse, hovering shows exactly what a click would pick:
- a **faint halo** (a lighter selection halo with no pulse) around the trail, or a **ring** around the pin;
- a **name label** next to the cursor;
- a pointer cursor.

The preview must come from the **same pick function the click uses**, so the two can never disagree. It shows nothing when a click would only clear. It is mouse-only: touch has no hover, and walk mode already has the crosshair aim.

## Change

1. **`src/hoverLabel.ts` (new).** `createHoverLabel(container)` returns `{ show(text, x, y), hide() }`. It is one absolutely positioned `<div class="map-hover-label">` with `pointer-events: none`. It sits 12px right and below the cursor, flips left or up near the container edge, and is used by both views. Also export `canHover()`, which checks `matchMedia('(hover: hover) and (pointer: fine)')`.

2. **`src/selection.ts`**
   - Add `HoverHalo`, a sibling of `Halo`. It has one `L.layerGroup` and `show(trail | null)`.
   - It draws a single white casing (`HALO_RINGS[1]` weight, opacity 0.6, `interactive: false`, no `trail-halo` class so there is no pulse) with `bringToBack()`. The trails' z-order is never touched.
   - Add `HOVER_RING` constants (colour, opacity, weight) that the 3D layer shares.
   - Cache each trail's projected pixels per zoom (a `WeakMap`), and have `trailAt` measure against the cache. Hover runs it on every mouse move, and re-projecting ~100k points from lat/lon each time would cost a frame.

3. **`src/points.ts`**
   - Add optional `onPinHover(point | null)` to `createPointsLayer`, wired through marker `mouseover`/`mouseout`. Markers don't bubble `mousemove` to the map, so the map handler has to be told separately.
   - Expose `setHovered(code | null)` to toggle an `is-hovered` class on that marker's icon element.
   - Drop `title`, because the new label replaces it.

4. **`src/main.ts` (2D)**
   - Add `syncHover()`, the single place the 2D preview is derived. It is called through a `requestAnimationFrame` throttle from `map.on('mousemove')`, and it remembers the last `containerPoint`.
   - Rules, in click order:
     - If `!canHover()`, or a popup is open, or `selectedId !== null`: show nothing, because a click only clears.
     - If a pin is hovered: ring that pin, label it `point.name || point.code`, and hide the trail halo.
     - Otherwise: `trailAt(map, lastPoint, trails)` → `hoverHalo.show(hit)`, label `hit.name`, and add a `map-pick` class (cursor: pointer) on the container.
   - Clear the preview on `mouseout`, `movestart`/`zoomstart` and `dragstart`, and at the end of `restyleAll()`, which covers selection and visibility changes.

5. **`src/scene3d.ts`**
   - Add `LAYER_TRAIL_HOVER`, a line layer inserted **before** `LAYER_TRAILS` using `HOVER_RING`. Its filter is `selectedFilter(null)`, which means none.
   - Add `LAYER_POINT_HOVER`, a circle layer inserted before `LAYER_POINTS`. It is a larger white disc (radius `PIN_RADIUS + PIN_STROKE + 2`) with `circle-pitch-scale: 'viewport'`, filtered by `index`.

6. **`src/view3d.ts` (orbit)**
   - Extract `pickAt(x, y): { point } | { trail: string } | null` from the click handler (point within 6px first, then trail within `tolerance()`). The click handler and the hover both call it.
   - Make `trailIn` pick the **nearest** trail, not `[0]`. When the box query returns more than one feature, measure screen distance to each feature's returned geometry (only the tiles in the box), projected with `map.project` and measured with `L.LineUtil.pointToSegmentDistance`. This matches 2D's `trailAt`. `aimedTrail()` benefits too.
   - Add `syncHover()`. It uses the same rules as 2D, gated on `mode === 'orbit' && !tween`, sets the two hover layer filters, the label and the canvas cursor, and is rAF-throttled from `map.on('mousemove')`.
   - Replace the `mouseenter`/`mouseleave` cursor loop (`view3d.ts:466-471`) with this.
   - Clear the preview on `mouseout`, `movestart`, `setMode`, `openPopup`/`closePopup` (and the popup's own `close`), and in `syncTrails`/`syncPoints`.
   - `setBasemap` re-adds the basemap before `LAYER_TRAIL_HOVER`, now the lowest trail layer.

7. **`src/style.css`**
   - Add `.map-hover-label`: small pill, readable on satellite (dark translucent background, white text), `max-width: 320px` with wrapping (trail names are long), `z-index` above panes and below popups.
   - Add `.point-pin.is-hovered .point-pin-body` with an extra outer ring (e.g. `filter: drop-shadow` or a thicker white stroke).
   - Add `.map-pick { cursor: pointer }` on the Leaflet container.

8. **`README.md`:** add a Features bullet near the click rules (lines ~40-50): hovering with a mouse previews the trail or point a click would pick.

9. Save this plan as `docs/plans/2026-09-17-03-preview-what-a-click-picks.md`.

## Verification

- `npm run build` passes.
- `npm run dev`, then check **2D**:
  - Move near a trail (within ~15px, not on it): the faint halo, the trail name and a pointer cursor appear. Moving away clears them.
  - Where two trails run close: the label switches as you move toward each one, and clicking selects the one labelled.
  - Hover a pin lying on a trail: only the pin ring and the pin name show. Clicking opens that pin.
  - Select a trail, then hover anything: no preview, and a click just clears.
  - Drag or zoom: the preview disappears and comes back on the next move.
- **3D orbit:** the same checks. Also confirm that where trails overlap, the labelled (nearest) trail is the one selected.
- **3D walk/playback:** no label or hover layers. The crosshair aim is unchanged.
- **DevTools phone emulation (coarse pointer):** no preview ever appears, and taps behave as before.
