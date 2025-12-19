import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase browser client for client-side operations.
 * Safe to use in browser - uses publishable key.
 */
export function createSupabaseBrowserClient() {
   return createBrowserClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!);
}

// Singleton instance for client components
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
   if (!browserClient) {
      browserClient = createSupabaseBrowserClient();
   }
   return browserClient;
}
