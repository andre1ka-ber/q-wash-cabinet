import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // q-wash-shared is a sibling dir consumed via a `file:` dependency
    // (symlinked into node_modules) — Vite otherwise refuses to serve
    // files outside this project's own root.
    fs: {
      allow: ['..'],
    },
  },
});
