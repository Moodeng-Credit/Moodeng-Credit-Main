import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind-aware deduplication (shadcn/ui).
 */
export function cn(...inputs: ClassValue[]) {
   return twMerge(clsx(inputs));
}
