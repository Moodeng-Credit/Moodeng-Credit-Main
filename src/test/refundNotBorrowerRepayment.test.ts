import { describe, expect, it } from 'vitest';

import { buildReputationMilestones } from '@/views/dashboard/dashboardHelpers';
import type { CreditLevel } from '@/views/profile/components/tabs/types';
import type { Loan } from '@/types/loanTypes';

// A refunded loan reads back as repaymentStatus 'Paid' with repaidAmount stamped to the full total
// (the admin refunded the lender their principal and banned the borrower). It must never count as a
// borrower repayment anywhere in the credit/trust surfaces. These tests lock that invariant in.

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

describe('refunded loans are not counted as borrower repayments', () => {
   it('a fully-repaid on-time loan completes the first-on-time-repayment milestone', () => {
      expect(milestoneStatus([makeLoan()], 'first-on-time-repayment')).toBe('unlocked');
   });

   it('the SAME loan, once refunded, no longer completes it', () => {
      const refunded = makeLoan({ refundedAt: '2026-06-21T00:00:00.000Z', refundReason: 'default' });
      expect(milestoneStatus([refunded], 'first-on-time-repayment')).not.toBe('unlocked');
   });

   it('a refunded loan does not contribute to the two-on-time-streak count', () => {
      const genuine = makeLoan({ id: 'loan-genuine' });
      const refunded = makeLoan({ id: 'loan-refunded', refundedAt: '2026-06-21T00:00:00.000Z' });
      // Two "Paid" loans, but one is a refund -> only one genuine on-time repayment -> streak not met.
      expect(milestoneStatus([genuine, refunded], 'two-on-time-streak')).not.toBe('unlocked');
      // Both genuine -> streak met.
      expect(milestoneStatus([genuine, makeLoan({ id: 'loan-genuine-2' })], 'two-on-time-streak')).toBe('unlocked');
   });
});
