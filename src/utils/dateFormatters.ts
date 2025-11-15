import { MONTHS } from '@/constants/dates';

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
export const getMemberSinceText = (createdAt: string): string => {
   const formattedDate = formatDate(createdAt);
   const days = calculateDaysBetween(new Date(createdAt), new Date());
   return `${formattedDate} (${days} days)`;
};

/**
 * Calculate days remaining from a loan's created date and duration
 */
export const calculateDaysRemaining = (createdAt: string, totalDays: number): number => {
   const created = new Date(createdAt);
   const today = new Date();
   created.setHours(0, 0, 0, 0);
   today.setHours(0, 0, 0, 0);
   const timeDifference = today.getTime() - created.getTime();
   return Math.round(totalDays - timeDifference / (1000 * 60 * 60 * 24));
};

/**
 * Get due date from created date and days duration
 */
export const calculateDueDate = (createdAt: string, days: number): string => {
   const created = new Date(createdAt);
   const dueDate = new Date(created);
   dueDate.setDate(created.getDate() + days);
   return dueDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
   });
};
