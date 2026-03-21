import { createBrowserClient } from '@supabase/ssr';

function readSupabaseBrowserEnv(): { url: string; key: string } {
   const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
   const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
   return { url, key };
}

/** True when env exposes a real HTTP(S) project URL and a non-empty publishable key (not encrypted placeholders). */
export function isSupabaseBrowserConfigured(): boolean {
   const { url, key } = readSupabaseBrowserEnv();
   return /^https?:\/\//i.test(url) && key.length > 0;
}

function supabaseBrowserConfigErrorMessage(): string {
   const { url, key } = readSupabaseBrowserEnv();
   if (url.startsWith('encrypted:') || key.startsWith('encrypted:')) {
      return (
         'Supabase env values are still encrypted. Run `pnpm run dev` or `pnpm run dev:local` (dotenvx) and add `.env.keys` from the team so VITE_SUPABASE_URL decrypts to https://….supabase.co.'
      );
   }
   if (!url) {
      return 'Missing VITE_SUPABASE_URL. Set it to your project URL (https://….supabase.co).';
   }
   if (!/^https?:\/\//i.test(url)) {
      return `Invalid VITE_SUPABASE_URL (must start with http:// or https://). Got: ${url.slice(0, 80)}${url.length > 80 ? '…' : ''}`;
   }
   if (!key) {
      return 'Missing VITE_SUPABASE_PUBLISHABLE_KEY.';
   }
   return 'Supabase browser env is invalid.';
}

/**
 * Supabase browser client for client-side operations.
 * Safe to use in browser - uses publishable key.
 */
export function createSupabaseBrowserClient() {
   if (!isSupabaseBrowserConfigured()) {
      throw new Error(supabaseBrowserConfigErrorMessage());
   }
   const { url, key } = readSupabaseBrowserEnv();
   return createBrowserClient(url, key);
}

// Singleton instance for client components
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
   if (!browserClient) {
      browserClient = createSupabaseBrowserClient();
   }
   return browserClient;
}
