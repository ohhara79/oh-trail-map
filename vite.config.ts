import { defineConfig } from 'vite';

export default defineConfig({
  // host: true binds the LAN address too, so a phone on the same Wi-Fi can
  // load the dev server. Geolocation still needs localhost or HTTPS.
  // allowedHosts lists the domains Vite accepts a Host header from; without it
  // requests through map.ohhara.io are rejected as a DNS-rebinding guard.
  server: { port: 5173, host: true, allowedHosts: ['map.ohhara.io'] },
  preview: { port: 4173, host: true, allowedHosts: ['map.ohhara.io'] },
  build: { target: 'es2022' },
  // MapLibre starts its worker with { type: 'module' } (see view3d.ts), which only
  // loads an ES-module bundle; Vite's default worker format is a classic script.
  worker: { format: 'es' },
});
