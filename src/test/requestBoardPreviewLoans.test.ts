import { describe, expect, it } from 'vitest';

import { shouldShowPreviewRequestBoardLoans } from '@/views/dashboard/RequestBoard';

import { type Loan, LoanStatus, RepaymentStatus } from '@/types/loanTypes';

const requestedLoan: Loan = {
   id: 'loan-1',
   borrowerUser: 'user-1',
   borrowerWallet: '0x0000000000000000000000000000000000000001',
   lenderUser: '',
   loanAmount: 25,
   totalRepaymentAmount: 27,
   repaidAmount: 0,
   dueDate: '2026-06-15T00:00:00.000Z',
   reason: 'Groceries',
   loanStatus: LoanStatus.REQUESTED,
   repaymentStatus: RepaymentStatus.UNPAID,
   coin: 'USDC',
   createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
   updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
};

describe('Request Board preview loans', () => {
   it('does not inject preview requests during normal browsing when live requests are empty', () => {
      expect(shouldShowPreviewRequestBoardLoans('', [])).toBe(false);
   });

   it('allows preview requests only for explicit preview and tour URLs', () => {
      expect(shouldShowPreviewRequestBoardLoans('?previewRequests=1', [])).toBe(true);
      expect(shouldShowPreviewRequestBoardLoans('?tour=1', [])).toBe(true);
   });

   it('does not inject preview requests over live visible requests', () => {
      expect(shouldShowPreviewRequestBoardLoans('?previewRequests=1', [requestedLoan])).toBe(false);
   });
});
