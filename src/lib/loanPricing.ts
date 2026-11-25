// Single source of truth for "what return should a loan of this size offer?".
// Used by the borrower-facing loan-request nudge (LoanRequestModal) and the admin
// "Loan pricing health" analytics section, so the two can never drift.
//
// The bigger the loan, the higher the return lenders expect. Anchors come from real
// funded loans (~$15-20 → $2-5, ~$40-60 → $5-10, ~$80-100 → $15-20); values between
// anchors are linearly interpolated and clamped past the ends. Guidance only — nothing
// is ever enforced. Once there's enough funded-loan history these could be recalibrated
// from data (that's what the admin section is for).

export const RETURN_ANCHORS = [
   { principal: 17.5, lo: 2, hi: 5 },
   { principal: 50, lo: 5, hi: 10 },
   { principal: 90, lo: 15, hi: 20 }
] as const;

export interface ReturnRange {
   lo: number;
   hi: number;
}

// Suggested return range (repay minus borrow, in USDC) for a given loan principal.
// Returns null for a non-positive / non-finite principal.
export function suggestedReturnRange(principal: number): ReturnRange | null {
   if (!Number.isFinite(principal) || principal <= 0) return null;
   const first = RETURN_ANCHORS[0];
   const last = RETURN_ANCHORS[RETURN_ANCHORS.length - 1];
   const at = (key: 'lo' | 'hi') => {
      if (principal <= first.principal) return first[key];
      if (principal >= last.principal) return last[key];
      for (let i = 0; i < RETURN_ANCHORS.length - 1; i++) {
         const a = RETURN_ANCHORS[i];
         const b = RETURN_ANCHORS[i + 1];
         if (principal >= a.principal && principal <= b.principal) {
            const t = (principal - a.principal) / (b.principal - a.principal);
            return a[key] + t * (b[key] - a[key]);
         }
      }
      return last[key];
   };
   return { lo: Math.round(at('lo')), hi: Math.round(at('hi')) };
}

export type OfferBand = 'below' | 'in' | 'above';

// Classify a borrower's offered return (repay - borrow) against the suggested range for
// the loan size. Returns null when the loan or offer isn't a usable positive number.
export function classifyOffer(loanAmount: number, totalRepayment: number): OfferBand | null {
   const borrow = Number(loanAmount);
   const repay = Number(totalRepayment);
   if (!Number.isFinite(borrow) || !Number.isFinite(repay) || borrow <= 0) return null;
   const offer = repay - borrow;
   if (offer <= 0) return null;
   const range = suggestedReturnRange(borrow);
   if (!range) return null;
   if (offer < range.lo) return 'below';
   if (offer > range.hi) return 'above';
   return 'in';
}

// ---- Minimum return: 10% a month ----------------------------------------------------------------
// Lenders expect at least ~10% a month. "Borrow $15, repay $16 in 3 months" never gets funded, so the
// loan form suggests (doesn't force) at least this much: 10% for anything up to a month, prorated by
// day after that. Exact to the cent ($13 -> $14.30): George, 2026-11-23 - rounding up to the next
// $0.50 (and the old "$2-5 back" size hint) pushed a $13 borrower to offer $15.

export const MIN_MONTHLY_RETURN = 0.1;

export interface MinimumRepayment {
   /** Suggested minimum total repayment (principal + return), in USDC. */
   amount: number;
   /** Loan length in months used for it (at least 1). */
   months: number;
}

// Paid back in 2 equal parts (src/lib/repaymentSchedule.ts): half the money comes back halfway
// through, so the return is 10% a month on what's still owed — 3/4 of the single-payment return
// ($100 over 2 months: $115, not $120). George, 2026-11-15: fair to the borrower, same rate.
export const SPLIT_RETURN_FACTOR = 0.75;

export interface RepaymentOptions {
   /** Paid back in 2 equal parts: price on the declining balance. */
   split?: boolean;
}

// Up to the next cent, ignoring float dust (13 * 1.1 = 14.300000000000001 -> 14.30, not 14.31).
function toCentsUp(n: number): number {
   return Math.ceil(Math.round(n * 1e6) / 1e4) / 100;
}

