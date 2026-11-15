// Two-payment loans: ONE loan row paid back in milestones (George, 2026-11-15).
// Server copy of src/lib/repaymentSchedule.ts (edge functions can't import from src/).
//
// loans.repayment_schedule = [{ due: 'YYYY-MM-DD', amount }, ...], ascending, summing to
// total_repayment_amount. loans.due_date is the LAST payment's date. NULL = a single payment.

export interface RepaymentMilestone {
   due: string;
   amount: number;
}

const roundCents = (n: number) => Math.round(n * 100) / 100;

export function parseRepaymentSchedule(raw: unknown): RepaymentMilestone[] | null {
   if (!Array.isArray(raw) || raw.length < 2) return null;
   const parts: RepaymentMilestone[] = [];
   for (const item of raw) {
      const due = typeof item?.due === 'string' ? item.due.slice(0, 10) : '';
      const amount = Number(item?.amount);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || !Number.isFinite(amount) || amount <= 0) return null;
      parts.push({ due, amount });
   }
   return parts;
}

export interface NextMilestone {
   index: number;
   count: number;
   due: string;
   amount: number;
   /** Still owed on this payment after what's been paid. */
   amountLeft: number;
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
 * The due date a reminder should use for a loan: the next unpaid payment's day for a split loan,
 * otherwise the loan's own due_date. Returned as an ISO string at 00:00 UTC of that day — the same
 * shape loans.due_date is stored in, so dueDayBounds() treats both alike.
 */
export function effectiveDueDate(loan: { due_date?: string | null; repayment_schedule?: unknown; repaid_amount?: number | string | null }): string | null {
   const schedule = parseRepaymentSchedule(loan.repayment_schedule);
   if (!schedule) return loan.due_date ?? null;
   const next = nextMilestone(schedule, Number(loan.repaid_amount ?? 0));
   if (!next) return loan.due_date ?? null;
   return `${next.due}T00:00:00.000Z`;
}

/** What a reminder should ask for now: the next payment's remaining amount, or null for a single-payment loan. */
export function effectiveAmountDue(loan: { repayment_schedule?: unknown; repaid_amount?: number | string | null }): number | null {
   const schedule = parseRepaymentSchedule(loan.repayment_schedule);
   if (!schedule) return null;
   return nextMilestone(schedule, Number(loan.repaid_amount ?? 0))?.amountLeft ?? null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export type ScheduleView<T> = T & {
   /** Reminder rows sent before this belong to an earlier payment (due-soon reminders). */
   reminders_count_after?: string | null;
   /** Same, for overdue reminders: rows before this payment's due day were for an earlier payment. */
   overdue_count_after?: string | null;
};

/**
 * How reminders should see a loan right now. A split loan becomes its next unpaid payment:
 * due_date = that payment's day, and total_repayment_amount = repaid + what that payment still
 * needs, so "amount due" (total − repaid) is the payment, not the whole loan. Single-payment loans
 * come back unchanged. Only for reminder text and timing — never write it back.
 *
 * Earlier payments' reminder rows (loan_notifications, keyed by loan + type) must not block the
 * next payment's, so the view also says from when a sent row counts.
 */
export function reminderView<
   T extends { due_date?: string | null; total_repayment_amount?: number | string | null; repaid_amount?: number | string | null; repayment_schedule?: unknown }
>(loan: T): ScheduleView<T> {
   const schedule = parseRepaymentSchedule(loan.repayment_schedule);
   if (!schedule) return loan;
   const repaid = Number(loan.repaid_amount ?? 0);
   const next = nextMilestone(schedule, repaid);
   if (!next) return loan;
   const dueIso = `${next.due}T00:00:00.000Z`;
   const prev = next.index > 0 ? schedule[next.index - 1] : null;
   return {
      ...loan,
      due_date: dueIso,
      total_repayment_amount: roundCents(repaid + next.amountLeft),
      // The last due-soon reminder for a payment goes out on its due day; 2 days later is safely past it.
      reminders_count_after: prev ? new Date(Date.parse(`${prev.due}T00:00:00Z`) + 2 * DAY_MS).toISOString() : null,
      overdue_count_after: next.index > 0 ? dueIso : null
   };
}

/** Whether a sent reminder row still counts for the loan's current payment. */
export function reminderRowCounts(sentAt: string | null | undefined, countAfter: string | null | undefined): boolean {
   if (!countAfter) return true;
   if (!sentAt) return true;
   return Date.parse(sentAt) >= Date.parse(countAfter);
}

const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
export const formatMilestoneDay = (day: string) => SHORT_DATE.format(new Date(`${day}T00:00:00Z`));

/** "$55 Dec 15 · $55 Jan 15" */
export function describeSchedule(schedule: RepaymentMilestone[]): string {
   return schedule.map((part) => `$${part.amount.toFixed(2).replace(/\.00$/, '')} ${formatMilestoneDay(part.due)}`).join(' · ');
}
