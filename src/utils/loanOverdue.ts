import { parseDateSafely } from './dateFormatters';

/**
 * Hours after a loan's stored due date before it is treated as overdue / a
 * realized loss.
 *
 * `due_date` is stored at midnight UTC (= 8:00 AM Manila). Comparing it
 * directly against `now` flips a loan to "overdue" at the very start of its due
 * day — a full day before the loan is actually late, so a borrower who still
 * has all day to repay already shows up as a loss on the lender's dashboard.
 *
 * The backend `loan-overdue-notifications` job applies the same grace window
 * (env `OVERDUE_GRACE_HOURS`, default 24) before it sends an overdue notice, so
 * every lender-facing loss / default indicator must use the same window to stay
 * consistent with the rest of the system. Keep this value in sync with that job.
 */
export const LOAN_OVERDUE_GRACE_HOURS = 24;

const GRACE_MS = LOAN_OVERDUE_GRACE_HOURS * 60 * 60 * 1000;

/**
 * Returns true once a loan has passed its due date plus the grace window — i.e.
 * the due day has fully elapsed. A loan due "today" is NOT yet past due.
 */
export const isLoanPastDue = (dueDate: string | Date | null | undefined, now: Date = new Date()): boolean => {
   if (!dueDate) return false;
   return parseDateSafely(dueDate).getTime() + GRACE_MS <= now.getTime();
};
