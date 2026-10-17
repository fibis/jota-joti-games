import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Plain unit tests (no Nuxt runtime): resolve the same aliases Nuxt does.
export default defineConfig({
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: { include: ['test/**/*.test.ts'] },
});
