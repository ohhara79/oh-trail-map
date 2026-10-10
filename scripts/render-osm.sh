#!/bin/bash
#
# Render the OSM Standard tiles for the app's box on this machine, with the same
# style tile.openstreetmap.org uses (osm-carto, in overv/openstreetmap-tile-server).
# OSM's tile policy forbids bulk-downloading z17+ from their servers, so the copy
# under data/tiles/osm/ comes from here instead.
#
# One-time job: once fetch-tiles.py has saved the PNGs, the app needs none of
# this. Re-run only to pick up newer OSM data.
#
#   scripts/render-osm.sh            # import, then serve on localhost:8080
#   DOCKER="sudo docker" scripts/render-osm.sh
#   scripts/render-osm.sh stop       # stop the server when the fetch is done
#
set -euo pipefail

DOCKER=${DOCKER:-docker}
IMAGE=overv/openstreetmap-tile-server
VOLUME=oh-trail-map-osm
CONTAINER=oh-trail-map-osm
PORT=8080
WORK=${WORK:-$HOME/.cache/oh-trail-map}
PBF=$WORK/south-korea-latest.osm.pbf
# A little wider than TILE_BOUNDS in src/basemaps.ts (126.90,37.39,127.00,37.49),
# so roads and labels crossing the edge of the box still render whole.
BBOX=126.88,37.37,127.02,37.51

if [ "${1:-}" = stop ]; then
  $DOCKER stop "$CONTAINER"
  echo "Stopped. '$DOCKER volume rm $VOLUME' frees the database too."
  exit 0
fi

mkdir -p "$WORK"
if [ ! -f "$PBF" ]; then
  curl -L -o "$PBF.part" https://download.geofabrik.de/asia/south-korea-latest.osm.pbf
  mv "$PBF.part" "$PBF"
fi

if ! $DOCKER volume inspect "$VOLUME" >/dev/null 2>&1; then
  $DOCKER volume create "$VOLUME"
  $DOCKER run --rm \
    -v "$PBF":/data/region.osm.pbf \
    -v "$VOLUME":/data/database/ \
    -e OSM2PGSQL_EXTRA_ARGS="--bbox $BBOX" \
    "$IMAGE" import
fi

$DOCKER run -d --rm --name "$CONTAINER" \
  -p "$PORT":80 \
  -v "$VOLUME":/data/database/ \
  -e THREADS="$(nproc)" \
  "$IMAGE" run

cat <<EOF

Serving on http://localhost:$PORT/tile/{z}/{x}/{y}.png
Look at one tile first, e.g. http://localhost:$PORT/tile/17/111761/50813.png, then:

  scripts/fetch-tiles.py --url 'http://localhost:$PORT/tile/{z}/{x}/{y}.png' \\
      --out data/tiles/osm --zoom 0-19 --workers 4 --delay 0

and '$0 stop' afterwards.
EOF
