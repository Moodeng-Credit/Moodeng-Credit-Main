import { MONTHS } from '@/constants/dates';

/**
 * Safely parse a date that might be a Date object, ISO string, or timestamp
 * Prisma returns proper Date objects, so this is simplified
 */
export const parseDateSafely = (dateValue: string | Date): Date => {
   // Already a Date object
   if (dateValue instanceof Date) {
      return dateValue;
   }

   // ISO string or timestamp
   return new Date(dateValue);
};

/**
 * Format an ISO date string to a readable format (e.g., "January 15, 2024")
 */
export const formatDate = (isoDateString: string): string => {
   const [year, month, day] = isoDateString.split('T')[0].split('-');
   return `${MONTHS[parseInt(month)]} ${day}, ${year}`;
};

/**
 * Calculate the number of days between two dates
 */
export const calculateDaysBetween = (date1: Date, date2: Date): number => {
   const timeDiff = Math.abs(date2.getTime() - date1.getTime());
   return Math.round(timeDiff / (1000 * 60 * 60 * 24));
};

/**
 * Get "Member since" text with date and days count
 */
export const getMemberSinceText = (createdAt: string | Date): string => {
   const date = parseDateSafely(createdAt);
   const isoString = date.toISOString();
   const formattedDate = formatDate(isoString);
   const days = calculateDaysBetween(date, new Date());
   return `${formattedDate} (${days} days)`;
};

/**
 * Calculate days remaining from a loan's created date and duration
 */
export const calculateDaysRemaining = (createdAt: string | Date, totalDays: number): number => {
   const created = parseDateSafely(createdAt);
   const today = new Date();
   created.setHours(0, 0, 0, 0);
   today.setHours(0, 0, 0, 0);
   const timeDifference = today.getTime() - created.getTime();
   return Math.round(totalDays - timeDifference / (1000 * 60 * 60 * 24));
};

/**
 * Get due date from created date and days duration
 */
export const calculateDueDate = (createdAt: string | Date, days: number): string => {
   const created = parseDateSafely(createdAt);
   const dueDate = new Date(created);
   dueDate.setDate(created.getDate() + days);
   return dueDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
   });
};
