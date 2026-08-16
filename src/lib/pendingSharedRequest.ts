/**
 * sessionStorage key holding a loanId from a shared request link
 * (/request-board?highlight=<loanId>) that a logged-out visitor opened.
 *
 * When such a visitor signs in, the request board is not where they land by default
 * (getPostSignInPath sends them to /dashboard), so the highlighted request would be lost.
 * We stash the loanId on the public board and, right after sign-in, send them back to
 * /request-board?highlight=<loanId> so the shared request opens as intended.
 *
 * Deliberately separate from pendingFundLoanId (fundingPopup.ts): that one drives the Loan
 * Note funding popup + lender-role auto-assign, which must NOT fire for a normal request.
 */
export const PENDING_SHARED_REQUEST_KEY = 'pendingSharedRequestId';

/** The loanId from a shared request link the visitor opened before signing in, if any. */
export function getPendingSharedRequestId(): string | null {
   try {
      return window.sessionStorage.getItem(PENDING_SHARED_REQUEST_KEY);
   } catch {
      return null;
   }
}

export function setPendingSharedRequestId(loanId: string): void {
   try {
      window.sessionStorage.setItem(PENDING_SHARED_REQUEST_KEY, loanId);
   } catch {
      /* ignore storage errors (private mode, etc.) */
   }
}

export function clearPendingSharedRequestId(): void {
   try {
      window.sessionStorage.removeItem(PENDING_SHARED_REQUEST_KEY);
   } catch {
      /* ignore */
   }
}
