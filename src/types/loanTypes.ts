import type { Document } from 'mongoose';

export interface Loan {
   _id: string;
   trackingId: string;
   borrowerWallet?: string;
   lenderWallet?: string;
   borrowerUser?: string;
   lenderUser?: string;
   loanAmount: number;
   repayedAmount: number;
   repaymentAmount: number;
   reason: string;
   loanStatus: string;
   repaymentStatus: string;
   days: number;
   block: string;
   coin: string;
   hash: string[];
   createdAt: string;
   updatedAt: string;
}

export interface CreateLoanData {
   borrowerUserId: string;
   lenderUserId: string;
   loanAmount: number;
   repayedAmount: number;
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

export interface ILoan extends Document {
   trackingId: string;
   borrowerWallet?: string;
   lenderWallet?: string;
   borrowerUser?: string;
   lenderUser?: string;
   loanAmount: number;
   repayedAmount: number;
   repaymentAmount: number;
   reason: string;
   loanStatus: LoanStatusType;
   repaymentStatus: RepaymentStatusType;
   days: number;
   block: string;
   coin: string;
   hash: string[];
   createdAt: Date;
   updatedAt: Date;
}
