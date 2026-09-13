# Put data/title.txt into the app name

## Context

`data/title.txt` (currently `Gwanaksan Mountain`) names the area this copy of the map
covers. The app now shows it after its name, as `oh-trail-map (Gwanaksan Mountain)`. The
name appears in two places in `index.html`:
- `<title>`: the browser tab
- the `<h1>` in the sidebar's `.panel-head`

`DB_NAME` in `src/store.ts` stays `oh-trail-map`. Renaming it would lose saved visibility.

## Change

1. **`src/main.ts`**:
   - `import rawTitle from '../data/title.txt?raw'` is bundled like the TSV in `points.ts`,
     because `vite build` copies only `public/`.
   - `applyTitle()` runs first in `main()`. It trims the file and builds
     `oh-trail-map (<place>)`, or plain `oh-trail-map` when the file is empty.
   - It sets `document.title` and the heading's text. The heading keeps the non-breaking
     hyphens (U+2011) from the markup, so a narrow panel wraps before `(` and never inside
     the name.
2. **`index.html`**: unchanged. The static name shows until the script runs.
3. **`README.md`**: a line in Features about `data/title.txt`.

## Verification

1. `npm run build`: the typecheck and build pass, and `Gwanaksan Mountain` is in the main
   bundle.
2. `npm run dev`: the tab and the heading both read `oh-trail-map (Gwanaksan Mountain)`, at
   desktop width and in the phone drawer.
3. With `data/title.txt` emptied, both read `oh-trail-map`.
