// Supabase Client Exports
// ========================
// This module provides all Supabase client configurations for different contexts.

// Browser client - for Client Components
export { createSupabaseBrowserClient, getSupabaseBrowserClient } from '@/lib/supabase/client';

// Server client - for Server Components and Server Actions
export { createSupabaseServerClient } from '@/lib/supabase/server';

// Admin client - for elevated server-side operations (NEVER use in browser)
export { createSupabaseAdminClient, supabaseAdmin } from '@/lib/supabase/admin';

// Middleware helper - for session refresh
export { updateSession } from '@/lib/supabase/middleware';

// Database types
export * from '@/lib/supabase/types';
