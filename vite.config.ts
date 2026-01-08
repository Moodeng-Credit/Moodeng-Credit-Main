import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';

// https://vite.dev/config/
// Force re-bundle
export default defineConfig(({ mode }) => {
   // Check if we are running the local dev script
   const isLocal = process.env.npm_lifecycle_event === 'dev:local';

   return {
      plugins: [react(), isLocal ? mkcert() : null].filter(Boolean),
      resolve: {
         alias: {
            '@': path.resolve(__dirname, './src')
         }
      },
      server: {
         port: 3000,
         host: isLocal ? true : false,
         allowedHosts: ['.ngrok-free.app', '.ngrok.io']
      }
   };
});
