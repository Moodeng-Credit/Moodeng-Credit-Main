// Loan Types for Supabase
// Amounts are stored as numbers in Supabase

export interface Loan {
   id: string;
   trackingId: string;
   borrowerWallet?: string;
   lenderWallet?: string;
   borrowerUser?: string;
   lenderUser?: string;
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
}

export interface CreateLoanData {
   borrowerUserId: string;
   borrowerWallet?: string; // Borrower's wallet address
   lenderUserId: string;
   loanAmount: number;
   totalRepaymentAmount: number;
   reason: string;
   dueDate: string; // ISO 8601 datetime string in UTC
}

export interface LoanState {
   loans: {
      gloans: Loan[];
      floans: Loan[];
   };
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
   borrowerUser?: string;
   lenderUser?: string;
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
}
