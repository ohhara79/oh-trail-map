# Serve the 관악산 map tiles from data/

## Context

The app fetched its tiles from three outside services at run time: OSM Standard
(`tile.openstreetmap.org`), OpenTopoMap (`{a,b,c}.tile.opentopomap.org`) and AWS Terrain Tiles
(`s3.amazonaws.com/elevation-tiles-prod`). The last one feeds both the 3D ground and the 2D
elevation readout. Making the app public would put its traffic on two volunteer-run tile servers
with usage policies. The app only ever shows 관악산, so instead everything it needs for one fixed
box is downloaded once into `data/tiles/`, and the app reads those files.

The box is lat 37.39–37.49, lon 126.90–127.00: the mountain with a margin.

Out of scope for now: Esri satellite stays remote, and on-map credits are handled separately.

Decisions:
- **OSM Standard is rendered on this machine.** OSM's tile policy forbids bulk-downloading z17+
  from `tile.openstreetmap.org`, and this box needs about 36k tiles to z19. The same style
  (osm-carto) runs in Docker from Geofabrik data, so the tiles look the same and OSM's servers
  carry none of the load.
- **OSM goes to z19**, the same native depth as before.
- **OpenTopoMap is downloaded slowly**: 1 request a second per worker, resumable, with an
  identifying User-Agent.

A user's phone downloads the same tiles as before, from one host instead of four. The tiles are
fetched by URL, not bundled, so opening the app costs no more than it did.

| Layer | Zooms | Tiles | Size |
|---|---|---|---|
| OSM (local render) | 0–19 | 36,244 | ~0.5 GB est. |
| OpenTopoMap | 0–17 | 2,388 | ~70 MB est. |
| Terrain (terrarium) | 0–15 | 184 | 15 MB |

## Change

1. **`scripts/fetch-tiles.py`** (new, Python stdlib). Downloads every z/x/y tile over the box for a
   zoom range into `--out/{z}/{x}/{y}.png`.
   - Takes a `{s}` template with `--subdomains`, plus `--delay` and `--workers`.
   - Skips tiles already on disk, so an interrupted run resumes.
   - Writes each tile to a `.part` file and renames it, so a half-written tile is never mistaken
     for a finished one.
   - Retries a failed tile once.
   - Prints per-zoom counts.

2. **`scripts/render-osm.sh`** (new). Runs `overv/openstreetmap-tile-server`.
   - Downloads Geofabrik's `south-korea-latest.osm.pbf` into `~/.cache/oh-trail-map`.
   - Imports it with `OSM2PGSQL_EXTRA_ARGS="--bbox 126.88,37.37,127.02,37.51"`. This is slightly
     wider than the box so roads and labels crossing its edge still render whole.
   - Serves tiles on `localhost:8080` for `fetch-tiles.py`. `stop` shuts it down.
   - `DOCKER="sudo docker"` for a user outside the docker group.
   - It's a one-time job: the app never needs Docker.

3. **`src/basemaps.ts`**
   - New `TILE_BOUNDS` (`[west, south, east, north]`) and `inTileBounds(lat, lon)`.
   - New `local` flag on `Basemap`.
   - OSM and OpenTopoMap now point at `data/tiles/{osm,topo}/{z}/{x}/{y}.png`. OpenTopoMap loses
     its subdomains.

4. **`src/map.ts`**
   - The two duplicated `L.tileLayer(...)` calls become `tileLayerFor(source)`.
   - It passes `bounds` for a local source, so Leaflet never asks for a tile outside the box
     (it would 404).

5. **`src/scene3d.ts`**
   - `basemapSource()` and `demSource()` resolve tile URLs against `document.baseURI`, because
     MapLibre fetches from a worker. `absolute()` puts back the `{z}` braces that `URL` escapes.
   - Both pass `bounds: TILE_BOUNDS`. The basemap source does this only when it's local.

6. **`src/dem.ts`**
   - `DEM_TILES` is `data/tiles/terrain/{z}/{x}/{y}.png`.
   - `cachedElevation` and `loadElevation` answer `null` outside the box without fetching.

7. **`vite.config.ts`**
   - The dev server already serves `data/tiles/` from the project root.
   - A small `copy-tiles` build plugin copies it into `dist/data/tiles/` on `closeBundle`, since
     `vite build` copies only `public/`. Tens of thousands of PNGs don't belong in the module
     graph the way the GPX files and TSV are bundled.
   - `appType: 'mpa'`: the default SPA fallback answered a missing tile with `index.html` and a
     200, which a cache could keep in place of the PNG. A missing tile is now a 404.

8. **`README.md`**
   - The basemap bullet notes the local box. The terrain notes drop the OSM tile-policy caution.
   - A new *Map tiles* section lists the commands to make or refresh `data/tiles/`.

## Verification

1. `scripts/fetch-tiles.py` for terrain: 184 tiles, z15 = 120. A second run reports every tile as
   already there.
2. OpenTopoMap fetch: 2,388 tiles, z17 = 1,748.
3. `scripts/render-osm.sh`, then open the sample z17 tile it prints and check the Korean labels by
   eye. Then the OSM fetch: z19 = 27,048. Then `scripts/render-osm.sh stop`.
4. `npm run dev`, with the DevTools Network tab filtered to `openstreetmap|opentopomap|amazonaws`:
   - The filter shows no requests while panning 2D on OSM and OpenTopoMap, zooming to z22,
     orbiting and walking in 3D, and using the readout.
   - Outside the box the map is blank, with no 404s, and the readout shows no elevation.
5. The readout at 관악산 정상 gives the same elevation as before the change (same SRTM data).
6. `npm run build && npm run preview`: `dist/data/tiles/{osm,topo,terrain}` exist, and step 4
   passes against the preview.
7. Satellite still loads from Esri.

## Follow-up

- Credits for OSM, OpenTopoMap and the terrain sources.
- Satellite: drop it or replace it.
- `data/tiles/` (~0.5 GB): decide whether to commit it, git-ignore it, or keep it untracked like
  `data/gpx/`.
- Hosting: serve `data/tiles/` with a long `Cache-Control` (e.g. `public, max-age=2592000`) so
  phones reuse tiles across visits.
- 3D walk mode looking past the box shows fog over blank ground. A wider low-zoom ring (z8–12)
  would fill it if that bothers you.
