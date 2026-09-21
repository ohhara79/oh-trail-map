# A small crosshair in 2D and 3D, and a lat / lon / elevation readout

## Context

The 3D crosshair (`#crosshair3d`, index.html:166) is a 28px white ring with four ticks
and a dot. It only shows in 3D (`#app[data-mode3d]`). The user wants:

1. A **small, semi-transparent cross** instead.
2. The **same crosshair in 2D**, marking the map centre.
3. A **lat / lon / elevation readout**: of the crosshair in 2D and in 3D orbit, and of
   where you are standing in Walk and playback.

Decided with the user: the readout is a small see-through pill at the **top centre**
(under the Walk bar in 3D), and 2D gets elevation by **fetching the same AWS terrarium
DEM tiles** 3D already uses.

## Change

### 1. `index.html` — one crosshair and one readout, on the stage

- Move the crosshair out of `#hud3d` into `#stage` (after `#minimap-you`) and rename it
  `#crosshair`. New markup: a 16px plus sign, no ring, no dot:
  `<svg viewBox="0 0 16 16" width="16" height="16">` with `<path d="M8 1v14M1 8h14"/>`,
  `stroke="currentColor" stroke-width="1.5" stroke-linecap="round"`.
- Add `<div id="readout" aria-live="off"></div>` in `#stage`, next to it.

### 2. `src/style.css`

- Replace the `#crosshair3d` block (style.css:924–935) with `#crosshair`: always
  `display: block` (2D and every 3D mode), 16×16 centred with the same
  `translate(-50%,-50%)`, `z-index: 900` (over Leaflet's panes ≤700 and the GL canvas,
  under the 1000 controls), `color: rgba(255,255,255,.75)`,
  `filter: drop-shadow(0 0 1px rgba(0,0,0,.6))` so it reads on a light 2D basemap and a
  bright sky, `pointer-events: none`. Keep and update the comment above it (orbit: where
  Walk will put you; walk: what a tap aims at; 2D: the spot the readout names).
- `#readout`: absolutely positioned, `left: 50%; transform: translateX(-50%)`,
  `top: calc(12px + env(safe-area-inset-top))` in 2D and
  `top: calc(54px + env(safe-area-inset-top))` under `#app[data-view='3d']` (#mode3d is
  12 + 34px, plus an 8px gap). Same see-through look as the other HUD bars
  (translucent white ground, small radius), 12px tabular-nums text, `white-space: nowrap`,
  `pointer-events: none`, `z-index: 950`. Empty → `display: none` (`:empty`).
- Add `#readout` to the `data-chrome='hidden'` selector (style.css:662) so a tap during
  playback clears it with the rest of the chrome.

### 3. `src/dem.ts` (new) — terrain elevation without MapLibre

- Move `DEM_TILES` and `DEM_MAX_ZOOM` here from `src/scene3d.ts:50–51`, exported;
  `scene3d.ts` imports them (keeps `dem.ts` free of maplibre so the 2D bundle stays lean).
- `cachedElevation(lat, lon): number | null | undefined` — synchronous lookup;
  `undefined` = not asked for yet or on its way, `null` = its tile failed in the last
  30 s (`RETRY_AFTER`), so a map dragged about offline does not fetch on every move.
- `loadElevation(lat, lon): Promise<number | null>` — fetches the z15 tile (`fetch` →
  `createImageBitmap` with no premultiply or colour conversion → canvas
  `getImageData`), keeps the decoded pixels in a 32-tile LRU, and dedups in-flight
  requests. A failed request is retried once a second later: headless Chrome
  emulating a phone cancelled the very first DEM request of every cold load
  (`net::ERR_ABORTED`, reproducible, gone with any change in timing), and a flaky
  mobile connection drops one now and then too.
- `elevationTile(lat, lon)` — the tile's key, so `read2d` can drop a late answer for
  a spot the map has since left.
- Decode terrarium: `R*256 + G + B/256 − 32768`, nearest pixel of the 256px tile
  (≈4.7 m at z15 around Seoul; the source is ~30 m SRTM anyway).

### 4. `src/view3d.ts` — report what the readout names

- New option `onReadout: (at: { lat: number; lon: number; ele: number | null }) => void`
  on `View3dOptions` (next to `onCamera`, view3d.ts:114).
- In the existing `map.on('render', …)` (view3d.ts:562), after `liftPopup`: the spot is
  `walker.pose` in walk/playback, else `map.getCenter()` (orbit — the crosshair's spot);
  `ele = map.queryTerrainElevation([lon, lat])` (falls back to `walker.groundHeight` while
  walking). Round to the readout's precision (5 decimals, whole metres) and emit only when
  that key changes — the same guard `reportCamera` uses. Rendering is also what fires as
  finer terrain tiles arrive, so the elevation settles without a move.
- Comments only: view3d.ts:492–495 ("a little wider than the crosshair's 7px ring") and
  527–529 ("inside the crosshair's ticks … not only its ring") now describe a 16px cross
  with 7px arms; the 8px / 12px pads stay.

### 5. `src/ui.ts` — `setReadout`

`setReadout(at: { lat; lon; ele: number | null | undefined } | null)`: writes
`37.45679, 126.98765 · 432 m`; `ele === undefined` → `· … m` (loading), `null` → no
elevation part; `null` clears the pill. Same formatting style as `profilePanel.ts:270`
(`toFixed`, ` · ` separator).

### 6. `src/main.ts` — who feeds it

- 2D: `map.on('move', read2d)` plus once at startup. `read2d` returns early while
  `view3d` is open (the 2D map is only the minimap then). It takes `map.getCenter()`,
  calls `ui.setReadout` with `cachedElevation`; if that is `undefined`, it calls
  `loadElevation` and, when it resolves, re-runs `read2d` only if the centre is still in
  that tile (a sequence counter drops stale answers).
- 3D: `onReadout: (at) => ui.setReadout(at)` in `createView3d` (main.ts:423).
- `close3d()` calls `read2d()` after the `setView` so the pill switches back at once.

### 7. `README.md`

A Features bullet for the crosshair and the readout, and that in Walk/playback it is
where you stand.

## Verification

1. `npm run build` passes (type-check included).
2. `npm run dev`, 2D: a small translucent cross sits at the map centre; the pill at top
   centre shows lat/lon updating while dragging, elevation appearing after a moment
   (`… m` first), matching roughly the 3D value at the same spot. Over the sea it shows
   ~0 m; offline it shows lat/lon only.
3. 3D orbit: same cross, pill under the Walk bar, elevation of the ground under the cross.
4. Walk: the pill follows where you stand as you move (not what the cross looks at);
   tapping a point/trail with the cross still picks it. Playback: pill follows the
   playing position; tapping the scene hides pill with the rest of the chrome, tapping
   again restores it.
5. Close 3D: pill jumps back to the 2D centre immediately.
6. Headless Chrome against `npm run preview` at 320×568, 390×844, 844×390 and 1280×800:
   the pill clears `#expand` and `#view3d` in 2D and `#mode3d` in 3D, the cross is
   centred in `#stage` in both views, and nothing scrolls horizontally.

Measured (CDP-driven headless Chrome, swiftshader GL): at 320×568 the pill spans
87–233px in 2D, between `#expand` (ends 46) and `#view3d` (starts 276), and 62–258px at
top 54 in 3D, under `#mode3d` (bottom 46). The cross is centred in `#stage` to the pixel
at every size, including 1280×800 with the side panel open. Over Gwanaksan the 2D
readout says 462 m and walking on the same spot 461 m; orbit reads 447–452 m from its
coarser terrain tiles.
