import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    // Optional: point at a locally installed Chromium (PW_CHROMIUM) to skip 'npx playwright install'.
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
      ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
    },
  },
  webServer: { command: 'npm run preview', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
});
