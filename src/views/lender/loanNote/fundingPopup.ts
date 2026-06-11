/**
 * sessionStorage key holding a loanId that should be funded via the post-login popup.
 *
 * Set when a logged-out lender clicks "Support" on a loan link; consumed by
 * <LenderFundingPrompt /> after authentication to open the funding modal — so the lender
 * lands on a popup for that specific borrower instead of the request board.
 */
export const PENDING_FUND_LOAN_KEY = 'pendingFundLoanId';
