import { parseDateSafely } from './dateFormatters';

/**
 * Whether a loan should be treated as overdue / a realized loss.
 *
 * A loan counts as past due only once its due **date** has fully passed — a loan
 * due *today* is not a loss, because the borrower still has the whole day to
 * repay. There is no arbitrary grace window: we simply compare calendar days
 * (UTC, the same basis `due_date` is stored on — midnight UTC) rather than the
 * exact timestamp. So a loan due today flips to overdue at the start of the next
 * day, and a loan whose due date is already in the past stays a loss.
 */
export const isLoanPastDue = (dueDate: string | Date | null | undefined, now: Date = new Date()): boolean => {
   if (!dueDate) return false;
   const due = parseDateSafely(dueDate);
   const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
   const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
   return nowDay > dueDay;
};
