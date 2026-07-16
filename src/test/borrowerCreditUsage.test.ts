import { describe, expect, it } from 'vitest';

import {
   formatBoardExpiryLabel,
   getBorrowerActiveLoanCount,
   getBorrowerUsedCreditAmount,
   getRequestBoardExpiry,
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

   describe('request board expiry', () => {
      it('counts down whole days left without rounding up a partial day', () => {
         // Posted 3d 22h before `now`, so 3d 2h remain — lenders must not read this as 4 days.
         const expiry = getRequestBoardExpiry({ ...baseLoan, createdAt: '2026-05-16T14:00:00.000Z' }, now);

         expect(expiry?.daysRemaining).toBe(3);
         expect(expiry?.expiresAt.toISOString()).toBe('2026-05-23T14:00:00.000Z');
      });

      it('reports hours on the final day', () => {
         const expiry = getRequestBoardExpiry({ ...baseLoan, createdAt: '2026-05-13T18:00:00.000Z' }, now);

         expect(expiry?.daysRemaining).toBe(0);
         expect(expiry?.hoursRemaining).toBe(6);
      });

      it('returns nothing for expired, funded, or undated loans', () => {
         expect(getRequestBoardExpiry(baseLoan, now)).toBeNull();
         expect(getRequestBoardExpiry({ ...baseLoan, createdAt: '2026-05-18T00:00:00.000Z', loanStatus: LoanStatus.LENT }, now)).toBeNull();
         expect(getRequestBoardExpiry({ ...baseLoan, createdAt: '' }, now)).toBeNull();
      });

      it('leads with the posted date and says "less than a day", never "today"', () => {
         // 22h left can span midnight, so "leaves today" would lie — the label sticks
         // to a duration and lets the posted date anchor the timeline.
         const expiry = getRequestBoardExpiry({ ...baseLoan, createdAt: '2026-05-13T18:00:00.000Z' }, now);
         const label = formatBoardExpiryLabel(expiry!);

         expect(label).toMatch(/^Posted \w{3}, \w{3} \d{1,2} · /);
         expect(label).toContain('Less than a day left on the board');
         expect(label).not.toContain('today');
      });

      it('pluralizes the day count', () => {
         const oneDay = getRequestBoardExpiry({ ...baseLoan, createdAt: '2026-05-14T18:00:00.000Z' }, now);
         const threeDays = getRequestBoardExpiry({ ...baseLoan, createdAt: '2026-05-16T14:00:00.000Z' }, now);

         expect(formatBoardExpiryLabel(oneDay!)).toContain('· 1 day left on the board');
         expect(formatBoardExpiryLabel(threeDays!)).toContain('· 3 days left on the board');
      });
   });
});
