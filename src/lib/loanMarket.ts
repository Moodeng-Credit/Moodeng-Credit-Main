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

// ── Rupiah peg (supabase/migrations/20261107160000_indonesia_idr_peg.sql) ─────────────────────
// ID borrowers promise a FIXED rupiah total (loans.repay_idr). The server prices it at today's
// USD/IDR (public.current_usd_idr): total_repayment_amount = round(repay_idr / rate, 2), which must
// still be ≥ amount + $1 and ≤ 1.5× the amount. repay_idr is whole rupiah in steps of Rp 500.

/** Smallest step for a typed rupiah total (server: repay_idr % 500 = 0). */
export const ID_REPAY_IDR_STEP = 500;
/** One-tap rupiah chips are rounded to this. */
export const ID_REPAY_IDR_CHIP_STEP = 5000;

/** "Rp 110.000" — whole rupiah with Indonesian grouping. */
export const formatIdr = (idr: number): string =>
   `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(Number.isFinite(idr) ? idr : 0))}`;

/** "≈ Rp 90.000" for a USD amount at `rate` (rounded to Rp 1.000), or null without a rate. */
export const approxIdr = (usd: number, rate: number | null | undefined): string | null =>
   rate && Number.isFinite(rate) && rate > 0 && Number.isFinite(usd) ? `≈ ${formatIdr(Math.round((usd * rate) / 1000) * 1000)}` : null;

/** USD the server will charge for `idr` rupiah at `rate` (rounded to cents, like the server). */
export const idUsdForIdr = (idr: number, rate: number): number => roundCents(idr / rate);

/**
 * Lowest and highest rupiah total (multiples of Rp 500) whose USD at `rate` the server accepts for
 * an ID loan of `amount`: round(idr / rate, 2) within idRepaymentBounds. Null without a usable rate.
 */
export const idRepayIdrBounds = (amount: number, rate: number | null | undefined): { min: number; max: number } | null => {
   if (!rate || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(amount) || amount <= 0) return null;
   const { min, max } = idRepaymentBounds(amount);
   const step = ID_REPAY_IDR_STEP;
   // Exactly the server's test: it rounds the USD to cents first, so e.g. $5.996 counts as $6.
   const accepts = (idr: number) => {
      const usd = idUsdForIdr(idr, rate);
      return usd >= min && usd <= max;
   };
   // Start near the edges, then step until the edge is the last rupiah total the server takes.
   let lo = Math.ceil(((min - 0.005) * rate) / step) * step;
   let hi = Math.floor(((max + 0.005) * rate) / step) * step;
   for (let i = 0; i < 4 && !accepts(lo); i += 1) lo += step;
   for (let i = 0; i < 4 && lo - step > 0 && accepts(lo - step); i += 1) lo -= step;
   for (let i = 0; i < 4 && !accepts(hi); i += 1) hi -= step;
   for (let i = 0; i < 4 && accepts(hi + step); i += 1) hi += step;
   return lo <= hi && accepts(lo) && accepts(hi) ? { min: lo, max: hi } : null;
};

/**
 * Up to three rupiah totals to offer as chips for an ID loan: multiples of Rp 5.000 inside
 * idRepayIdrBounds, nearest to the usual USD totals ($5 → $6 / $6.50 / $7, $10 → $11 / $12 / $13)
 * at today's rate. Fewer when the range holds fewer round numbers.
 */
export const idRepayIdrChoices = (amount: number, rate: number | null | undefined): number[] => {
   const bounds = idRepayIdrBounds(amount, rate);
   if (!bounds || !rate) return [];
   const chip = ID_REPAY_IDR_CHIP_STEP;
   const candidates: number[] = [];
   for (let v = Math.ceil(bounds.min / chip) * chip; v <= bounds.max; v += chip) candidates.push(v);
   if (candidates.length <= 3) return candidates;
   const picked = new Set<number>();
   for (const usd of idRepaymentChoices(amount)) {
      const target = usd * rate;
      let nearest: number | null = null;
      for (const c of candidates) {
         if (picked.has(c)) continue;
         if (nearest === null || Math.abs(c - target) < Math.abs(nearest - target)) nearest = c;
      }
      if (nearest !== null) picked.add(nearest);
   }
   // Targets that landed on the same chip: fill from the middle of what's left.
   const rest = candidates.filter((c) => !picked.has(c));
   while (picked.size < 3 && rest.length) picked.add(rest.splice(Math.floor(rest.length / 2), 1)[0]);
   return [...picked].sort((a, b) => a - b);
};

/** A typed rupiah total snapped to Rp 500 and clipped into idRepayIdrBounds; null when it can't be. */
export const clipRepayIdr = (typed: number, amount: number, rate: number | null | undefined): number | null => {
   const bounds = idRepayIdrBounds(amount, rate);
   if (!bounds || !Number.isFinite(typed)) return null;
   const snapped = Math.round(typed / ID_REPAY_IDR_STEP) * ID_REPAY_IDR_STEP;
   return Math.min(Math.max(snapped, bounds.min), bounds.max);
};

/** Rupiah still owed on a pegged loan (repayIdr − repaidIdr, never below 0); null when not pegged. */
export const remainingIdr = (loan: { repayIdr?: number | null; repaidIdr?: number | null } | null | undefined): number | null => {
   if (!loan || loan.repayIdr == null || !Number.isFinite(loan.repayIdr) || loan.repayIdr <= 0) return null;
   const paid = Number(loan.repaidIdr ?? 0);
   return Math.max(0, Math.round(loan.repayIdr - (Number.isFinite(paid) ? paid : 0)));
};

/** Shown (and submit disabled) when the server has no fresh USD/IDR rate. */
export const ID_NO_RATE_TEXT = {
   id: 'Kurs Rupiah belum tersedia. Coba lagi sebentar lagi.',
   en: 'The rupiah exchange rate isn’t available right now. Try again soon.'
} as const;

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
   lang: 'id' | 'en',
   /** Today's USD/IDR: when set, the repayment limits are said in rupiah (the peg). */
   rate?: number | null
): string => {
   const amounts = rules.amounts.map((a) => `$${a}`).join(lang === 'id' ? ' atau ' : ' or ');
   const idrBounds = idRepayIdrBounds(amount, rate);
   const { min, max } = idrBounds ?? idRepaymentBounds(amount);
   const fmt = (n: number) => (idrBounds ? formatIdr(n) : Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);
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