export function minimumRepayment(
   principal: number,
   dueDate: string | Date | null | undefined,
   now: Date = new Date(),
   options: RepaymentOptions = {}
): MinimumRepayment | null {
   if (!Number.isFinite(principal) || principal <= 0 || !dueDate) return null;
   const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
   if (Number.isNaN(due.getTime())) return null;
   const days = Math.max(0, Math.ceil((due.getTime() - now.getTime()) / 86400000));
   const months = Math.max(1, days / 30);
   const factor = options.split ? SPLIT_RETURN_FACTOR : 1;
   const amount = toCentsUp(principal * (1 + MIN_MONTHLY_RETURN * months * factor));
   return { amount, months };
}

// The range the loan form suggests for the total repayment: from the 10%-a-month minimum up to
// twice that return ($15 for a month → $16.50–$18). With no due date yet, a month is assumed.
export function suggestedRepaymentRange(
   principal: number,
   dueDate: string | Date | null | undefined,
   now: Date = new Date(),
   options: RepaymentOptions = {}
): ReturnRange | null {
   if (!Number.isFinite(principal) || principal <= 0) return null;
   // Never under the form's "$1 more than you borrow" rule ($5 → $6, not $5.50).
   const lo = Math.max(minimumRepayment(principal, dueDate, now, options)?.amount ?? toCentsUp(principal * (1 + MIN_MONTHLY_RETURN)), principal + 1);
   const max = maximumRepayment(principal, dueDate, now) ?? Infinity;
   const hi = Math.min(Math.ceil((principal + 2 * (lo - principal)) * 2) / 2, max);
   return { lo: Math.min(lo, hi), hi };
}

// ---- Maximum return: 20% per 31 days ------------------------------------------------------------
// George, 2026-11-18: a borrower can pick any repayment, but never more than 20% on top for up to
// 31 days ($15 → at most $18). Longer loans get 20% per 31 days, prorated by day. Never below the
// $1 minimum, so tiny loans can still be requested. Same formula as the DB guard in
// app_private.enforce_new_loan_terms (20261118170000_repay_cap_20pct.sql). Indonesia keeps its own cap.

export const MAX_RETURN_PER_31_DAYS = 0.2;

export function maximumRepayment(principal: number, dueDate: string | Date | null | undefined, now: Date = new Date()): number | null {
   if (!Number.isFinite(principal) || principal <= 0) return null;
   const due = dueDate ? (dueDate instanceof Date ? dueDate : new Date(dueDate)) : null;
   const days = due && !Number.isNaN(due.getTime()) ? Math.max(0, Math.ceil((due.getTime() - now.getTime()) / 86400000)) : 31;
   const periods = Math.max(1, days / 31);
   const cap = Math.floor(principal * (1 + MAX_RETURN_PER_31_DAYS * periods) * 100 + 1e-6) / 100;
   return Math.max(cap, principal + 1);
}

// ---- Fixed terms: 10% for 30 days ---------------------------------------------------------------
// George, 2026-11-25: borrowers no longer type their own repayment or date. Every Philippines request
// is 30 days at 10% (half the 14-day loans paid the same 10% for half the time, and odd totals like
// $15 → $17 confused the dashboard and reminders). The only choice left is borrowing less than the
// limit. Two-part loans (over $60) keep their declining-balance price (SPLIT_RETURN_FACTOR, 11-15).
// Never under the "$1 more than you borrow" rule ($5 → $6). Mirrored by app_private.fixed_loan_repayment
// (20261125200000_fixed_loan_terms.sql); src/test/fixedLoanTerms.test.ts checks the table.

export const FIXED_TERM_DAYS = 30;

export function fixedRepayment(principal: number, options: RepaymentOptions = {}): number | null {
   if (!Number.isFinite(principal) || principal <= 0) return null;
   const factor = options.split ? SPLIT_RETURN_FACTOR : 1;
   const total = toCentsUp(principal * (1 + MIN_MONTHLY_RETURN * factor));
   return Math.max(total, Math.round((principal + 1) * 100) / 100);
}
