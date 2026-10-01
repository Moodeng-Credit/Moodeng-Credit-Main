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

   describe('full-limit credit-builder milestone', () => {
      const fullLimitOnly: TrustPointMilestoneDefinition[] = [
         { id: 'full-limit-credit-builder', points_awarded: 30000000, is_active: true }
      ];
      const referenceDate = new Date('2026-06-23T00:00:00.000Z');
      // A $15 full-limit loan repaid late: it levels the borrower up to $20 but is not on time.
      const lateFirstLoan: TrustPointRewardLoan = {
         ...activeLoan,
         id: 'loan-0',
         loan_amount: 15,
         total_repayment_amount: 16,
         repaid_amount: 16,
         due_date: '2026-05-10T00:00:00.000Z',
         repayment_status: 'Paid',
         updated_at: '2026-05-15T00:00:00.000Z'
      };

      const rewardFor = (amount: number) => {
         const nextLoan = { ...activeLoan, loan_amount: amount, total_repayment_amount: amount + 1, due_date: '2026-06-24T00:00:00.000Z' };
         return calculateTrustPointRewardDelta({
            beforeLoans: [lateFirstLoan, nextLoan],
            afterLoans: markLoansRepaid([lateFirstLoan, nextLoan], ['loan-1'], referenceDate),
            user: { is_world_id: 'ACTIVE', cs: 20 },
            milestoneDefinitions: fullLimitOnly,
            completedMilestoneIds: new Set(),
            referenceDate
         });
      };

      it('is not earned by an on-time loan below the current limit, even at a tier amount', () => {
         expect(rewardFor(15)).toBe('0');
      });

      it('is earned by an on-time loan at the current limit', () => {
         expect(rewardFor(20)).toBe('30000000');
      });
   });

   describe('on-time rule matches the database (repaid_at, 24h grace, refunds excluded)', () => {
      const onTimeOnly: TrustPointMilestoneDefinition[] = [{ id: 'first-on-time-repayment', points_awarded: 20000000, is_active: true }];
      const rewardFor = (loan: TrustPointRewardLoan, unpaid: TrustPointRewardLoan) =>
         calculateTrustPointRewardDelta({
            beforeLoans: [unpaid],
            afterLoans: [loan],
            user: { is_world_id: 'ACTIVE', cs: 15 },
            milestoneDefinitions: onTimeOnly,
            completedMilestoneIds: new Set(),
            referenceDate: new Date('2026-06-30T00:00:00.000Z')
         });
      const paid = { ...activeLoan, repayment_status: 'Paid', repaid_amount: 44 };

      it('counts a repayment made on the due date itself', () => {
         expect(rewardFor({ ...paid, repaid_at: '2026-06-24T15:30:00.000Z', updated_at: '2026-06-24T15:30:00.000Z' }, activeLoan)).toBe(
            '20000000'
         );
      });

      it('does not count a repayment the day after the due date', () => {
         expect(rewardFor({ ...paid, repaid_at: '2026-06-25T00:00:00.000Z', updated_at: '2026-06-25T00:00:00.000Z' }, activeLoan)).toBe(
            '0'
         );
      });

      it('judges by repaid_at even when a later edit bumped updated_at', () => {
         expect(rewardFor({ ...paid, repaid_at: '2026-06-22T10:00:00.000Z', updated_at: '2026-07-18T16:11:32.000Z' }, activeLoan)).toBe(
            '20000000'
         );
      });

      it('never counts a refunded loan, even when settlement stamped repaid_amount to the total', () => {
         expect(rewardFor({ ...paid, refunded_at: '2026-06-20T00:00:00.000Z', updated_at: '2026-06-20T00:00:00.000Z' }, activeLoan)).toBe(
            '0'
         );
      });

      it('never counts a test loan', () => {
         expect(rewardFor({ ...paid, is_test: true, repaid_at: '2026-06-22T10:00:00.000Z' }, activeLoan)).toBe('0');
      });

      it('markLoansRepaid stamps repaid_at so projected rewards use the payment time', () => {
         const [projected] = markLoansRepaid([activeLoan], ['loan-1'], new Date('2026-06-24T12:00:00.000Z'));
         expect(projected.repaid_at).toBe('2026-06-24T12:00:00.000Z');
      });
   });
});
