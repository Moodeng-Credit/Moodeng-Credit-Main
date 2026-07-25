/**
 * Build-time SEO prerenderer.
 *
 * After `vite build`, this serves dist/ locally, loads each public content route in
 * headless Chromium, waits for the React app to render + apply per-route SEO
 * (window.__MOODENG_SEO_READY__), then writes the fully-rendered HTML back into dist
 * as a static file. Crawlers then receive real content + correct <head> with no JS.
 *
 * Runs in the SAME build as the deploy, so hashed asset URLs in the snapshot always
 * match the emitted bundles (nothing is committed — no staleness).
 *
 * Graceful degradation: if Chromium cannot be launched or installed, the script logs
 * loudly and exits 0 WITHOUT failing the build. The site still works — the canonical
 * fix + runtime <RouteSeo> mean crawlers that render JS still get correct metadata;
 * only the no-JS static snapshot is skipped.
 *
 * Usage: node scripts/prerender-seo.mjs [distDir]
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { PRERENDER_ROUTES } from './seo-routes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, process.argv[2] ?? 'dist');
const PORT = 4820;
const PROD_ORIGIN = 'https://moodeng.app';
const READY_FLAG = '__MOODENG_SEO_READY__';

// Vercel/CI build boxes have ~2 vCPUs and run @sparticuz Chromium; rendering the
// heavy app bundle across concurrent pages starves them and most pages time out.
// Go serial with generous timeouts there; use full parallelism locally.
const IS_SERVERLESS = !!(process.env.VERCEL || process.env.CI || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV);
const NAV_TIMEOUT = IS_SERVERLESS ? 45000 : 20000;
const READY_TIMEOUT = IS_SERVERLESS ? 25000 : 15000;
const BODY_TIMEOUT = IS_SERVERLESS ? 15000 : 10000;
const CONCURRENCY = IS_SERVERLESS ? 2 : 3;

const MIME = {
   '.html': 'text/html; charset=utf-8',
   '.js': 'text/javascript; charset=utf-8',
   '.mjs': 'text/javascript; charset=utf-8',
   '.css': 'text/css; charset=utf-8',
   '.json': 'application/json; charset=utf-8',
   '.svg': 'image/svg+xml',
   '.png': 'image/png',
   '.jpg': 'image/jpeg',
   '.jpeg': 'image/jpeg',
   '.webp': 'image/webp',
   '.avif': 'image/avif',
   '.ico': 'image/x-icon',
   '.woff': 'font/woff',
   '.woff2': 'font/woff2',
   '.wasm': 'application/wasm',
   '.map': 'application/json; charset=utf-8',
};

/** Minimal static server for dist/ with SPA fallback to index.html. */
function startServer() {
   const server = createServer(async (req, res) => {
      try {
         const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
         let filePath = join(DIST, urlPath);
         let ext = extname(filePath);
         // Mirror Vercel's SPA behaviour: serve a real static asset only when the request
         // has an extension AND the exact file exists (JS/CSS/images/fonts). Everything
         // else — including extensionless content routes and legacy public/*.html twins
         // like /privacy — falls through to the SPA so the React route renders fresh.
         // (Do NOT append ".html" or serve a directory index.html: that would pick up a
         // legacy static file, or a half-written snapshot from earlier in this same run.)
         if (!ext || !existsSync(filePath)) {
            filePath = join(DIST, 'index.html');
            ext = '.html';
         }
         const body = await readFile(filePath);
         res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
         res.end(body);
      } catch {
         res.writeHead(500);
         res.end('prerender server error');
      }
   });
   return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

async function loadPlaywrightChromium() {
   try {
      return (await import('playwright')).chromium;
   } catch {
      try {
         return (await import('@playwright/test')).chromium;
      } catch (err) {
         console.warn('[prerender] Playwright not resolvable:', err?.message);
         return null;
      }
   }
}

async function loadChromium() {
   const chromium = await loadPlaywrightChromium();
   if (!chromium) return null;

   const args = ['--no-sandbox', '--disable-setuid-sandbox'];
   // Vercel/CI build images can't run Playwright's bundled Chromium (missing system
   // libs). @sparticuz/chromium ships a self-contained Chromium built for exactly those
   // serverless/AWS environments; use it there and let Playwright drive it via
   // executablePath. Locally, use the normal bundled Chromium.
   const serverless = !!(process.env.VERCEL || process.env.CI || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV);
   if (serverless) {
      try {
         const sparticuz = (await import('@sparticuz/chromium')).default;
         const executablePath = await sparticuz.executablePath();
         // @sparticuz tunes its args for Lambda's single-invocation model, where
         // --single-process/--no-zygote save memory. Playwright does not support them:
         // the lone renderer process dies once a few pages have been driven, which is
         // why only the first couple of routes ever rendered. Drop them.
         const unsupported = new Set(['--single-process', '--no-zygote']);
         const baseArgs = sparticuz.args.filter((a) => !unsupported.has(a));
         console.log('[prerender] using @sparticuz/chromium at', executablePath);
         return await chromium.launch({ headless: true, executablePath, args: [...baseArgs, ...args] });
      } catch (err) {
         console.warn('[prerender] @sparticuz/chromium unavailable, falling back to bundled:', err?.message);
      }
   }

   // Local / fallback: bundled Chromium, installing it once if the binary is missing.
   try {
      return await chromium.launch({ headless: true, args });
   } catch (err) {
      console.warn('[prerender] Chromium launch failed, attempting install…', err?.message);
      const r = spawnSync('npx', ['playwright', 'install', 'chromium'], { stdio: 'inherit', shell: true });
      if (r.status !== 0) {
         console.warn('[prerender] chromium install failed; skipping prerender.');
         return null;
      }
      try {
         return await chromium.launch({ headless: true, args });
      } catch (err2) {
         console.warn('[prerender] Chromium still unavailable; skipping prerender.', err2?.message);
         return null;
      }
   }
}

/** Write snapshot for one route to dist/<route>/index.html. */
async function writeSnapshot(route, html) {
   const clean = route.replace(/\/+$/, '') || '/';
   const outDir = clean === '/' ? DIST : join(DIST, clean);
   await mkdir(outDir, { recursive: true });
   await writeFile(join(outDir, 'index.html'), html, 'utf8');
   return join(outDir, 'index.html');
}

// A valid snapshot must clear this size; anything smaller is the near-empty SPA shell
// captured before the route finished rendering.
const MIN_SNAPSHOT_BYTES = 4000;

async function snapshotOnce(browser, route) {
   const page = await browser.newPage();
   try {
      // Block ALL external requests (Supabase, RPC, PostHog, Google Fonts, Telegram, …).
      // The public content routes render entirely from the local bundle, so blocking these
      // has no effect on rendered DOM — but it prevents the page from hanging on external
      // connections that never settle in Vercel's restricted build sandbox (the real cause
      // of the earlier mass timeouts) and makes each render fast.
      await page.route('**/*', (r) => {
         const u = r.request().url();
         if (u.startsWith(`http://127.0.0.1:${PORT}`) || u.startsWith(`http://localhost:${PORT}`) || u.startsWith('data:') || u.startsWith('blob:')) {
            return r.continue();
         }
         return r.abort();
      });
      // Wait only for the document + scripts, NOT networkidle — external connections the app
      // opens on load never idle in the sandbox. The ready-flag/body waits below are the real gate.
      await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      // Every prerendered route calls usePageSeo, which sets this flag once it has
      // applied its <head>. Require it — proceeding early is what produced thin shells.
      await page.waitForFunction((flag) => window[flag] === true, READY_FLAG, { timeout: READY_TIMEOUT }).catch(() => {});
      // Belt-and-braces: also wait until the body actually has rendered content, so large
      // pages that mount after the flag aren't snapshotted half-built.
      await page.waitForFunction(() => (document.body?.innerText.trim().length ?? 0) > 600, null, { timeout: BODY_TIMEOUT }).catch(() => {});
      await page.waitForTimeout(200);
      let html = await page.content();
      if (!/^<!doctype html>/i.test(html)) html = '<!doctype html>\n' + html;
      // The app derives canonical / og:url / og:image / JSON-LD URLs from
      // window.location.origin, which is the local prerender server. Rewrite those to
      // the production origin so the static <head> crawlers see is correct. (Static
      // asset refs are root-relative "/assets/…" and are unaffected.)
      html = html.split(`http://127.0.0.1:${PORT}`).join(PROD_ORIGIN).split(`http://localhost:${PORT}`).join(PROD_ORIGIN);
      const title = await page.title();
      return { html, title, bytes: html.length };
   } finally {
      await page.close();
   }
}

async function prerenderRoute(browser, route) {
   let last;
   // Up to 3 attempts: rendering can be starved and snapshot a thin shell.
   for (let attempt = 1; attempt <= 3; attempt++) {
      try {
         const snap = await snapshotOnce(browser, route);
         last = snap;
         if (snap.bytes >= MIN_SNAPSHOT_BYTES) {
            const out = await writeSnapshot(route, snap.html);
            return { route, ok: true, out, title: snap.title, bytes: snap.bytes, attempt };
         }
      } catch (err) {
         last = { error: err?.message };
      }
   }
   // All attempts thin/failed. Do NOT write a thin snapshot — leaving no file lets the
   // vercel.json rewrite fall through to the SPA, which renders the route via JS with
   // correct runtime SEO. A written thin shell would be strictly worse for crawlers.
   return { route, ok: false, error: last?.error ?? `thin snapshot (<${MIN_SNAPSHOT_BYTES}b)`, bytes: last?.bytes };
}

// Diagnostic marker served at /prerender-status.json — lets us confirm from the
// deployed site whether this script ran and whether Chromium was available, without
// access to the Vercel build log.
async function writeStatus(status) {
   try {
      await writeFile(join(DIST, 'prerender-status.json'), JSON.stringify({ script: 'prerender-seo', ...status }), 'utf8');
   } catch {
      /* ignore */
   }
}

async function main() {
   if (!existsSync(join(DIST, 'index.html'))) {
      console.warn(`[prerender] ${DIST}/index.html not found — did vite build run? Skipping.`);
      process.exit(0);
   }
   await writeStatus({ ran: true, stage: 'started', routes: PRERENDER_ROUTES.length });
   const browser = await loadChromium();
   if (!browser) {
      console.warn('[prerender] No browser available — skipping snapshot (site still works via runtime SEO).');
      await writeStatus({ ran: true, stage: 'no-browser', chromium: false, routes: PRERENDER_ROUTES.length, ok: 0 });
      process.exit(0);
   }
   const server = await startServer();
   console.log(`[prerender] serving ${DIST} on :${PORT}; ${PRERENDER_ROUTES.length} routes`);

   const results = [];
   const queue = [...PRERENDER_ROUTES];
   async function worker() {
      while (queue.length) {
         const route = queue.shift();
         const r = await prerenderRoute(browser, route);
         results.push(r);
         console.log(r.ok ? `  ✓ ${r.route}  (${r.bytes}b) — ${r.title}` : `  ✗ ${r.route} — ${r.error}`);
      }
   }
   await Promise.all(Array.from({ length: CONCURRENCY }, worker));

   await browser.close();
   server.close();

   const failed = results.filter((r) => !r.ok);
   console.log(`[prerender] done: ${results.length - failed.length} ok, ${failed.length} failed`);
   await writeStatus({
      ran: true,
      stage: 'done',
      chromium: true,
      routes: PRERENDER_ROUTES.length,
      ok: results.length - failed.length,
      failed: failed.length,
      // A couple of sample errors make a bad build diagnosable from the deployed
      // marker alone, without digging through Vercel build logs.
      errors: failed.slice(0, 3).map((r) => `${r.route}: ${r.error}`),
   });
   // Never fail the build over prerender misses — runtime SEO is the safety net.
   process.exit(0);
}

main().catch((err) => {
   console.warn('[prerender] unexpected error (skipping, build continues):', err?.message);
   process.exit(0);
});
