import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
// Force re-bundle
export default defineConfig({
   plugins: [react(), basicSsl()],
   resolve: {
      alias: {
         '@': path.resolve(__dirname, './src')
      }
   },
   server: {
      host: true,
      https: true,
      port: 3000,
      allowedHosts: ['.ngrok-free.app', '.ngrok.io']
   }
});
