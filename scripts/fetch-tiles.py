#!/usr/bin/env python3
"""
Fetch every z/x/y tile over the app's box into a local folder, for the app to
serve from data/tiles/ instead of asking a tile server at run time.

The box is TILE_BOUNDS in src/basemaps.ts; keep the two in step. Tiles already
on disk are skipped, so an interrupted run picks up where it stopped.

  scripts/fetch-tiles.py --url 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png' \
      --out data/tiles/terrain --zoom 0-15 --delay 0.1
"""

import argparse
import math
import os
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

# west, south, east, north — the same numbers as TILE_BOUNDS in src/basemaps.ts.
WEST, SOUTH, EAST, NORTH = 126.90, 37.39, 127.00, 37.49

USER_AGENT = 'oh-trail-map tile fetch (one-time copy of a small area)'


def tile_xy(lat: float, lon: float, z: int) -> tuple[int, int]:
    n = 2**z
    x = int((lon + 180) / 360 * n)
    r = math.radians(lat)
    y = int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n)
    return min(n - 1, x), min(n - 1, y)


def tiles(zmin: int, zmax: int):
    for z in range(zmin, zmax + 1):
        x0, y0 = tile_xy(NORTH, WEST, z)
        x1, y1 = tile_xy(SOUTH, EAST, z)
        yield z, [(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--url', required=True, help='template with {z} {x} {y}, and {s} if --subdomains')
    p.add_argument('--subdomains', default='', help='letters to spread {s} across, e.g. abc')
    p.add_argument('--out', required=True, help='folder to write {z}/{x}/{y}.png into')
    p.add_argument('--zoom', required=True, help='range such as 0-17')
    p.add_argument('--delay', type=float, default=1.0, help='seconds between requests, per worker')
    p.add_argument('--workers', type=int, default=1)
    args = p.parse_args()

    zmin, zmax = (int(v) for v in args.zoom.split('-'))
    lock = threading.Lock()
    counter = {'n': 0}
    failures: list[str] = []

    def fetch(z: int, x: int, y: int) -> str:
        path = os.path.join(args.out, str(z), str(x), f'{y}.png')
        if os.path.exists(path):
            return 'skipped'
        with lock:
            counter['n'] += 1
            sub = args.subdomains[counter['n'] % len(args.subdomains)] if args.subdomains else ''
        url = args.url.replace('{s}', sub).replace('{z}', str(z)).replace('{x}', str(x)).replace('{y}', str(y))
        for attempt in range(2):
            try:
                req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
                with urllib.request.urlopen(req, timeout=120) as res:
                    body = res.read()
                break
            except (urllib.error.URLError, TimeoutError) as e:
                if attempt == 1:
                    with lock:
                        failures.append(f'{z}/{x}/{y}: {e}')
                    return 'failed'
                time.sleep(5)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        # Written beside and renamed, so an interrupted run never leaves half a
        # tile that the next run would skip as done.
        with open(path + '.part', 'wb') as f:
            f.write(body)
        os.replace(path + '.part', path)
        time.sleep(args.delay)
        return 'fetched'

    for z, xys in tiles(zmin, zmax):
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            results = list(pool.map(lambda xy: fetch(z, *xy), xys))
        print(
            f'z{z}: {len(xys)} tiles, {results.count("fetched")} fetched, '
            f'{results.count("skipped")} already here, {results.count("failed")} failed',
            flush=True,
        )

    for f in failures:
        print('failed', f, file=sys.stderr)
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
