import { describe, expect, it } from 'vitest';

import type { BorrowerContextState } from '@/lib/borrowerContextFit';
import { createLoanSchema } from '@/lib/schemas/loans';
import { mapSupabaseLoanToLoan } from '@/store/slices/loanSlice';

type LoanRow = Parameters<typeof mapSupabaseLoanToLoan>[0];

const loanRow = {
   id: 'loan-1',
   tracking_id: 'LOAN-1',
   borrower_wallet: '0x0000000000000000000000000000000000000001',
   lender_wallet: null,
   borrower_user_id: 'borrower-1',
   lender_user_id: null,
   loan_amount: 15,
   repaid_amount: 0,
   total_repayment_amount: 17,
   reason: 'Emergency groceries',
   loan_status: 'Requested',
   repayment_status: 'Unpaid',
   due_date: '2026-05-16T00:00:00.000Z',
   coin: 'USDC',
   hash: [],
   created_at: '2026-05-08T00:00:00.000Z',
   updated_at: '2026-05-08T00:00:00.000Z',
   funded_at: null,
   referral_code_id: null,
   referral_code: null,
   referral_boost_amount: null
} as Omit<LoanRow, 'borrower_context'>;

const borrowerContext = {
   incomeSetup: 'full_time',
   paydayWindow: '10_15',
   cashGaps: ['family_needs', 'bills_before_payday']
} satisfies BorrowerContextState;

describe('loan borrower context', () => {
   it('accepts borrower context on create payloads', () => {
      const result = createLoanSchema.safeParse({
         borrowerUserId: 'borrower-1',
         loanAmount: 15,
         totalRepaymentAmount: 17,
         reason: 'Emergency groceries',
         days: 8,
         coin: 'USDC',
         borrowerContext
      });

      expect(result.success).toBe(true);
   });

   it('rejects unknown borrower context IDs on create payloads', () => {
      const result = createLoanSchema.safeParse({
         borrowerUserId: 'borrower-1',
         loanAmount: 15,
         totalRepaymentAmount: 17,
         reason: 'Emergency groceries',
         days: 8,
         coin: 'USDC',
         borrowerContext: {
            incomeSetup: 'job-ish',
            paydayWindow: 'middle',
            cashGaps: ['something']
         }
      });

      expect(result.success).toBe(false);
   });

   it('maps Supabase borrower_context into loan borrowerContext', () => {
      const loan = mapSupabaseLoanToLoan({
         ...loanRow,
         borrower_context: borrowerContext
      });

      expect(loan.borrowerContext).toEqual(borrowerContext);
   });

   it('ignores invalid Supabase borrower_context shapes', () => {
      const loan = mapSupabaseLoanToLoan({
         ...loanRow,
         borrower_context: { incomeSetup: 'full_time' }
      });

      expect(loan.borrowerContext).toBeUndefined();
   });

   it('ignores unknown Supabase borrower_context IDs', () => {
      const loan = mapSupabaseLoanToLoan({
         ...loanRow,
         borrower_context: {
            incomeSetup: 'job-ish',
            paydayWindow: '10_15',
            cashGaps: ['family_needs']
         }
      });

      expect(loan.borrowerContext).toBeUndefined();
   });
});
