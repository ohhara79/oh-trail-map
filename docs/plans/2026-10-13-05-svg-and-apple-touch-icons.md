# Add an SVG favicon and an apple-touch-icon

## Context

Commit `c5515a48` added `public/favicon.ico`, drawn by
`scripts/make-favicon.py`. ICO is the fallback that every browser and crawler
understands, but modern browsers can use an SVG icon, which stays sharp at any
size, and iOS uses a 180×180 PNG `apple-touch-icon` when someone adds the page to
the home screen. Without it, iOS uses a screenshot of the page. The user asked for
both, drawn from the same script so the three icons always match.

## Change

1. **`scripts/make-favicon.py`**: describe the icon once as a list of shapes in
   the 256-unit space it already uses (tile, back peak, front peak, trail,
   summit rim, summit dot), and render that list two ways:
   - **Pillow**, as now, for `public/favicon.ico` (16/32/48/64) and for
     `public/apple-touch-icon.png` (180×180, RGB). The apple icon fills the
     whole square with green and has no rounded corners or transparency,
     because iOS applies its own rounded mask.
   - **SVG text** for `public/icon.svg`: `<svg viewBox="0 0 256 256">` with a
     `rect rx="48"`, two `polygon`s, a `polyline` (stroke width 20,
     `stroke-linecap`/`stroke-linejoin="round"`, `fill="none"`) and two
     `circle`s. No dark-mode variant: the green tile reads on both light and
     dark tabs.
   Update the docstring to list all three outputs. Keep `--png` for previews.

2. **Run the script and commit the generated files**: `public/icon.svg` and
   `public/apple-touch-icon.png`, plus `public/favicon.ico` if it changes. Vite
   copies `public/` into `dist/`.

3. **`index.html`**: replace the current icon line with:

   ```html
   <link rel="icon" href="/favicon.ico" sizes="32x32" />
   <link rel="icon" href="/icon.svg" type="image/svg+xml" />
   <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
   ```

   `sizes="32x32"` replaces `sizes="any"`; with `any`, Chrome picks the ICO
   over the SVG.

4. **`d.sh`** (untracked): after the `favicon.ico` line, upload the two new
   files with the same one-week cache. Set the SVG's content type explicitly so
   S3 serves it as `image/svg+xml`:

   ```sh
   aws s3 cp dist/icon.svg $B/icon.svg --content-type "image/svg+xml" --cache-control "public,max-age=604800"
   aws s3 cp dist/apple-touch-icon.png $B/apple-touch-icon.png --cache-control "public,max-age=604800"
   ```

5. **Save this plan** as `docs/plans/2026-10-13-05-svg-and-apple-touch-icons.md`.

## Verification

1. Run the script. Render `icon.svg` to a PNG with `convert` and view it next to
   the Pillow render and `apple-touch-icon.png`. All three should match.
2. `file public/apple-touch-icon.png` reports a 180 × 180 image.
3. `npm run build` passes; `dist/` holds all three files and `dist/index.html`
   holds the three `<link>` tags.
4. After deploying with `d.sh`, `curl -I` on `/icon.svg` shows
   `content-type: image/svg+xml`, and `/apple-touch-icon.png` returns 200.
