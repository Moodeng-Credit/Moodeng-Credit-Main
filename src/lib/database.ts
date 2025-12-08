/**
 * @deprecated This file is deprecated. Use Supabase clients from @/lib/supabase instead.
 *
 * Migration Guide:
 * - Browser client: import { getSupabaseBrowserClient } from '@/lib/supabase'
 * - Server client: import { createSupabaseServerClient } from '@/lib/supabase'
 * - Admin client: import { supabaseAdmin } from '@/lib/supabase'
 *
 * Example:
 * // Before (Prisma):
 * import { prisma } from '@/lib/database';
 * const users = await prisma.user.findMany();
 *
 * // After (Supabase):
 * import { createSupabaseServerClient } from '@/lib/supabase';
 * const supabase = await createSupabaseServerClient();
 * const { data: users } = await supabase.from('users').select('*');
 */

// Re-export Supabase clients for easier migration
export {
    createSupabaseAdminClient, createSupabaseBrowserClient, createSupabaseServerClient, getSupabaseBrowserClient, supabaseAdmin
} from '@/lib/supabase';

// Deprecated: kept for backwards compatibility during migration
export default async function connectDB() {
  console.warn('⚠️ connectDB() is deprecated. Database connection is handled by Supabase.');
  return null;
}

export async function initializeDatabase() {
  console.warn('⚠️ initializeDatabase() is deprecated. Database is managed by Supabase.');
  return null;
}
