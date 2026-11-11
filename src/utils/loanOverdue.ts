import { DEFAULT_LOAN_TIMEZONE, getDueDayEnd, isUsableTimezone } from '@/lib/loanDeadline';

import { parseDateSafely } from './dateFormatters';

/**
 * The ONE deadline: a loan is due until the end of its due day on the borrower's clock
 * (`loans.due_timezone`, else Manila) and overdue from 00:00 the next day there. Repay, reminders,
 * on-time points, lender "default" and team posts all use this moment — no extra hours on top — so
 * what the borrower is told is exactly what counts. Same as app_private.loan_past_due_at and the edge
 * functions' pastDueAt.
 */
export const getLoanPastDueAt = (dueDate: string | Date, dueTimezone?: string | null): Date => {
   const zone = isUsableTimezone(dueTimezone) ? dueTimezone : DEFAULT_LOAN_TIMEZONE;
   return getDueDayEnd(parseDateSafely(dueDate), zone);
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
