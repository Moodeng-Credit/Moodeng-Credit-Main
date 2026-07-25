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
