# Dable meta tags

## Context

The user is considering [Dable](https://support.dable.io/publisher-media)'s
recommendation and ad widget. The first step, per
[the page-type guide](https://support.dable.io/media-process-type), is to add these
meta tags to the `<head>`: `item_id`, `og:url`, `og:title`, `og:description`,
`og:image`, `dable:author`, `article:section` and `article:published_time`
(ISO 8601 with an offset). The page also needs an element marked
`itemprop="articleBody"`.

Dable's crawler runs no script, so the tags have to be in the served HTML.
`applyTitle()` in `src/main.ts` only sets the title at run time. The app is one page
at `https://gwanaksan.ohhara.ai/`, so it registers as a single item.

## Change

1. `data/meta.json` (new) holds the values no other data file has: `url`,
   `item_id`, `description`, `section` and `published_time`.
2. `vite.config.ts` gets a `dableMeta()` plugin, using `transformIndexHtml`, in
   both dev and build. It does these things:
   - Builds the title the way `applyTitle()` does, and writes it into the static
     `<title>` too.
   - Injects the eight `<meta property>` tags, with `og:image` set to
     `og.png` under `url` and `dable:author` from `data/name.txt`.
   - Fills `#intro` with the description.
   - Leaves all of this out when there is no `meta.json`.
   - In dev, reloads the page when `meta.json`, `title.txt` or `name.txt` changes.

   `gwanaksan.ohhara.ai` joins `map.ohhara.io` in `allowedHosts`.
3. `index.html`: a new `#intro` paragraph, `itemprop="articleBody"`, as the first
   `.block` of the panel. `src/style.css` gives it muted 12px text and hides it
   when it is empty.
4. `public/og.png`: a real 1200×630 screenshot of the 2D map, buttons included,
   taken by headless Chrome over the DevTools protocol against `vite preview`. The
   plain `--screenshot` flag fired before the trails loaded.
   - At the first fit to the trails, grey shows either side of the tile box. The
     box is taller than it is wide, and the window is wide.
   - So after the page settles, a wheel turn (deltaY −90 at (128, 315)) zooms in,
     and a 400px mouse drag to the left moves the box across. Together they fill
     the frame with tiles.
   - The ends of the northern and southern trails fall outside it.
5. `README.md`: a bullet for `data/meta.json`.

## Verification

1. `npm run build` passes.
2. `dist/index.html` has `<title>oh-trail-map (관악산)</title>`, the eight tags with
   the values above, and the description inside `#intro`.
3. `dist/og.png` is the 1200×630 screenshot.
4. After deploying, check `https://gwanaksan.ohhara.ai/` with
   `admin.dable.io/tools/meta_test.html`, using the PC user-agent (the setting for
   responsive sites).

## Follow-up

- The widget script comes from Dable once the account is approved, and is not
  part of this change.
- Dable is built for article sites, and a one-page map app may not meet its
  approval criteria.
- `og.png` is a snapshot. Retake it if the trails change much.
