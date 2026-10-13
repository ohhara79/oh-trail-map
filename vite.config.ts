import { cpSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * The map tiles under data/tiles/ are fetched by URL at run time, not imported:
 * tens of thousands of PNGs have no business in the module graph. The dev server
 * already serves them from the project root, but `vite build` copies only
 * public/, so this copies them into dist/ at the same path.
 */
function copyTiles(): Plugin {
  let from = '';
  let to = '';
  return {
    name: 'copy-tiles',
    apply: 'build',
    configResolved(config) {
      from = resolve(config.root, 'data/tiles');
      to = resolve(config.root, config.build.outDir, 'data/tiles');
    },
    closeBundle() {
      if (existsSync(from)) cpSync(from, to, { recursive: true });
    },
  };
}

/** What data/meta.json holds: the page's values no other data file has. */
interface PageMeta {
  url: string;
  item_id: string;
  description: string;
  section: string;
  published_time: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The Open Graph and Dable tags (https://support.dable.io/media-process-type),
 * the search engines' description tag, the static <title>, and the #intro text
 * Dable reads as the page body. Written into index.html here and not from
 * main.ts, because crawlers run no script.
 * The title is applyTitle()'s in main.ts; the author is data/name.txt. Without
 * data/meta.json the page gets none of it.
 */
function dableMeta(): Plugin {
  let root = '';
  const read = (file: string) => readFileSync(resolve(root, 'data', file), 'utf8').trim();
  return {
    name: 'dable-meta',
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      // index.html is re-read on every dev request, so a page reload picks the
      // edit up; meta.json is in no module graph to trigger that reload itself.
      const files = ['meta.json', 'title.txt', 'name.txt'].map((f) => resolve(root, 'data', f));
      server.watcher.add(files);
      server.watcher.on('change', (file) => {
        if (files.includes(file)) server.ws.send({ type: 'full-reload' });
      });
    },
    transformIndexHtml(html) {
      if (!existsSync(resolve(root, 'data/meta.json'))) return html.replace('<!--intro-->', '');
      const meta = JSON.parse(read('meta.json')) as PageMeta;
      const title = read('title.txt') || 'oh-trail-map';
      const tags: [string, string][] = [
        ['item_id', meta.item_id],
        ['og:url', meta.url],
        ['og:title', title],
        ['og:description', meta.description],
        ['og:image', new URL('og.png', meta.url).href],
        ['dable:author', read('name.txt')],
        ['article:section', meta.section],
        ['article:published_time', meta.published_time],
      ];
      // name="description", not property=: the snippet search engines show.
      const head = [`<meta name="description" content="${escapeHtml(meta.description)}" />`]
        .concat(
          tags
            .filter(([, value]) => value)
            .map(([property, value]) => `<meta property="${property}" content="${escapeHtml(value)}" />`),
        )
        .join('\n    ');
      return html
        .replace(/<title>.*<\/title>/, `<title>${escapeHtml(title)}</title>\n    ${head}`)
        .replace('<!--intro-->', escapeHtml(meta.description));
    },
  };
}

export default defineConfig({
  // host: true binds the LAN address too, so a phone on the same Wi-Fi can
  // load the dev server. Geolocation still needs localhost or HTTPS.
  // allowedHosts lists the domains Vite accepts a Host header from; without it
  // requests through map.ohhara.io or gwanaksan.ohhara.ai are rejected as a DNS-rebinding guard.
  server: { port: 5173, host: true, allowedHosts: ['map.ohhara.io', 'gwanaksan.ohhara.ai'] },
  preview: { port: 4173, host: true, allowedHosts: ['map.ohhara.io', 'gwanaksan.ohhara.ai'] },
  // Not 'spa': its fallback answers any unknown path with index.html and a 200, so
  // a missing tile came back as HTML that a cache could keep in place of the PNG.
  // One page at /, so nothing else here needs the fallback.
  appType: 'mpa',
  build: { target: 'es2022' },
  plugins: [copyTiles(), dableMeta()],
  // MapLibre starts its worker with { type: 'module' } (see view3d.ts), which only
  // loads an ES-module bundle; Vite's default worker format is a classic script.
  worker: { format: 'es' },
});
