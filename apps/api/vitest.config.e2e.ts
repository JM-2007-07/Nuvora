import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // The first test boots the whole Nest app on a cold transform cache, which
    // can exceed the 5 s default on Windows.
    testTimeout: 30_000,
  },
});
