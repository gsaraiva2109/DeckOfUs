import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./src/test/globalSetup.ts'],
    setupFiles: ['./src/test/setupEnv.ts'],
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // DB-backed tests share one sqlite file; run serially to avoid races.
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
