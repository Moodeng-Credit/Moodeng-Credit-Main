import { describe, expect, it } from 'vitest';

import { isRequestBoardLoanVisible } from '@/lib/borrowerCreditUsage';
import { LoanStatus } from '@/types/loanTypes';

const now = new Date('2026-10-01T12:00:00Z');
const request = {
   createdAt: '2026-10-01T08:00:00Z',
   loanStatus: LoanStatus.REQUESTED,
   borrowerUser: 'borrower-1'
};

describe('request board: a request on hold (missed video call)', () => {
   it('is hidden from lenders and signed-out visitors', () => {
      const held = { ...request, onHoldSince: '2026-10-01T11:00:00Z' };
      expect(isRequestBoardLoanVisible(held, now, 'lender-1')).toBe(false);
      expect(isRequestBoardLoanVisible(held, now, null)).toBe(false);
      expect(isRequestBoardLoanVisible(held, now)).toBe(false);
   });

   it('stays visible to its own borrower, who sees it marked on hold', () => {
      expect(isRequestBoardLoanVisible({ ...request, onHoldSince: '2026-10-01T11:00:00Z' }, now, 'borrower-1')).toBe(true);
   });

   it('is visible to everyone once the hold is cleared', () => {
      expect(isRequestBoardLoanVisible(request, now, 'lender-1')).toBe(true);
   });

   it('still expires as before', () => {
      expect(isRequestBoardLoanVisible({ ...request, createdAt: '2026-09-20T08:00:00Z' }, now, 'borrower-1')).toBe(false);
   });
});
