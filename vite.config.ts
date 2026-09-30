import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Installable PWA only — no runtimeCaching entries, so Workbox's
    // generated service worker precaches nothing but this build's own
    // static output (JS/CSS/fonts/icons) and never touches /api/* or the
    // SSE endpoints. This app's live queue/booking data must never be
    // served stale from a cache. registerType 'autoUpdate' activates a
    // new version in the background on the next load, without a manual
    // "update available" prompt to click through.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        lang: 'ru',
        name: 'Q Wash — Кабинет мойки',
        short_name: 'Q Wash Кабинет',
        description: 'Кабинет мойки Q Wash: очередь, услуги, боксы, часы работы, фото.',
        theme_color: '#0A0A09',
        background_color: '#0A0A09',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    // q-wash-shared has its own react/react-dom install (peer dep,
    // auto-installed by npm); without dedupe, the build ships two React
    // copies and hooks break (useSyncExternalStore on a null dispatcher).
    dedupe: ['react', 'react-dom'],
  },
  server: {
    // q-wash-shared is a sibling dir consumed via a `file:` dependency
    // (symlinked into node_modules) — Vite otherwise refuses to serve
    // files outside this project's own root.
    fs: {
      allow: ['..'],
    },
  },
});
