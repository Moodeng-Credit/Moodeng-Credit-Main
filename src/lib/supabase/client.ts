import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase browser client for client-side operations.
 * Safe to use in browser - uses publishable key.
 */
export function createSupabaseBrowserClient() {
   return createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
   );
}

// Singleton instance for client components
let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
   if (!browserClient) {
      browserClient = createSupabaseBrowserClient();
   }
   return browserClient;
}
