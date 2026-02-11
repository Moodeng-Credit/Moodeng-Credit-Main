import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';

// https://vite.dev/config/
// Force re-bundle
export default defineConfig(({ mode }) => {
   // Check if we are running the local dev script
   const isLocal = process.env.npm_lifecycle_event === 'dev:local';

   const inDocker = process.env.DOCKER === '1';
   return {
      plugins: [react(), isLocal ? mkcert() : null].filter(Boolean),
      resolve: {
         alias: {
            '@': path.resolve(__dirname, './src')
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
