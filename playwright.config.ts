import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * End-to-end smoke tests (one per module) against the production build served by `vite preview`:
 * the built output is what ships, and the simulation Worker is bundled differently there than in
 * `npm run dev`. `npm run e2e` builds first; CI runs `npx playwright test` after its own build step.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // A test that passes on the second try is a flaky test; fix it instead of retrying.
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Never adopt a server that is already running: it could be serving an old build.
    reuseExistingServer: false,
  },
});
