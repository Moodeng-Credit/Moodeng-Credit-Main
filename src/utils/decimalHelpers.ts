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

/**
 * Formats a value (string, Prisma.Decimal, number, etc.) to a string with max 2 decimal places
 * Removes trailing zeros: 1 = "1", 1.10 = "1.1", 1.11 = "1.11"
 *
 * @param value - The value to format (string, number, Prisma.Decimal, etc.)
 * @returns Formatted string with max 2 decimal places and no trailing zeros
 */
export const formatNumber = (value: Prisma.Decimal | number | string | null | undefined): string => {
   if (value === null || value === undefined) return '0';

   const numValue = typeof value === 'number' ? value : Number(value);

   if (isNaN(numValue)) return '0';

   return Number(numValue.toFixed(2)).toString();
};
