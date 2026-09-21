import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate from vitest.config.js on purpose: a second config with its own script matches
// the per-directory pattern of the other layers, and avoids relying on test.projects.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['tests/component/**/*.test.{js,jsx}'],
    setupFiles: ['tests/helpers/setupComponent.js'],
    // Kept identical to vitest.config.js, see the comment there about shared-state races.
    fileParallelism: false,
  },
});
