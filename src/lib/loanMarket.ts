/**
 * Loan market helpers for the Indonesia track (docs/INDONESIA_TRACK.md).
 *
 * loans.market = 'ID' marks an Indonesian borrower's request (stamped from users.market by the
 * insert trigger). The client-side term checks here mirror app_private.enforce_new_loan_terms in
 * supabase/migrations/20261107120000_indonesia_track.sql so the form catches what the server would
 * reject: amount in rules.amounts, due within rules.maxTermDays, repayment ≥ amount + $1 and
 * ≤ 1.5× the amount, and the borrower approved after their call.
 */
import type { IdLoanRules } from '@/lib/idTrack';

export type LoanMarket = 'ID' | null | undefined;

/** True for an Indonesia-track request (loans.market = 'ID'). */
export const isIndonesianLoan = (loan: { market?: LoanMarket | string } | null | undefined): boolean => loan?.market === 'ID';

/** True for an Indonesia-track account (users.market = 'ID'). */
export const isIndonesianUser = (user: { market?: string | null } | null | undefined): boolean => user?.market === 'ID';

/** Most an ID borrower can repay, as a multiple of the amount (server: total ≤ amount × 1.5). */
export const ID_MAX_REPAY_MULTIPLE = 1.5;

const roundCents = (n: number) => Math.round(n * 100) / 100;

/** Lowest and highest repayment total the server accepts for an ID loan of `amount`. */
export const idRepaymentBounds = (amount: number): { min: number; max: number } => ({
   min: roundCents(amount + 1),
   max: roundCents(amount * ID_MAX_REPAY_MULTIPLE)
});

// Hand-picked totals for the standard sizes ($5 → $6 / $6.50 / $7, $10 → $11 / $12 / $13).
const ID_REPAY_EXTRAS: Record<number, number[]> = { 5: [1, 1.5, 2], 10: [1, 2, 3] };

/** Repayment totals to offer as one-tap chips for an ID loan, all inside idRepaymentBounds. */
export const idRepaymentChoices = (amount: number): number[] => {
   if (!Number.isFinite(amount) || amount <= 0) return [];
   const { min, max } = idRepaymentBounds(amount);
   if (min > max) return [];
   const extras = ID_REPAY_EXTRAS[amount] ?? [1, Math.round(amount * 0.2 * 2) / 2, Math.round(amount * 0.3 * 2) / 2];
   const totals = extras.map((extra) => roundCents(Math.min(Math.max(amount + extra, min), max)));
   return [...new Set(totals)].sort((a, b) => a - b);
};

/** Whole days from `today` (YYYY-MM-DD) to a due date (YYYY-MM-DD or an ISO string). */
export const daysUntil = (today: string, due: string): number | null => {
   const parse = (v: string) => {
      const [y, m, d] = v.slice(0, 10).split('-').map(Number);
      return y && m && d ? Date.UTC(y, m - 1, d) : NaN;
   };
   const a = parse(today);
   const b = parse(due);
   if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
   return Math.round((b - a) / 86_400_000);
};

export type IdLoanTermProblem = 'not_approved' | 'amount' | 'repayment_low' | 'repayment_high' | 'date' | null;

/** The first rule an ID request breaks, or null when the server will take it. */
export const checkIdLoanTerms = (input: {
   amount: number;
   repayment: number;
   /** YYYY-MM-DD or ISO due date. */
   dueDate: string;
   /** Borrower's local today, YYYY-MM-DD. */
   today: string;
   rules: IdLoanRules;
   approved: boolean;
}): IdLoanTermProblem => {
   if (!input.approved) return 'not_approved';
   if (!input.rules.amounts.includes(input.amount)) return 'amount';
   const { min, max } = idRepaymentBounds(input.amount);
   if (!Number.isFinite(input.repayment) || input.repayment < min) return 'repayment_low';
   if (input.repayment > max) return 'repayment_high';
   const days = daysUntil(input.today, input.dueDate);
   if (days === null || days < 1 || days > input.rules.maxTermDays) return 'date';
   return null;
};

/** Bahasa-first messages for checkIdLoanTerms. */
export const idLoanTermMessage = (
   problem: Exclude<IdLoanTermProblem, null>,
   rules: IdLoanRules,
   amount: number,
   lang: 'id' | 'en'
): string => {
   const amounts = rules.amounts.map((a) => `$${a}`).join(lang === 'id' ? ' atau ' : ' or ');
   const { min, max } = idRepaymentBounds(amount);
   const fmt = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);
   const texts: Record<Exclude<IdLoanTermProblem, null>, { id: string; en: string }> = {
      not_approved: {
         id: 'Selesaikan pendaftaran dan panggilan dulu sebelum meminjam.',
         en: 'Finish your sign-up steps and call before you borrow.'
      },
      amount: { id: `Pilih jumlah pinjaman: ${amounts}.`, en: `Choose a loan amount: ${amounts}.` },
      repayment_low: { id: `Pengembalian minimal ${fmt(min)}.`, en: `Repay at least ${fmt(min)}.` },
      repayment_high: { id: `Pengembalian maksimal ${fmt(max)}.`, en: `Repay at most ${fmt(max)}.` },
      date: {
         id: `Pilih kapan kamu bayar (paling lama ${rules.maxTermDays} hari).`,
         en: `Choose when you’ll repay (within ${rules.maxTermDays} days).`
      }
   };
   return texts[problem][lang];
};
