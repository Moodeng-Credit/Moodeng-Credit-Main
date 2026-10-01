import { DEFAULT_LOAN_TIMEZONE, getDueDayEnd, isUsableTimezone } from '@/lib/loanDeadline';

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
 * The moment a loan counts as overdue / a loss: the later of the stored due date + 24h and the end
 * of the borrower's due day in their zone (`loans.due_timezone`, else Manila). Same moment as the
 * on-time rule for points (app_private.is_loan_repaid_on_time), so Manila is unchanged and borrowers
 * west of UTC keep their whole day.
 */
export const getLoanPastDueAt = (dueDate: string | Date, dueTimezone?: string | null): Date => {
   const graced = parseDateSafely(dueDate).getTime() + GRACE_MS;
   const zone = isUsableTimezone(dueTimezone) ? dueTimezone : DEFAULT_LOAN_TIMEZONE;
   return new Date(Math.max(graced, getDueDayEnd(dueDate, zone).getTime()));
};

/**
 * Returns true once a loan is past {@link getLoanPastDueAt} — i.e. it is genuinely a loss. A loan
 * whose repayment is simply due today is NOT yet past due.
 */
export const isLoanPastDue = (
   dueDate: string | Date | null | undefined,
   now: Date = new Date(),
   dueTimezone?: string | null
): boolean => {
   if (!dueDate) return false;
   return getLoanPastDueAt(dueDate, dueTimezone).getTime() <= now.getTime();
};

/** Days we wait past the deadline before calling a loan "late" / "default" in public, in case of tech issues. */
export const PUBLIC_LATE_GRACE_DAYS = 3;
const PUBLIC_GRACE_MS = PUBLIC_LATE_GRACE_DAYS * 24 * 60 * 60 * 1000;

/** The moment public labels (profile, history) may say "Late" / "Default". */
export const getPublicLateAt = (dueDate: string | Date, dueTimezone?: string | null): Date =>
   new Date(getLoanPastDueAt(dueDate, dueTimezone).getTime() + PUBLIC_GRACE_MS);

/** Unpaid and more than {@link PUBLIC_LATE_GRACE_DAYS} days past the deadline. */
export const isPublicDefault = (
   dueDate: string | Date | null | undefined,
   dueTimezone?: string | null,
   now: Date = new Date()
): boolean => !!dueDate && getPublicLateAt(dueDate, dueTimezone).getTime() <= now.getTime();

/** Repaid more than {@link PUBLIC_LATE_GRACE_DAYS} days past the deadline. */
export const wasRepaidPublicLate = (
   dueDate: string | Date | null | undefined,
   paidAt: string | Date | null | undefined,
   dueTimezone?: string | null
): boolean => !!dueDate && !!paidAt && parseDateSafely(paidAt).getTime() >= getPublicLateAt(dueDate, dueTimezone).getTime();
