import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';

// https://vite.dev/config/
// Force re-bundle
export default defineConfig({
   plugins: [react(), mkcert()],
   resolve: {
      alias: {
         '@': path.resolve(__dirname, './src')
      }
   },
   server: {
      port: 3000,
      host: true, // Listen on all network interfaces
      allowedHosts: ['.ngrok-free.app', '.ngrok.io']
   }
});
