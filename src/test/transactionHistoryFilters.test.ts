import { describe, expect, it } from 'vitest';

import { type Loan, LoanStatus, RepaymentStatus } from '@/types/loanTypes';
import {
   filterTransactionHistoryLoans,
   getTransactionLoanStatus,
   type TransactionHistoryFilterState
} from '@/views/transactions/transactionHistoryFilters';

const baseLoan: Loan = {
   id: 'loan-1',
   trackingId: 'LOAN-1',
   borrowerWallet: '0xborrower',
   lenderWallet: '0xlender',
   borrowerUser: 'borrower-1',
   lenderUser: 'lender-1',
   loanAmount: 10,
   repaidAmount: 0,
   totalRepaymentAmount: 12,
   reason: 'Groceries',
   loanStatus: LoanStatus.LENT,
   repaymentStatus: RepaymentStatus.UNPAID,
   dueDate: '2026-06-30T00:00:00.000Z',
   coin: 'USDC',
   hash: [],
   createdAt: '2026-05-01T00:00:00.000Z',
   updatedAt: '2026-05-01T00:00:00.000Z',
   fundedAt: '2026-05-01T00:00:00.000Z'
};

const makeLoan = (overrides: Partial<Loan> = {}): Loan => ({
   ...baseLoan,
   ...overrides
});

const getFilteredIds = (loans: Loan[], filters: TransactionHistoryFilterState, now = new Date('2026-05-23T00:00:00.000Z')) =>
   filterTransactionHistoryLoans({
      loans,
      activeTab: 'all',
      searchQuery: '',
      filters,
      isBorrower: true,
      userProfiles: {},
      now
   }).map((loan) => loan.id);

describe('transactionHistoryFilters', () => {
   it('filters active status to active and partial loans only', () => {
      const loans = [
         makeLoan({ id: 'pending', loanStatus: LoanStatus.REQUESTED, fundedAt: undefined }),
         makeLoan({ id: 'active', fundedAt: '2026-05-10T00:00:00.000Z' }),
         makeLoan({
            id: 'partial',
            repaymentStatus: RepaymentStatus.PARTIAL,
            fundedAt: '2026-05-15T00:00:00.000Z'
         }),
         makeLoan({ id: 'default', dueDate: '2026-05-01T00:00:00.000Z' }),
         makeLoan({ id: 'repaid', repaymentStatus: RepaymentStatus.PAID })
      ];

      expect(getFilteredIds(loans, { sortBy: '', status: 'active' })).toEqual(['partial', 'active']);
   });

   it('treats past-due partial loans as defaulted for status filtering', () => {
      const pastDuePartial = makeLoan({
         id: 'past-due-partial',
         repaymentStatus: RepaymentStatus.PARTIAL,
         dueDate: '2026-05-01T00:00:00.000Z'
      });

      expect(getTransactionLoanStatus(pastDuePartial, new Date('2026-05-23T00:00:00.000Z'))).toBe('DEFAULT');
      expect(getFilteredIds([pastDuePartial], { sortBy: '', status: 'default' })).toEqual(['past-due-partial']);
   });

   it('keeps status filtering separate from amount sorting', () => {
      const loans = [
         makeLoan({ id: 'active-large', loanAmount: 50, fundedAt: '2026-05-10T00:00:00.000Z' }),
         makeLoan({ id: 'repaid-small', loanAmount: 5, repaymentStatus: RepaymentStatus.PAID }),
         makeLoan({ id: 'active-small', loanAmount: 12, fundedAt: '2026-05-12T00:00:00.000Z' }),
         makeLoan({ id: 'pending-small', loanAmount: 6, loanStatus: LoanStatus.REQUESTED })
      ];

      expect(getFilteredIds(loans, { sortBy: 'low-to-high', status: 'active' })).toEqual(['active-small', 'active-large']);
   });

   it('sorts oldest to newest through the sort field', () => {
      const loans = [
         makeLoan({ id: 'newer', fundedAt: '2026-05-20T00:00:00.000Z' }),
         makeLoan({ id: 'older', fundedAt: '2026-05-01T00:00:00.000Z' })
      ];

      expect(getFilteredIds(loans, { sortBy: 'old-to-new', status: '' })).toEqual(['older', 'newer']);
   });
});
