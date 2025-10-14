import { initializeDatabase } from '@/lib/database';

const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE === 'phase-development-build';

if (!isBuildTime && typeof window === 'undefined') {
   console.log('🚀 Server startup: Initializing database...');

   initializeDatabase()
      .then(() => {
         console.log('✅ Server startup: Database initialization completed');
      })
      .catch((error) => {
         console.error('❌ Server startup: Database initialization failed:', error);
         process.exit(1);
      });
}
