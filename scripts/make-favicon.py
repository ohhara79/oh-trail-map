#!/usr/bin/env python3
"""
Draw the site's favicon: a white mountain on a green tile, a trail climbing to
the summit and a point dot on top, in the map's own colours. Writes
public/favicon.ico with 16, 32, 48 and 64 px images, which Vite copies into
dist/ on build.

  scripts/make-favicon.py [--png preview.png]
"""

import argparse
import os

from PIL import Image, ImageDraw

SIZE = 256
SCALE = 4  # draw larger, then shrink, for smooth edges

GREEN = '#3f8f3d'
SNOW = '#ffffff'
SHADE = '#dfe8de'
TRAIL = '#d63aa8'
POINT = '#b5560f'

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'favicon.ico')


def draw():
    s = SIZE * SCALE
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def p(x, y):
        return (x * SCALE, y * SCALE)

    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=48 * SCALE, fill=GREEN)

    # Two peaks: a small one behind on the left, the main one in front.
    d.polygon([p(14, 214), p(78, 112), p(142, 214)], fill=SHADE)
    d.polygon([p(52, 214), p(150, 52), p(244, 214)], fill=SNOW)

    # The trail zigzags up the main peak to the summit.
    trail = [p(96, 214), p(178, 172), p(122, 134), p(168, 100), p(150, 62)]
    d.line(trail, fill=TRAIL, width=20 * SCALE, joint='curve')
    r = 10 * SCALE
    for x, y in trail[:1]:
        d.ellipse([x - r, y - r, x + r, y + r], fill=TRAIL)

    # The summit point, rimmed in white like the map's points.
    cx, cy = p(150, 60)
    for rad, col in ((34, SNOW), (24, POINT)):
        r = rad * SCALE
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)

    return img.resize((SIZE, SIZE), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    ap.add_argument('--png', help='also save the 256 px image here, to look at')
    args = ap.parse_args()

    img = draw()
    img.save(OUT, sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    if args.png:
        img.save(args.png)
    print(f'wrote {os.path.normpath(OUT)}')


if __name__ == '__main__':
    main()
