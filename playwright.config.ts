import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
   testDir: './e2e',
   timeout: 30_000,
   expect: {
      timeout: 5_000
   },
   use: {
      baseURL,
      trace: 'on-first-retry'
   },
   webServer: {
      command: 'pnpm exec dotenvx run --env-file=.env.ci -- vite --host 127.0.0.1 --port 3000 --strictPort',
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      env: {
         NODE_ENV: 'development'
      }
   },
   projects: [
      {
         name: 'chromium',
         use: { ...devices['Desktop Chrome'] }
      }
   ]
});
