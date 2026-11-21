/**
 * Two-payment loans (George, 2026-11-15): ONE loan row, paid back in milestones.
 *
 * loans.repayment_schedule = [{ due: 'YYYY-MM-DD', amount }, ...], ascending, summing to
 * total_repayment_amount. loans.due_date stays the FINAL payment's date, so lenders, the vault and
 * everything keyed on due_date see the loan's real length. NULL = a normal single-payment loan.
 *
 * Mirrored server-side in supabase/functions/_shared/repaymentSchedule.ts and checked by the
 * private.enforce_loan_repayment_schedule trigger (20261115190000_loan_repayment_schedule.sql).
 */

export interface RepaymentMilestone {
   /** Calendar day in the borrower's timezone, 'YYYY-MM-DD'. */
   due: string;
   amount: number;
}

/** Loans above this (USD borrowed) can be split. */
export const SPLIT_MIN_LOAN_AMOUNT = 60;
/** The whole loan must run at least this long to split, so each payment gets ~2 weeks. */
export const SPLIT_MIN_TERM_DAYS = 28;
export const SPLIT_PARTS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (value: string) => value.slice(0, 10);
const dayToUtc = (day: string) => Date.parse(`${isoDay(day)}T00:00:00Z`);
const roundCents = (n: number) => Math.round(n * 100) / 100;

export function daysBetween(fromDay: string, toDay: string): number {
   return Math.round((dayToUtc(toDay) - dayToUtc(fromDay)) / DAY_MS);
}

/** Whether a request with these terms may offer "Pay in 2 parts". */
export function canSplitRepayment(loanAmount: number, todayDay: string, finalDay: string): boolean {
   if (!Number.isFinite(loanAmount) || loanAmount <= SPLIT_MIN_LOAN_AMOUNT) return false;
   if (!todayDay || !finalDay) return false;
   return daysBetween(todayDay, finalDay) >= SPLIT_MIN_TERM_DAYS;
}

/**
 * Two equal payments: the first halfway between today and the final date, the second on the final
 * date. Any odd cent goes on the second payment so the parts always add up to the total.
 */
export function buildTwoPartSchedule(total: number, todayDay: string, finalDay: string): RepaymentMilestone[] {
   const span = daysBetween(todayDay, finalDay);
   const firstDue = new Date(dayToUtc(todayDay) + Math.round(span / 2) * DAY_MS).toISOString().slice(0, 10);
   // Rounded down, so an odd cent always lands on the second payment.
   const first = Math.floor(roundCents(total) * 50 + 1e-6) / 100;
   return [
      { due: firstDue, amount: first },
      { due: isoDay(finalDay), amount: roundCents(total - first) }
   ];
}

/** Reads loans.repayment_schedule defensively; anything malformed counts as no schedule. */
export function parseRepaymentSchedule(raw: unknown): RepaymentMilestone[] | null {
   if (!Array.isArray(raw) || raw.length < 2) return null;
   const parts: RepaymentMilestone[] = [];
   for (const item of raw) {
      const due = typeof item?.due === 'string' ? isoDay(item.due) : '';
      const amount = Number(item?.amount);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || !Number.isFinite(amount) || amount <= 0) return null;
      parts.push({ due, amount });
   }
   return parts;
}

export interface NextMilestone {
   /** 0-based index into the schedule. */
   index: number;
   count: number;
   due: string;
   /** What's still owed on this payment after what they've already paid. */
   amountLeft: number;
   /** The payment's full size. */
   amount: number;
}

/** The first payment not yet covered by `repaid`, or null when everything is paid. */
export function nextMilestone(schedule: RepaymentMilestone[], repaid: number): NextMilestone | null {
   let cumulative = 0;
   const paid = Number.isFinite(repaid) ? repaid : 0;
   for (let index = 0; index < schedule.length; index++) {
      cumulative = roundCents(cumulative + schedule[index].amount);
      if (paid + 0.005 < cumulative) {
         return {
            index,
            count: schedule.length,
            due: schedule[index].due,
            amount: schedule[index].amount,
            amountLeft: roundCents(Math.min(schedule[index].amount, cumulative - paid))
         };
      }
   }
   return null;
}

/**
 * The due date that matters right now: the next unpaid payment's day for a split loan, otherwise
 * the loan's own dueDate. Same shape as loans.due_date (00:00 UTC of the day), so every
 * end-of-their-day helper treats both alike.
 */
export function currentDueDate(loan: { dueDate: string; repaidAmount?: number | string | null; repaymentSchedule?: RepaymentMilestone[] | null }): string {
   if (!loan.repaymentSchedule?.length) return loan.dueDate;
   const next = nextMilestone(loan.repaymentSchedule, Number(loan.repaidAmount ?? 0));
   return next ? `${next.due}T00:00:00.000Z` : loan.dueDate;
}

/** The next payment (split loans only): which one, and what's still owed on it. Null otherwise. */
export function currentMilestone(loan: { repaidAmount?: number | string | null; repaymentSchedule?: RepaymentMilestone[] | null }): NextMilestone | null {
   if (!loan.repaymentSchedule?.length) return null;
   return nextMilestone(loan.repaymentSchedule, Number(loan.repaidAmount ?? 0));
}

const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "Dec 15" from 'YYYY-MM-DD'. */
export const formatMilestoneDay = (day: string) => SHORT_DATE.format(new Date(dayToUtc(day)));

/** "$55 Dec 15 · $55 Jan 15" */
export function describeSchedule(schedule: RepaymentMilestone[]): string {
   return schedule.map((part) => `$${part.amount.toFixed(2).replace(/\.00$/, '')} ${formatMilestoneDay(part.due)}`).join(' · ');
}
