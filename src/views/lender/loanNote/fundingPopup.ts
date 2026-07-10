/**
 * sessionStorage key holding a loanId that should be funded via the post-login popup.
 *
 * Set when a logged-out lender clicks "Support" on a loan link. Its presence also signals
 * "this person arrived to fund a loan" — used to auto-assign the lender role during
 * onboarding and to open the funding popup (<LenderFundingPrompt />) once they're fully
 * onboarded, so they land on a popup for that borrower instead of the request board.
 */
export const PENDING_FUND_LOAN_KEY = 'pendingFundLoanId';

/** The loanId a link-arriving lender intends to fund, if any. */
export function getPendingFundLoanId(): string | null {
   try {
      return window.sessionStorage.getItem(PENDING_FUND_LOAN_KEY);
   } catch {
      return null;
   }
}

/** True when the current visitor arrived via a fund link (intends to be a lender). */
export function hasPendingFundIntent(): boolean {
   return Boolean(getPendingFundLoanId());
}

export function setPendingFundLoanId(loanId: string): void {
   try {
      window.sessionStorage.setItem(PENDING_FUND_LOAN_KEY, loanId);
   } catch {
      /* ignore storage errors */
   }
}

export function clearPendingFundLoanId(): void {
   try {
      window.sessionStorage.removeItem(PENDING_FUND_LOAN_KEY);
   } catch {
      /* ignore */
   }
}
