import type { Prisma } from '@/generated/prisma/client/client';

export interface Loan {
   id: string;
   trackingId: string;
   borrowerWallet?: string;
   lenderWallet?: string;
   borrowerUser?: string;
   lenderUser?: string;
   loanAmount: Prisma.Decimal; // Original amount borrowed (principal)
   repaidAmount: Prisma.Decimal; // Amount already repaid by borrower (cumulative sum of all payments)
   totalRepaymentAmount: Prisma.Decimal; // Total amount that must be repaid (principal + interest/fees)
   reason: string;
   loanStatus: string;
   repaymentStatus: string;
   days: number;
   block: string;
   coin: string;
   hash: string[]; // Array of transaction hashes - includes lending transaction + all repayment transactions
   createdAt: string;
   updatedAt: string;
}

export interface CreateLoanData {
   borrowerUserId: string;
   lenderUserId: string;
   loanAmount: number;
   totalRepaymentAmount: number;
   reason: string;
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
   loanAmount: Prisma.Decimal;
   repaidAmount: Prisma.Decimal;
   totalRepaymentAmount: Prisma.Decimal;
   reason: string;
   loanStatus: LoanStatusType;
   repaymentStatus: RepaymentStatusType;
   days: number;
   block: string;
   coin: string;
   hash: string[]; // Array of transaction hashes - includes lending transaction + all repayment transactions
   createdAt: Date;
   updatedAt: Date;
}
