import { parseDateSafely } from './dateFormatters';

/**
 * Grace period, in hours, after a loan's stored due date before it is treated as
 * overdue / a realized loss.
 *
 * `due_date` is stored as a single UTC instant (midnight UTC), but borrowers and
 * lenders are spread across time zones, so that instant does not line up with
 * the end of the borrower's local day. A flat 24-hour grace guarantees every
 * borrower a full day past their due date, whatever their zone, before the loan
 * counts against the lender — and matches the backend `loan-overdue-notifications`
 * job (env `OVERDUE_GRACE_HOURS`, default 24). Keep this in sync with that job.
 */
export const LOAN_OVERDUE_GRACE_HOURS = 24;

const GRACE_MS = LOAN_OVERDUE_GRACE_HOURS * 60 * 60 * 1000;

/**
 * Returns true once a loan is more than the grace window past its due date — i.e.
 * it is genuinely a loss. A loan whose repayment is simply due (within the last
 * {@link LOAN_OVERDUE_GRACE_HOURS} hours) is NOT yet past due.
 */
export const isLoanPastDue = (dueDate: string | Date | null | undefined, now: Date = new Date()): boolean => {
   if (!dueDate) return false;
   return parseDateSafely(dueDate).getTime() + GRACE_MS <= now.getTime();
};
