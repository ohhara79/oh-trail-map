import { cpSync, existsSync } from 'node:fs';
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

export default defineConfig({
  // host: true binds the LAN address too, so a phone on the same Wi-Fi can
  // load the dev server. Geolocation still needs localhost or HTTPS.
  // allowedHosts lists the domains Vite accepts a Host header from; without it
  // requests through map.ohhara.io are rejected as a DNS-rebinding guard.
  server: { port: 5173, host: true, allowedHosts: ['map.ohhara.io'] },
  preview: { port: 4173, host: true, allowedHosts: ['map.ohhara.io'] },
  // Not 'spa': its fallback answers any unknown path with index.html and a 200, so
  // a missing tile came back as HTML that a cache could keep in place of the PNG.
  // One page at /, so nothing else here needs the fallback.
  appType: 'mpa',
  build: { target: 'es2022' },
  plugins: [copyTiles()],
  // MapLibre starts its worker with { type: 'module' } (see view3d.ts), which only
  // loads an ES-module bundle; Vite's default worker format is a classic script.
  worker: { format: 'es' },
});
