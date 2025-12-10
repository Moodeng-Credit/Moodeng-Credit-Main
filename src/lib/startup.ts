/**
 * Server startup module
 *
 * With Supabase, database initialization is handled automatically.
 * This file is kept for backwards compatibility and future startup hooks.
 */

const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE === 'phase-development-build';

if (!isBuildTime && typeof window === 'undefined') {
   console.log('🚀 Server startup: Using Supabase for database...');
   console.log('✅ Server startup: No explicit database initialization needed');
}
