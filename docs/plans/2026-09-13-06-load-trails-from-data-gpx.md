# Load trails from data/gpx instead of importing them

## Context

Trails used to be added in the browser — the "Import GPX files" picker or a drop onto
the map — with each file's text kept in IndexedDB and a × on every row to remove it.
The trails are now a fixed set: whatever `.gpx` files sit in `data/gpx/` (36 Ramblr
exports, 9.7 MB, left untracked in git). An empty or missing folder means no trails.
Since the set cannot change from the browser, importing, the drop zone and per-trail
removal all go.

## Change

1. **`src/trailFiles.ts`** (new) — `import.meta.glob('../data/gpx/*.gpx', { query: '?raw',
   import: 'default' })`, the same bundling route as `points.ts` (`vite build` copies
   only `public/`). Not eager: every file becomes its own lazy chunk, so the megabytes of
   GPX stay out of the main bundle. `loadTrailFiles()` loads them in parallel and sorts
   by file name. No folder → the glob is `{}` → no trails, no error.

2. **`src/store.ts`** — `TrailRecord` is `{ id, color, visible }`, keyed by file name;
   `gpxText` and `addedAt` are gone and `loadTrails()` no longer sorts. No DB version
   bump: the keyPath is still `id`.

3. **`src/main.ts`** — `onImport`, `onRemove`, `importFiles()` and `colorCursor` removed.
   Boot reads the files and the records together; each file is built with its saved
   colour/visibility, or `nextColor(index)` and visible. A file that fails to parse is a
   notice, not a blocker. Records matching no file are deleted — which also clears the
   old timestamp-id import records and their GPX text, once. Skipped if the store could
   not be read.

4. **`src/trails.ts`** — `Trail.gpxText` dropped; nothing read it after persistence
   stopped needing it.

5. **`src/ui.ts`** — `onImport` / `onRemove`, the file-input listener, `dropOverlay`,
   `bindDropZone()` and the row's remove button removed. Empty text is
   `No GPX files in data/gpx.`

6. **`index.html`** — the Import section and `#drop-overlay` removed.

7. **`src/style.css`** — `.file-button*`, `.trail-remove` (both rules) and
   `#drop-overlay*` removed.

8. **`README.md`** — features, samples and notes describe `data/gpx/`.

## Verification

1. `npm run build` — typecheck passes; `dist/assets` has 36 `ohhara_*.js` chunks
   (~310 kB each) beside a ~199 kB main bundle.
2. `vite preview` in headless Chrome, with IndexedDB seeded with an old import record
   and `{ id: 'ohhara_10672068.gpx', color: '#000000', visible: false }`: 36 rows, no
   row buttons, no file input or drop overlay; the first row is unchecked and black; the
   old record is gone from the store.
3. Unchecking the third row and reloading: it stays hidden, and the store gains its
   `{id,color,visible}` record.
4. Dev server on a copy with no `data/gpx/`: 0 rows, "No GPX files in data/gpx." shown,
   no console errors.
5. The two `samples/` plus a `broken.gpx` in `data/gpx/`: 2 rows and the notice
   "broken.gpx is not valid XML".
