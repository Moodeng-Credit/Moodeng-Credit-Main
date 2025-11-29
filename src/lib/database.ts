import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Prisma 7 requires adapter pattern for all databases
const adapter = new PrismaPg({
   connectionString: process.env.DATABASE_URL
});

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default async function connectDB() {
   try {
      await prisma.$connect();
      console.log('PostgreSQL connected successfully...');
      return prisma;
   } catch (error) {
      console.error('Error connecting to PostgreSQL:', error);
      throw error;
   }
}

// Initialize database connection and models on startup
export async function initializeDatabase() {
   try {
      console.log('🚀 Connecting to PostgreSQL (database: moodeng)...');
      await prisma.$connect();
      console.log('✅ PostgreSQL connected');

      // Auto-migrate if DO_MIGRATE is enabled
      if (process.env.DO_MIGRATE === 'true') {
         console.log('🔄 Running database migrations...');

         const { exec } = await import('child_process');
         const { promisify } = await import('util');
         const execAsync = promisify(exec);

         try {
            if (process.env.NODE_ENV === 'production') {
               // Production: use migrate deploy (safer)
               await execAsync('npx prisma migrate deploy');
            } else {
               // Development: use db push (faster, no migration files)
               await execAsync('npx prisma db push --skip-generate');
            }
            console.log('✅ Database schema synchronized');
         } catch (migrationError) {
            console.error('⚠️  Migration warning:', migrationError);
            // Don't throw - allow app to continue even if migration fails
         }
      }

      console.log('✅ Database initialized successfully');
   } catch (error) {
      console.error('❌ Failed to initialize database:', error);
      throw error;
   }
}
