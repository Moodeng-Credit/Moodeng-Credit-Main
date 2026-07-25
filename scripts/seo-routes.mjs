/**
 * Single source of truth for which PUBLIC routes get prerendered for SEO.
 *
 * Dynamic slug lists are extracted from the in-repo data modules (regex, no TS
 * compile needed) so adding a blog post / guide / money topic is picked up
 * automatically on the next build. Auth-gated routes (/support, /support/guides,
 * /support/updates, /dashboard, …) are intentionally excluded — they redirect
 * anonymous visitors to sign-in and must not be indexed.
 *
 * Consumed by scripts/prerender-seo.mjs and scripts/build-seo-routes-json.mjs.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function extractSlugs(relPath, regex) {
   try {
      const src = readFileSync(join(ROOT, relPath), 'utf8');
      const out = new Set();
      let m;
      while ((m = regex.exec(src)) !== null) out.add(m[1]);
      return [...out];
   } catch (err) {
      console.warn(`[seo-routes] could not read ${relPath}: ${err?.message}`);
      return [];
   }
}

const blogSlugs = extractSlugs('src/views/blogs/blogPosts.ts', /slug:\s*'([^']+)'/g);
const guideSlugs = extractSlugs('src/views/support/data/guides.ts', /slug:\s*'([^']+)'/g);

// Money-guide topic ids are a small, stable set; keep explicit to avoid matching
// unrelated `id:` fields in that module.
const moneyTopics = ['verify', 'add-funds', 'withdraw', 'repay'];

// Public content routes with no dynamic segment (includes /learn/why-we-use-usdc,
// which is a dedicated route, NOT a GUIDES slug).
const STATIC_ROUTES = [
   '/blogs',
   '/learn',
   '/learn/why-we-use-usdc',
   '/academy',
   '/academy/money',
   '/benefits',
   '/whylend',
   '/team',
   '/credit-leveling-guide',
   '/support/faq',
   '/support/getting-started',
   '/privacy',
   '/privacy-policy',
   '/terms',
   '/data-deletion',
];

const dynamicRoutes = [
   ...blogSlugs.map((s) => `/blogs/${s}`),
   ...guideSlugs.map((s) => `/learn/${s}`),
   ...moneyTopics.map((t) => `/academy/money/${t}`),
];

// De-dupe (a dedicated route may also appear as a slug) and sort for stable output.
export const PRERENDER_ROUTES = [...new Set([...STATIC_ROUTES, ...dynamicRoutes])].sort();

export const ROUTE_COUNTS = {
   blogs: blogSlugs.length,
   guides: guideSlugs.length,
   moneyTopics: moneyTopics.length,
   total: PRERENDER_ROUTES.length,
};
