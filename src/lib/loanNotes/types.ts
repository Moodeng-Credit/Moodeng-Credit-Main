/** Public + viewer-specific data for the lender Loan Note purchase page. */
export interface LoanNotePageData {
   loanId: string; // loans.id (UUID)
   trackingId: string;
   onchainLoanId: string | null;

   // Borrower presentation
   borrowerDisplayName: string;
   borrowerUsername: string;
   borrowerWalletShort: string | null;
   borrowerAvatarUrl: string | null;
   borrowerCreditLevel: number | null;

   // Loan terms (USDC, major units)
   loanPurpose: string;
   principal: number; // amount originally funded
   totalOwed: number; // amount borrower will repay
   remainingOwed: number;
   dueDate: string; // ISO
   loanStatus: 'Active' | 'Repaid' | 'Defaulted' | 'Lent' | 'Requested' | string;

   // Resale / economics
   listingPrice: number; // what the lender pays Moodeng
   expectedRepayment: number; // what is auto-routed to the lender if repaid (== totalOwed)
   expectedProfit: number; // expectedRepayment - listingPrice
   iouPointsReward: number; // off-chain IOU points (major units)
   isSellable: boolean;

   // Borrower repayment stats
   repaymentStats: {
      loansFunded: number;
      loansRepaid: number;
      repaymentRatePct: number | null;
   };

   // Viewer state
   isLoggedIn: boolean;
   ownsLoanNote: boolean;
}

/** A smart-contract-funded loan in the admin "Liquidity Relay" share panel. */
export interface RelayLoan {
   loanId: string; // loans.id (UUID) — used to build the shareable /lend/loan/:loanId link
   trackingId: string;
   onchainLoanId: string | null;
   borrowerDisplayName: string;
   borrowerUsername: string;
   principal: number;
   totalOwed: number;
   salePrice: number; // what a lender pays Moodeng (defaults to principal)
   lenderUpside: number; // totalOwed - salePrice
   status: 'Listed' | 'Sold' | 'Repaid' | 'Defaulted';
}

/** A Loan Note the lender has funded — repayments auto-route to them, no claim step. */
export interface FundedLoan {
   loanId: string;
   trackingId: string;
   onchainLoanId: string | null;
   borrowerDisplayName: string;
   borrowerUsername: string;
   status: 'Active' | 'Repaid' | 'Defaulted' | string;
   amountPaid: number; // what the lender paid Moodeng for the Note
   borrowerOwes: number; // totalOwed
   amountRepaidToYou: number; // repayments already auto-sent to the lender
   expectedRemaining: number; // remaining owed still to be auto-routed
   iouPointsEarned: number;
   repaymentWallet: string | null; // destination wallet repayments are auto-sent to
}
