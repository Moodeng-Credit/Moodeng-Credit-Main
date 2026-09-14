import { describe, expect, it } from 'vitest';

import { buildReputationMilestones } from '@/views/dashboard/dashboardHelpers';
import type { CreditLevel } from '@/views/profile/components/tabs/types';
import { isOffPlatformSettledRefund, type Loan } from '@/types/loanTypes';
import { getTransactionLoanStatus } from '@/views/transactions/transactionHistoryFilters';

// Off-platform settlement is DISPLAY-ONLY. When an admin records that the borrower settled a refunded
// loan off-platform, the lender-facing status reads REPAID (they were made whole and the debt came
// good) — but refundedAt stays set, so the loan is STILL a refund for every credit/earnings/trust
// calculation. These tests lock both halves of that contract.

const makeLoan = (overrides: Partial<Loan> = {}): Loan => ({
   id: 'loan-1',
   trackingId: 'track-1',
   borrowerUser: 'borrower-1',
   lenderUser: 'lender-1',
   loanAmount: 20,
   repaidAmount: 22,
   totalRepaymentAmount: 22,
   reason: 'test',
   loanStatus: 'Lent',
   repaymentStatus: 'Paid',
   dueDate: '2026-06-30T00:00:00.000Z',
   coin: 'USDC',
   hash: [],
   createdAt: '2026-06-01T00:00:00.000Z',
   updatedAt: '2026-06-20T00:00:00.000Z', // before dueDate -> on-time
   fundedAt: '2026-06-02T00:00:00.000Z',
   ...overrides
});

const creditLevels: CreditLevel[] = [
   { id: 'tier-20', amount: 20, unlocked: true },
   { id: 'tier-50', amount: 50, unlocked: false }
];

const milestoneStatus = (loans: Loan[], id: string) => {
   const milestones = buildReputationMilestones({ creditLevels, borrowerLoans: loans, isVerified: true });
   return milestones.find((m) => m.id === id)?.status;
};

describe('off-platform settlement (display-only)', () => {
   it('isOffPlatformSettledRefund requires BOTH a refund and a recorded off-platform settlement', () => {
      expect(isOffPlatformSettledRefund(makeLoan())).toBe(false); // neither
      expect(isOffPlatformSettledRefund(makeLoan({ refundedAt: '2026-06-21T00:00:00.000Z' }))).toBe(false); // refund only
      expect(isOffPlatformSettledRefund(makeLoan({ offplatformSettledAt: '2026-07-01T00:00:00.000Z' }))).toBe(false); // marker only
      expect(
         isOffPlatformSettledRefund(
            makeLoan({ refundedAt: '2026-06-21T00:00:00.000Z', offplatformSettledAt: '2026-07-01T00:00:00.000Z' })
         )
      ).toBe(true);
   });

   it('a plain refund still shows REFUNDED to the lender', () => {
      expect(getTransactionLoanStatus(makeLoan({ refundedAt: '2026-06-21T00:00:00.000Z' }))).toBe('REFUNDED');
   });

   it('a refund settled off-platform shows REPAID to the lender', () => {
      const settled = makeLoan({
         refundedAt: '2026-06-21T00:00:00.000Z',
         offplatformSettledAt: '2026-07-01T00:00:00.000Z',
         offplatformSettlementNote: 'Borrower settled off-platform after deadline extension.'
      });
      expect(getTransactionLoanStatus(settled)).toBe('REPAID');
   });

   it('a refund settled off-platform is STILL not counted as a borrower repayment in credit', () => {
      const settled = makeLoan({
         refundedAt: '2026-06-21T00:00:00.000Z',
         offplatformSettledAt: '2026-07-01T00:00:00.000Z'
      });
      // Display flips to REPAID, but the credit surface must behave exactly like a refund.
      expect(milestoneStatus([settled], 'first-on-time-repayment')).not.toBe('unlocked');
   });
});
