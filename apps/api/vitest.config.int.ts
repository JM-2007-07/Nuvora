import { defineConfig } from 'vitest/config';

/**
 * Integration tests against a real PostgreSQL test database (DATABASE_URL_TEST, e.g. nuvora_test).
 * Run: pnpm --filter @nuvora/api test:int. Skipped when DATABASE_URL_TEST is not set.
 * Never points at the development database: test/int/db.ts refuses a URL without "test".
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/int/**/*.int-spec.ts'],
    globalSetup: ['./test/int/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
