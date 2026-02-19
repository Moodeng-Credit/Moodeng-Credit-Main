import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
// Force re-bundle
export default defineConfig(({ mode }) => {
   // Check if we are running the local dev script
   const isLocal = process.env.npm_lifecycle_event === 'dev:local';

   const inDocker = process.env.DOCKER === '1';
   // Resolve from config file so aliases work regardless of cwd (e.g. pnpm run dev from root)
   const frontendDir = __dirname;
   return {
      plugins: [react(), isLocal ? mkcert() : null].filter(Boolean),
      resolve: {
         alias: {
            '@': path.resolve(frontendDir, 'src'),
            // Repo-root src (v2): in Docker it's /app/v2, locally it's ../src from frontend
            '@v2': inDocker ? path.resolve(process.cwd(), 'v2') : path.resolve(frontendDir, '..', 'src')
         }
      },
      server: {
         port: 3000,
         host: inDocker ? '0.0.0.0' : isLocal ? true : false,
         allowedHosts: ['.ngrok-free.app', '.ngrok.io']
      },
      test: {
         environment: 'jsdom',
         setupFiles: './src/test/setup.ts',
         include: ['src/**/*.{test,spec}.ts'],
         exclude: ['e2e/**', 'node_modules/**'],
         coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'json', 'lcov'],
            reportsDirectory: './coverage'
         }
      }
   };
});
