import { defineConfig } from '@playwright/test';

/**
 * Browser smoke tests (D-11). Run separately from `pnpm test`:
 *   pnpm --filter @nuvora/web test:e2e
 * Uses the Microsoft Edge already installed on the machine (`channel: 'msedge'`),
 * so no Playwright browser download is needed.
 * Runs against the dev server on purpose: React's dev-only console warnings
 * (like the next-themes script warning fixed at G1) only appear in development.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    channel: 'msedge',
    headless: true,
    // Journeys start with a cookie choice already made, so the consent banner does not cover
    // buttons; cookie-consent.spec.ts clears cookies to test the banner itself.
    storageState: 'e2e/consent-decided.json',
  },
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:3000/tg',
    reuseExistingServer: true,
    timeout: 120_000,
    env: { NEXT_TELEMETRY_DISABLED: '1' },
  },
});
