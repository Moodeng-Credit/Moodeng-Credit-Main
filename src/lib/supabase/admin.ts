import { createClient } from '@supabase/supabase-js';

/**
 * Supabase admin client for server-side operations that need elevated privileges.
 * Uses the secret key - NEVER expose this client in browser/client components!
 *
 * Use cases:
 * - Creating users via admin API (Telegram auth, Wallet auth)
 * - Bypassing Row Level Security policies
 * - Managing auth sessions manually
 */
export const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
   auth: {
      autoRefreshToken: false,
      persistSession: false
   }
});

/**
 * Create a fresh admin client instance.
 * Use when you need to ensure no shared state.
 */
export function createSupabaseAdminClient() {
   return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
      auth: {
         autoRefreshToken: false,
         persistSession: false
      }
   });
}
