import { describe, expect, it } from 'vitest';

import {
   getBorrowerActiveLoanCount,
   getBorrowerUsedCreditAmount,
   isExpiredUnfundedRequest,
   isRequestBoardLoanVisible
} from '@/lib/borrowerCreditUsage';
import { type Loan, LoanStatus, RepaymentStatus } from '@/types/loanTypes';

const baseLoan: Loan = {
   id: 'loan',
   borrowerWallet: '0xborrower',
   lenderWallet: '',
   loanAmount: 15,
   repaidAmount: 0,
   totalRepaymentAmount: 16,
   reason: 'Test',
   loanStatus: LoanStatus.REQUESTED,
   repaymentStatus: RepaymentStatus.UNPAID,
   dueDate: '2026-01-27T00:00:00.000Z',
   coin: 'USDC',
   hash: [],
   createdAt: '2026-01-20T00:00:00.000Z',
   updatedAt: '2026-01-20T00:00:00.000Z'
};

describe('borrower credit usage', () => {
   const now = new Date('2026-05-20T12:00:00.000Z');

   it('does not count expired unfunded requests against borrower credit', () => {
      expect(isExpiredUnfundedRequest(baseLoan, now)).toBe(true);
      expect(isRequestBoardLoanVisible(baseLoan, now)).toBe(false);
      expect(getBorrowerUsedCreditAmount([baseLoan], now)).toBe(0);
   });

   it('counts active requested loans and unpaid funded loans', () => {
      const activeRequest = { ...baseLoan, id: 'active', createdAt: '2026-05-18T00:00:00.000Z', loanAmount: 15 };
      const unpaidFunded = {
         ...baseLoan,
         id: 'funded',
         loanStatus: LoanStatus.LENT,
         repaymentStatus: RepaymentStatus.PARTIAL,
         loanAmount: 20
      };
      const paidFunded = {
         ...baseLoan,
         id: 'paid',
         loanStatus: LoanStatus.LENT,
         repaymentStatus: RepaymentStatus.PAID,
         loanAmount: 40
      };

      expect(getBorrowerUsedCreditAmount([activeRequest, unpaidFunded, paidFunded], now)).toBe(35);
      expect(getBorrowerActiveLoanCount([activeRequest, unpaidFunded, paidFunded], now)).toBe(2);
   });

   it('keeps requested loans active until they are 7 days old', () => {
      const notQuiteExpired = { ...baseLoan, createdAt: '2026-05-13T12:01:00.000Z' };

      expect(isExpiredUnfundedRequest(notQuiteExpired, now)).toBe(false);
      expect(isRequestBoardLoanVisible(notQuiteExpired, now)).toBe(true);
   });
});
