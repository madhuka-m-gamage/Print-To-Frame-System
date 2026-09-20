import { defineConfig, devices } from '@playwright/test';

// Emulator-only defaults. tests/e2e/global-setup.js fails the run if these point anywhere but a
// local emulator and a demo- project, so E2E can never reach real Firebase.
process.env.GCLOUD_PROJECT ||= 'demo-print2frame-test';
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.js',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // Every test shares one emulator with seeded data.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'firebase emulators:start --project demo-print2frame-test --only firestore,auth',
      // Auth starts alongside Firestore; waiting on it means both are up.
      url: 'http://127.0.0.1:9099',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // Without a graceful stop the firebase CLI dies but its Java emulator child is orphaned,
      // holds port 8080, and the next run then reuses a half-started stack.
      gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 },
    },
    {
      command: 'npm run dev:emulated',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
