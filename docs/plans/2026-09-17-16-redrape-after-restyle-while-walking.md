# A trail selected while walking shows at once

## Context

In 3D walk mode, tapping a trail selects it (`onSceneTap` → `opts.onSelect` →
`syncTrails()` in `src/view3d.ts`). That changes the filters of the halo and
`trail-selected` layers and the data-driven `line-opacity` of `trails`. But the highlight
often did not show until you had walked a while. Orbit was fine.

**Cause: a MapLibre 6.9.0 bug.** With terrain on, `line` and `fill` layers are drawn
into textures cached per terrain tile (`webgl/render_to_texture.ts`). A restyle reloads
the trail source's tiles. As each one arrives, `Map._handleTerrainDataEvent` calls
`terrain.tileManager.releaseRTT(tile.tileID)` to drop the textures under it. It matches
the tiles with `OverscaledTileID.equals` / `isChildOf`, which compare `overscaledZ`:

- The walk camera sits at about z21. The trails GeoJSON source stops at its default
  maxzoom of 18, so its tile there is overscaled: `overscaledZ 21`, canonical z18.
- Terrain tiles are never overscaled: `overscaledZ 21`, canonical z21.
- They are not equal, and neither is a child of the other, so **nothing is released**.
  A filter change leaves the texture fingerprint alone (tile keys, feature-state
  revision, zoom and visible layers), so the old texture stays until you walk onto new
  terrain tiles. Orbit mostly stays below z18, where the ids match.

Any draped source past its maxzoom has the same problem, including a hidden point's ball
shadow and the location accuracy circle.

## Change

### `src/view3d.ts`

1. A **`sourcedata` listener** does the release MapLibre misses. For a loaded tile that
   is overscaled, it calls `releaseRTT(id.scaledTo(id.canonical.z))`. That id has
   `overscaledZ` equal to its canonical z, so `releaseRTT`'s own equals / isChildOf
   now match every terrain tile that overlaps it. That is the same overlap
   `getTerrainCoords` uses to draw it. MapLibre already handles tiles that are not
   overscaled, and it already asks for a repaint for the loaded tile.

   Every call is public API: `map.terrain`, `tileManager.releaseRTT`, `e.coord`,
   `isOverscaled` and `scaledTo`. It only runs when an overscaled draped tile loads,
   which is after a restyle, on walking into a new z18 tile (about 120 m), or on
   changing eye height.

## Files

| File | Change |
|---|---|
| `src/view3d.ts` | A `sourcedata` listener releases the terrain textures under overscaled tiles |

## Verification

1. `npm run build` passes.
2. `npm run dev`, with a trail from `data/gpx/` loaded, open **3D** → **Walk**:
   - Standing still, aim at a trail within reach and tap. Its casings and the dimming
     of the other trails show at once. Tap again, and the highlight clears at once.
   - The same at each eye height (1.7 / 20 / 80 m).
   - Hiding a national point in the panel list while walking removes its shadow at once.
   - Walking still looks smooth when crossing tiles.
3. In orbit, zoomed past z18, selecting and clearing a trail still update at once.
