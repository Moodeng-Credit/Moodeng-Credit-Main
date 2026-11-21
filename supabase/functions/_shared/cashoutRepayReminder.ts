// After a borrower cashes out, remind them what they owe and when (George, 2026-11-21): the funded
// notice names the due date, but by cash-out time it's scrolled away. Pure helpers, used by
// withdrawal-notification for the Messenger message and the repay line on email + Telegram.

import { effectiveAmountDue, effectiveDueDate } from './repaymentSchedule.ts';

export type OpenLoan = {
   due_date: string | null;
   total_repayment_amount: number | string | null;
   repaid_amount: number | string | null;
   repayment_schedule?: unknown;
};

export type NextRepay = { amount: number; dueIso: string };

const toNumber = (value: number | string | null | undefined) => {
   const n = Number(value ?? 0);
   return Number.isFinite(n) ? n : 0;
};

const roundCents = (n: number) => Math.round(n * 100) / 100;

/** The soonest payment still owed across the borrower's open loans, or null when nothing is owed. */
export const pickNextRepay = (loans: OpenLoan[]): NextRepay | null => {
   let best: NextRepay | null = null;
   for (const loan of loans) {
      const left = roundCents(toNumber(loan.total_repayment_amount) - toNumber(loan.repaid_amount));
      if (left <= 0.005) continue;
      const dueIso = effectiveDueDate(loan);
      if (!dueIso) continue;
      const amount = effectiveAmountDue(loan) ?? left;
      if (!best || dueIso < best.dueIso) best = { amount, dueIso };
   }
   return best;
};

const formatAmount = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const formatDay = (iso: string) =>
   new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** "Repay 16.5 USDC by Dec 5, 2026", or the overdue wording when that day has passed (Manila date). */
export const repayLine = (repay: NextRepay, now = new Date()): string => {
   const today = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
   const amount = `${formatAmount(repay.amount)} USDC`;
   return repay.dueIso.slice(0, 10) < today
      ? `Your payment of ${amount} is overdue. Repay now to protect your credit level.`
      : `Don't forget: repay ${amount} by ${formatDay(repay.dueIso)} to level up to bigger loans.`;
};

export const REPAY_URL = 'https://moodeng.app/repay';

/** The Messenger text sent when a cash-out goes through. */
export const buildCashoutMessengerText = (amount: number, exchange: string, repay: NextRepay | null, now = new Date()): string => {
   const sent = `✅ Cash-out sent! Your ${formatAmount(amount)} USDC is on its way to ${exchange}. It usually arrives in a few minutes.`;
   if (!repay) return sent;
   return `${sent}\n\n📅 ${repayLine(repay, now)}\nRepay here 👉 ${REPAY_URL}`;
};
