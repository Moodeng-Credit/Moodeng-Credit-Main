// Loan Types for Supabase
// Amounts are stored as numbers in Supabase

export interface Loan {
   id: string;
   trackingId: string;
   borrowerWallet?: string;
   lenderWallet?: string;
   borrowerUser?: string; // Supabase auth user ID (UUID)
   lenderUser?: string; // Supabase auth user ID (UUID)
   loanAmount: number; // Original amount borrowed (principal)
   repaidAmount: number; // Amount already repaid by borrower (cumulative sum of all payments)
   totalRepaymentAmount: number; // Total amount that must be repaid (principal + interest/fees)
   reason: string;
   loanStatus: string;
   repaymentStatus: string;
   dueDate: string; // ISO 8601 datetime string in UTC (midnight UTC+00)
   coin: string;
   hash: string[]; // Array of transaction hashes - includes lending transaction + all repayment transactions
   createdAt: string;
   updatedAt: string;
   fundedAt?: string; // Timestamp when loan was funded (transitioned to 'Lent' status)
   referralCodeId?: string;
   referralCode?: string;
   referralBoostAmount?: number;
   interestReturnedAt?: string;
   interestReturnHash?: string;
   repaidAt?: string;
   // Admin refund: set when the lender was refunded their principal and the loan was cancelled.
   // A refunded loan reads back as repaymentStatus 'Paid', so treat refundedAt as the signal that
   // this was a refund (money returned by the platform), NOT a borrower repayment.
   refundedAt?: string;
   refundReason?: string;
   refundHash?: string;
   // Off-platform settlement (DISPLAY-ONLY). Set by an admin when a refunded loan was ultimately
   // settled by the borrower off-platform. When present, the lender-facing status reads as REPAID,
   // but refundedAt stays set so the loan is STILL excluded from every credit/earnings/trust
   // calculation (all of which key off `!refundedAt`). A refund is never counted as a repayment.
   offplatformSettledAt?: string;
   offplatformSettlementNote?: string;
}

/**
 * A refunded loan that an admin has recorded as settled by the borrower off-platform.
 *
 * DISPLAY-ONLY: callers use this purely to decide the lender-facing status label (REPAID instead of
 * REFUNDED). It must NEVER be used to include the loan in credit / earnings / trust / milestone
 * calculations — those continue to gate on `!refundedAt`, and refundedAt is intentionally left set.
 */
export function isOffPlatformSettledRefund(
   loan: Pick<Loan, 'refundedAt' | 'offplatformSettledAt'>
): boolean {
   return Boolean(loan.refundedAt && loan.offplatformSettledAt);
}

export interface CreateLoanData {
   borrowerUserId: string; // Supabase auth user ID (UUID)
   borrowerWallet?: string; // Borrower's wallet address
   lenderUserId: string; // Supabase auth user ID (UUID)
   loanAmount: number;
   totalRepaymentAmount: number;
   reason: string;
   dueDate: string; // ISO 8601 datetime string in UTC
   referralCodeId?: string;
   referralCode?: string;
   referralBoostAmount?: number;
}

export interface LoanState {
   loans: {
      gloans: Loan[];
      floans: Loan[];
   };
   userLoansFetchedFor: string | null;
   userLoansFetchedAt: number | null;
   isLoading: boolean;
   error: string | null;
}

export const LoanStatus = {
   REQUESTED: 'Requested',
   LENT: 'Lent'
} as const;

export const RepaymentStatus = {
   UNPAID: 'Unpaid',
   PARTIAL: 'Partial',
   PAID: 'Paid'
} as const;

export type LoanStatusType = (typeof LoanStatus)[keyof typeof LoanStatus];
export type RepaymentStatusType = (typeof RepaymentStatus)[keyof typeof RepaymentStatus];

export interface ILoan {
   id: string;
   trackingId: string;
   borrowerWallet?: string;
   lenderWallet?: string;
   borrowerUser?: string; // Supabase auth user ID (UUID)
   lenderUser?: string; // Supabase auth user ID (UUID)
   loanAmount: number;
   repaidAmount: number;
   totalRepaymentAmount: number;
   reason: string;
   loanStatus: LoanStatusType;
   repaymentStatus: RepaymentStatusType;
   dueDate: Date;
   coin: string;
   hash: string[]; // Array of transaction hashes - includes lending transaction + all repayment transactions
   createdAt: Date;
   updatedAt: Date;
   fundedAt?: Date; // Timestamp when loan was funded (transitioned to 'Lent' status)
   interestReturnedAt?: Date;
   interestReturnHash?: string;
   repaidAt?: Date;
}
