import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', timeout: 60000, expect: { timeout: 15000 }, fullyParallel: false, workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8091', viewport: { width: 390, height: 844 },
    timezoneId: 'America/New_York', permissions: ['microphone'],
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
    screenshot: 'only-on-failure', trace: 'off',
  },
  webServer: { command: 'CI=1 npm run web -- --port 8091', url: 'http://localhost:8091', reuseExistingServer: false, timeout: 120000 },
});
