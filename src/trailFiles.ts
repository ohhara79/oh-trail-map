/**
 * The trails are the .gpx files in data/gpx/ — a fixed set, not something the
 * browser adds to or removes from.
 *
 * Bundled rather than fetched, for the same reason as points.ts: `vite build`
 * copies only public/, so a repo-root data/ would 404 in dist/. Unlike the
 * 25 KB TSV, though, these run to megabytes, so the glob is lazy: each file
 * becomes its own chunk, loaded at boot, and none of it lands in the main
 * bundle. The folder is read when Vite starts or builds — the dev server picks
 * up new files, but dist/ needs a rebuild.
 *
 * An empty or missing folder matches nothing, so the glob is simply {} and the
 * app starts with no trails.
 */
const modules = import.meta.glob<string>('../data/gpx/*.gpx', {
  query: '?raw',
  import: 'default',
});

export type TrailFile = {
  /** The bare file name, which doubles as the trail's id. */
  file: string;
  text: string;
};

/** Every file in data/gpx/, sorted by name. A file whose chunk fails to load
 *  rejects the whole call, as a missing chunk means a broken deploy. */
export async function loadTrailFiles(): Promise<TrailFile[]> {
  const entries = await Promise.all(
    Object.entries(modules).map(async ([path, load]) => ({
      file: path.slice(path.lastIndexOf('/') + 1),
      text: await load(),
    })),
  );
  return entries.sort((a, b) => a.file.localeCompare(b.file));
}
