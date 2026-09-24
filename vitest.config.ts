import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Same dual-React-copy issue as vite.config.ts — see its comment.
    // Only bit outside a component that actually calls a hook (useIsMobile)
    // in q-wash-shared, so it never surfaced here until now.
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
