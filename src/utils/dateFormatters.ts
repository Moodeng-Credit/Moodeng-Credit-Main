import { MONTHS } from '@/constants/dates';

/**
 * Safely parse a date that might be a Date object, ISO string, or timestamp
 * Handles TIMESTAMPTZ from Supabase which includes timezone info (e.g., 2025-12-21T00:00:00+00:00)
 */
export const parseDateSafely = (dateValue: string | Date): Date => {
   // Already a Date object
   if (dateValue instanceof Date) {
      return dateValue;
   }

   // ISO string or timestamp - new Date() handles timezone correctly
   const date = new Date(dateValue);
   
   if (isNaN(date.getTime())) {
      console.warn('Invalid date:', dateValue);
      return new Date();
   }
   
   return date;
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
 * Calculate days remaining from due date
 * Works with UTC timestamps from Supabase TIMESTAMPTZ
 */
export const calculateDaysRemaining = (dueDate: string | Date): number => {
   const dueUTC = parseDateSafely(dueDate);
   
   // Get today's date in UTC at midnight
   const todayUTC = new Date();
   const year = todayUTC.getUTCFullYear();
   const month = todayUTC.getUTCMonth();
   const day = todayUTC.getUTCDate();
   const today = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
   
   // Get due date at midnight UTC
   const dueYear = dueUTC.getUTCFullYear();
   const dueMonth = dueUTC.getUTCMonth();
   const dueDay = dueUTC.getUTCDate();
   const dueAtMidnight = new Date(Date.UTC(dueYear, dueMonth, dueDay, 0, 0, 0, 0));
   
   const timeDifference = dueAtMidnight.getTime() - today.getTime();
   return Math.round(timeDifference / (1000 * 60 * 60 * 24));
};

/**
 * Get formatted due date from due date string
 * Works with UTC timestamps from Supabase TIMESTAMPTZ
 */
export const calculateDueDate = (dueDate: string | Date): string => {
   const dueUTC = parseDateSafely(dueDate);
   
   // Extract UTC components
   const year = dueUTC.getUTCFullYear();
   const month = dueUTC.getUTCMonth() + 1; // getUTCMonth() returns 0-11
   const day = dueUTC.getUTCDate();
   
   // Get month name
   const monthName = MONTHS[month];
   
   return `${monthName} ${day}, ${year}`;
};
