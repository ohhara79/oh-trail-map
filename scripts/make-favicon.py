#!/usr/bin/env python3
"""
Draw the site's icons: a white mountain on a green tile, a trail climbing to
the summit and a point dot on top, in the map's own colours. Writes, into
public/ for Vite to copy into dist/ on build:

  favicon.ico           16, 32, 48 and 64 px, for every browser and crawler
  icon.svg              for modern browsers, sharp at any size
  apple-touch-icon.png  180 px, square-cornered (iOS rounds it itself)

  scripts/make-favicon.py [--png preview.png]
"""

import argparse
import os

from PIL import Image, ImageDraw

SIZE = 256  # the space the shapes are drawn in
SCALE = 4  # draw larger, then shrink, for smooth edges
RADIUS = 48  # the tile's corner radius

GREEN = '#3f8f3d'
SNOW = '#ffffff'
SHADE = '#dfe8de'
TRAIL = '#d63aa8'
POINT = '#b5560f'

# Drawn in order over the green tile.
SHAPES = [
    # Two peaks: a small one behind on the left, the main one in front.
    ('polygon', [(14, 214), (78, 112), (142, 214)], SHADE),
    ('polygon', [(52, 214), (150, 52), (244, 214)], SNOW),
    # The trail zigzags up the main peak to the summit.
    ('line', [(96, 214), (178, 172), (122, 134), (168, 100), (150, 62)], TRAIL, 20),
    # The summit point, rimmed in white like the map's points.
    ('circle', (150, 60), 34, SNOW),
    ('circle', (150, 60), 24, POINT),
]

PUBLIC = os.path.join(os.path.dirname(__file__), '..', 'public')


def draw(radius=RADIUS):
    """The icon as a SIZE px image; radius 0 fills the whole square."""
    s = SIZE * SCALE
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def p(pt):
        return (pt[0] * SCALE, pt[1] * SCALE)

    def dot(c, r, col):
        x, y = p(c)
        r *= SCALE
        d.ellipse([x - r, y - r, x + r, y + r], fill=col)

    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius * SCALE, fill=GREEN)
    for shape in SHAPES:
        kind = shape[0]
        if kind == 'polygon':
            d.polygon([p(pt) for pt in shape[1]], fill=shape[2])
        elif kind == 'line':
            _, pts, col, width = shape
            d.line([p(pt) for pt in pts], fill=col, width=width * SCALE, joint='curve')
            for end in (pts[0], pts[-1]):  # round caps, as in the SVG
                dot(end, width / 2, col)
        elif kind == 'circle':
            dot(*shape[1:])

    return img.resize((SIZE, SIZE), Image.LANCZOS)


def svg():
    def pts(ps):
        return ' '.join(f'{x},{y}' for x, y in ps)

    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">',
        f'<rect width="{SIZE}" height="{SIZE}" rx="{RADIUS}" fill="{GREEN}"/>',
    ]
    for shape in SHAPES:
        kind = shape[0]
        if kind == 'polygon':
            out.append(f'<polygon points="{pts(shape[1])}" fill="{shape[2]}"/>')
        elif kind == 'line':
            _, ps, col, width = shape
            out.append(f'<polyline points="{pts(ps)}" fill="none" stroke="{col}" '
                       f'stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"/>')
        elif kind == 'circle':
            (cx, cy), r, col = shape[1:]
            out.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{col}"/>')
    out.append('</svg>')
    return '\n'.join(out) + '\n'


def main():
    ap = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    ap.add_argument('--png', help='also save the 256 px image here, to look at')
    args = ap.parse_args()

    img = draw()
    img.save(os.path.join(PUBLIC, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    with open(os.path.join(PUBLIC, 'icon.svg'), 'w') as f:
        f.write(svg())
    draw(radius=0).convert('RGB').resize((180, 180), Image.LANCZOS) \
        .save(os.path.join(PUBLIC, 'apple-touch-icon.png'), optimize=True)
    if args.png:
        img.save(args.png)
    for name in ('favicon.ico', 'icon.svg', 'apple-touch-icon.png'):
        print(f'wrote {os.path.normpath(os.path.join(PUBLIC, name))}')


if __name__ == '__main__':
    main()
