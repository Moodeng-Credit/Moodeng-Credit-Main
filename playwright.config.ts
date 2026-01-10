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
      command: 'pnpm exec vite --host 0.0.0.0 --port 3000',
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      env: {
         VITE_SUPABASE_URL: 'https://placeholder.supabase.co',
         VITE_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
         VITE_SITE_URL: 'https://localhost:3000',
         VITE_REDIRECT_URL: 'https://localhost:3000',
         VITE_API_URL: 'https://placeholder.supabase.co/functions/v1',
         VITE_WALLET_CONNECT_PROJECT_ID: 'placeholder',
         VITE_ALCHEMY_ID: 'placeholder',
         VITE_WORLD_ID_APP_ID: 'app_placeholder',
         VITE_WORLD_ID_ACTION_ID: 'placeholder'
      }
   },
   projects: [
      {
         name: 'chromium',
         use: { ...devices['Desktop Chrome'] }
      }
   ]
});
