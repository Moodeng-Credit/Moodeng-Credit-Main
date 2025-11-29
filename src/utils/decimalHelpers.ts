import type { Prisma } from '@/generated/prisma/client/client';

/**
 * Helper function to convert Prisma Decimal to number
 * This is needed because Prisma Decimal cannot be used in client components
 * (it requires Node.js APIs)
 */
export const toNumber = (value: Prisma.Decimal | number): number => {
   if (typeof value === 'number') return value;
   if (value && typeof value === 'object' && typeof value.toString === 'function') {
      return Number(value.toString());
   }
   return Number(value);
};
