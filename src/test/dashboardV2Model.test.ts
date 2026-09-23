import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { describe, expect, it } from 'vitest';

import { LoanStatus, RepaymentStatus, type Loan } from '@/types/loanTypes';
import type { DashboardMilestone } from '@/views/dashboard/dashboardHelpers';
import DashboardV2Hero from '@/views/dashboard-v2/components/DashboardV2Hero';
import { LoanSummarySection, MilestonesSection, UpcomingDuesSection } from '@/views/dashboard-v2/components/DashboardV2Sections';
import {
   getCreditLevelProgress,
   getMoodengMood,
   getMoodengTier,
   getOnTimeRepaidTotal,
   toDashboardV2Milestones
} from '@/views/dashboard-v2/dashboardV2Model';
import { SAMPLE_STATES } from '@/views/dashboard-v2/sampleStates';

const buildPaidLoan = (overrides: Partial<Loan>): Loan => ({
   id: 'loan',
   trackingId: 'loan',
   borrowerUser: 'borrower',
   lenderUser: 'lender',
   borrowerWallet: '0x1',
   lenderWallet: '0x2',
   loanAmount: 15,
   repaidAmount: 18,
   totalRepaymentAmount: 18,
   reason: 'test',
   loanStatus: LoanStatus.LENT,
   repaymentStatus: RepaymentStatus.PAID,
   dueDate: '2026-05-20T00:00:00.000Z',
   coin: 'USDC',
   hash: [],
   createdAt: '2026-05-10T00:00:00.000Z',
   updatedAt: '2026-05-18T00:00:00.000Z',
   ...overrides
});

const buildMilestone = (id: string, status: DashboardMilestone['status'], points: number): DashboardMilestone => ({
   id,
   pointSourceId: id,
   title: id,
   description: '',
   status,
   eyebrow: '',
   outcome: '',
   benefit: '',
   points,
   actionTo: '/request-board'
});

describe('dashboard v2 Moodeng tiers', () => {
   it('maps pandesal (trust points) to the design tiers', () => {
      expect(getMoodengTier(0)).toBe('rookie');
      expect(getMoodengTier(49)).toBe('rookie');
      expect(getMoodengTier(50)).toBe('rising');
      expect(getMoodengTier(300)).toBe('prime');
      expect(getMoodengTier(1200)).toBe('apex');
   });

   it('picks the Moodeng mood from verification and loan state', () => {
      expect(getMoodengMood({ isVerified: false, hasUnpaidFundedLoan: true, hasRepaidLoan: true })).toBe('waiting');
      expect(getMoodengMood({ isVerified: true, hasUnpaidFundedLoan: true, hasRepaidLoan: true })).toBe('loan');
      expect(getMoodengMood({ isVerified: true, hasUnpaidFundedLoan: false, hasRepaidLoan: true })).toBe('repaid');
      expect(getMoodengMood({ isVerified: true, hasUnpaidFundedLoan: false, hasRepaidLoan: false })).toBe('waiting');
   });
});

describe('dashboard v2 credit level progress', () => {
   it('asks unverified borrowers to verify', () => {
      expect(getCreditLevelProgress({ creditLimit: 15, isVerified: false, onTimeRepaidTotal: 0, isPaused: false })).toEqual({
         level: 0,
         progress: 0,
         hint: { highlight: 'Verify', rest: ' to unlock LV.1' }
      });
   });

   it('shows the amount left to repay on time for the next level', () => {
      const result = getCreditLevelProgress({ creditLimit: 15, isVerified: true, onTimeRepaidTotal: 6, isPaused: false });
      expect(result.level).toBe(1);
      expect(result.progress).toBeCloseTo(0.4);
      expect(result.hint).toEqual({ highlight: '$9.00', rest: ' left to LV.2' });
   });

   it('measures progress within the current level', () => {
      const result = getCreditLevelProgress({ creditLimit: 20, isVerified: true, onTimeRepaidTotal: 17.5, isPaused: false });
      expect(result.level).toBe(2);
      expect(result.progress).toBeCloseTo(0.5);
      expect(result.hint.highlight).toBe('$2.50');
   });

   it('handles the top level and paused progression', () => {
      expect(getCreditLevelProgress({ creditLimit: 140, isVerified: true, onTimeRepaidTotal: 0, isPaused: false }).hint.highlight).toBe('Top');
      expect(getCreditLevelProgress({ creditLimit: 15, isVerified: true, onTimeRepaidTotal: 0, isPaused: true }).hint.highlight).toBe('Paused');
   });

   it('only counts fully repaid, on-time, non-refunded loans', () => {
      const loans = [
         buildPaidLoan({ id: 'on-time', loanAmount: 15 }),
         buildPaidLoan({ id: 'late', loanAmount: 20, updatedAt: '2026-06-30T00:00:00.000Z' }),
         buildPaidLoan({ id: 'refunded', loanAmount: 40, refundedAt: '2026-05-19T00:00:00.000Z' }),
         buildPaidLoan({ id: 'partial', loanAmount: 60, repaidAmount: 10 })
      ];
      expect(getOnTimeRepaidTotal(loans)).toBe(15);
   });
});

describe('dashboard v2 milestones', () => {
   it('shows the three design milestones and skips verification', () => {
      const milestones = toDashboardV2Milestones([
         buildMilestone('verify-identity', 'next', 30),
         buildMilestone('first-loan-request', 'locked', 10),
         buildMilestone('first-funded-loan', 'locked', 15),
         buildMilestone('first-on-time-repayment', 'locked', 20),
         buildMilestone('two-on-time-streak', 'locked', 25)
      ]);

      expect(milestones.map((milestone) => [milestone.id, milestone.status, milestone.reward])).toEqual([
         ['first-loan-request', 'next', '+10 Pandesal'],
         ['first-funded-loan', 'locked', '+15 Pandesal'],
         ['first-on-time-repayment', 'locked', '₱50 GrabFood voucher']
      ]);
   });

   it('keeps completed milestones and moves "next" to the first open one', () => {
      const milestones = toDashboardV2Milestones([
         buildMilestone('first-loan-request', 'unlocked', 10),
         buildMilestone('first-funded-loan', 'unlocked', 15),
         buildMilestone('first-on-time-repayment', 'locked', 20)
      ]);

      expect(milestones.map((milestone) => milestone.status)).toEqual(['unlocked', 'unlocked', 'next']);
   });
});

describe('dashboard v2 sample states render', () => {
   const render = (element: ReturnType<typeof createElement>) =>
      renderToStaticMarkup(createElement(MemoryRouter, null, element));

   it('renders the hero for each design state', () => {
      expect(render(createElement(DashboardV2Hero, { model: SAMPLE_STATES.unverified, showRealAvatar: false }))).toContain('LV0');
      expect(render(createElement(DashboardV2Hero, { model: SAMPLE_STATES.verified, showRealAvatar: false }))).toContain(
         'left to LV.2'
      );
   });

   it('renders the overdue row with Pay Now and empty dues copy', () => {
      expect(render(createElement(UpcomingDuesSection, { model: SAMPLE_STATES.defaulted }))).toContain('Pay Now');
      expect(render(createElement(UpcomingDuesSection, { model: SAMPLE_STATES.unverified }))).toContain('No Active Loans');
   });

   it('renders milestones and loan summary values', () => {
      expect(render(createElement(MilestonesSection, { model: SAMPLE_STATES.verified, onVerify: () => undefined }))).toContain(
         'Post your first loan request'
      );
      expect(render(createElement(LoanSummarySection, { model: SAMPLE_STATES.defaulted }))).toContain('3.00');
   });
});
