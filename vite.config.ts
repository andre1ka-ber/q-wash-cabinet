import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
