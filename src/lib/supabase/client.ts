import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase browser client for client-side operations.
 * Safe to use in browser - uses publishable key.
 */
export function createSupabaseBrowserClient() {
   return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}

// Singleton instance for client components
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
   if (!browserClient) {
      browserClient = createSupabaseBrowserClient();
   }
   return browserClient;
}
