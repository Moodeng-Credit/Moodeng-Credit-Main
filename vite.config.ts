import { createReadStream, existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from 'vite';
import mkcert from 'vite-plugin-mkcert';

const require = createRequire(import.meta.url);

const getPackageRoot = (packageName: string, resolvePaths?: string[]) => {
   const resolvedEntry = resolvePaths ? require.resolve(packageName, { paths: resolvePaths }) : require.resolve(packageName);
   let currentPath = path.dirname(resolvedEntry);

   while (currentPath !== path.dirname(currentPath)) {
      const packageJsonPath = path.join(currentPath, 'package.json');

      if (existsSync(packageJsonPath)) {
         const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { name?: string };

         if (packageJson.name === packageName) {
            return currentPath;
         }
      }

      currentPath = path.dirname(currentPath);
   }

   throw new Error(`Could not resolve package root for ${packageName}`);
};

const idkitPackageRoot = getPackageRoot('@worldcoin/idkit');
const idkitCorePackageRoot = getPackageRoot('@worldcoin/idkit-core', [idkitPackageRoot]);
const idkitWasmFileName = 'idkit_wasm_bg.wasm';
const idkitWasmPath = path.resolve(idkitCorePackageRoot, 'dist', idkitWasmFileName);

const configureWasmMiddleware = (server: ViteDevServer | PreviewServer) => {
   server.middlewares.use((req, res, next) => {
      const requestPath = req.url?.split('?')[0];

      if (!requestPath?.endsWith('.wasm')) {
         next();
         return;
      }

      res.setHeader('Content-Type', 'application/wasm');

      if (requestPath.endsWith(`/${idkitWasmFileName}`)) {
         const stream = createReadStream(idkitWasmPath);
         stream.on('error', next);
         stream.pipe(res);
         return;
      }

      next();
   });
};

const wasmMimePlugin = (): Plugin => ({
   name: 'wasm-mime',
   configureServer(server) {
      configureWasmMiddleware(server);
   },
   configurePreviewServer(server) {
      configureWasmMiddleware(server);
   }
});

// https://vite.dev/config/
// Force re-bundle
export default defineConfig(() => {
   // Check if we are running the local dev script
   const isLocal = process.env.npm_lifecycle_event === 'dev:local';

   return {
      plugins: [wasmMimePlugin(), react(), isLocal ? mkcert() : null].filter(Boolean),
      resolve: {
         alias: {
            '@': path.resolve(__dirname, './src')
         }
      },
      server: {
         port: 3000,
         host: isLocal ? true : false,
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
