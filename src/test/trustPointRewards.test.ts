import { describe, expect, it } from 'vitest';

import {
   calculateTrustPointRewardDelta,
   markLoansRepaid,
   markLoansUnpaid,
   type TrustPointMilestoneDefinition,
   type TrustPointRewardLoan
} from '../../supabase/functions/_shared/trustPointRewards';

const milestoneDefinitions: TrustPointMilestoneDefinition[] = [
   { id: 'first-on-time-repayment', points_awarded: 20000000, is_active: true },
   { id: 'two-on-time-streak', points_awarded: 25000000, is_active: true },
   { id: 'full-limit-credit-builder', points_awarded: 30000000, is_active: true },
   { id: 'repay-100-total', points_awarded: 40000000, is_active: true }
];

const activeLoan: TrustPointRewardLoan = {
   id: 'loan-1',
   borrower_user_id: 'borrower-1',
   lender_user_id: 'lender-1',
   loan_amount: 40,
   total_repayment_amount: 44,
   repaid_amount: 0,
   due_date: '2026-06-24T00:00:00.000Z',
   funded_at: '2026-06-20T00:00:00.000Z',
   loan_status: 'Lent',
   repayment_status: 'Unpaid',
   updated_at: '2026-06-20T00:00:00.000Z'
};

describe('trust point reward calculation', () => {
   it('calculates milestone points unlocked by paying an active loan on time', () => {
      const referenceDate = new Date('2026-06-23T00:00:00.000Z');

      const reward = calculateTrustPointRewardDelta({
         beforeLoans: [activeLoan],
         afterLoans: markLoansRepaid([activeLoan], ['loan-1'], referenceDate),
         user: { is_world_id: 'ACTIVE', cs: 20 },
         milestoneDefinitions,
         completedMilestoneIds: new Set(),
         referenceDate
      });

      expect(reward).toBe('50000000');
   });

   it('does not count milestones that were already completed', () => {
      const referenceDate = new Date('2026-06-23T00:00:00.000Z');

      const reward = calculateTrustPointRewardDelta({
         beforeLoans: [activeLoan],
         afterLoans: markLoansRepaid([activeLoan], ['loan-1'], referenceDate),
         user: { is_world_id: 'ACTIVE', cs: 20 },
         milestoneDefinitions,
         completedMilestoneIds: new Set(['first-on-time-repayment', 'full-limit-credit-builder']),
         referenceDate
      });

      expect(reward).toBe('0');
   });

   it('calculates points earned by a completed repayment against the pre-payment state', () => {
      const paidLoan = {
         ...activeLoan,
         repayment_status: 'Paid',
         repaid_amount: 44,
         updated_at: '2026-06-23T00:00:00.000Z'
      };
      const referenceDate = new Date('2026-06-23T00:00:00.000Z');

      const reward = calculateTrustPointRewardDelta({
         beforeLoans: markLoansUnpaid([paidLoan], ['loan-1']),
         afterLoans: [paidLoan],
         user: { is_world_id: 'ACTIVE', cs: 20 },
         milestoneDefinitions,
         completedMilestoneIds: new Set(),
         referenceDate
      });

      expect(reward).toBe('50000000');
   });
});
