import { createElement } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { EMPTY_REWARDS, isValidInviteCode, normalizeInviteCode, parseMyRewards } from '@/lib/friendReferrals';
import { type Loan, LoanStatus, RepaymentStatus } from '@/types/loanTypes';
import DashboardV2Hero from '@/views/dashboard-v2/components/DashboardV2Hero';
import { MilestonePopup } from '@/views/dashboard-v2/components/DashboardV2Popups';
import { LoanSummarySection, MilestonesSection, UpcomingDuesSection } from '@/views/dashboard-v2/components/DashboardV2Sections';
import {
   buildInviteLink,
   getCreditLevelProgress,
   getMoodengMood,
   getMoodengTier,
   getNextTierGoal,
   getOnTimeRepaidTotal,
   getVoucherState,
   OWN_VOUCHER,
   REFERRAL_VOUCHERS,
   toDashboardV2MilestoneList,
   toDashboardV2Milestones
} from '@/views/dashboard-v2/dashboardV2Model';
import { SAMPLE_STATES } from '@/views/dashboard-v2/sampleStates';
import type { DashboardMilestone } from '@/views/dashboard/dashboardHelpers';

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
      expect(getMoodengTier(59)).toBe('rookie');
      expect(getMoodengTier(60)).toBe('rising');
      expect(getMoodengTier(200)).toBe('prime');
      expect(getMoodengTier(399)).toBe('prime');
      expect(getMoodengTier(400)).toBe('apex');
      expect(getMoodengTier(1200)).toBe('apex');
   });

   it('picks the Moodeng mood from verification and loan state', () => {
      expect(getMoodengMood({ isVerified: true, hasUnpaidFundedLoan: true, hasRepaidLoan: false, hasOverdueLoan: true })).toBe('waiting');
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
      expect(getCreditLevelProgress({ creditLimit: 140, isVerified: true, onTimeRepaidTotal: 0, isPaused: false }).hint.highlight).toBe(
         'Top'
      );
      expect(getCreditLevelProgress({ creditLimit: 15, isVerified: true, onTimeRepaidTotal: 0, isPaused: true }).hint.highlight).toBe(
         'Paused'
      );
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
   const render = (element: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement(MemoryRouter, null, element));

   it('renders the hero for each design state', () => {
      const unverifiedHero = render(createElement(DashboardV2Hero, { model: SAMPLE_STATES.unverified, showRealAvatar: false }));
      expect(unverifiedHero).toContain('LV0');
      expect(unverifiedHero).toContain('left to LV.1');
      // Verified: the top-right shows borrowing room ($15 limit − $6.68 in use).
      const verifiedHero = render(createElement(DashboardV2Hero, { model: SAMPLE_STATES.verified, showRealAvatar: false }));
      expect(verifiedHero).toContain('$8.32');
      expect(verifiedHero).toContain(' of $15 left');
   });

   it('renders the overdue row with Pay Now and empty dues copy', () => {
      expect(render(createElement(UpcomingDuesSection, { model: SAMPLE_STATES.defaulted }))).toContain('Pay Now');
      expect(render(createElement(UpcomingDuesSection, { model: SAMPLE_STATES.unverified }))).toContain('No Active Loans');
   });

   it('renders milestones and loan summary values', () => {
      expect(
         render(
            createElement(MilestonesSection, {
               model: SAMPLE_STATES.verified,
               allMilestonesHref: '/x',
               onGet: () => undefined,
               onClaim: () => undefined
            })
         )
      ).toContain('Post your first loan request');
      expect(render(createElement(LoanSummarySection, { model: SAMPLE_STATES.defaulted }))).toContain('3.00');
   });
});

describe('dashboard v2 all milestones', () => {
   it('lists every borrower milestone except verification, with the top reward flagged', () => {
      const list = toDashboardV2MilestoneList([
         buildMilestone('verify-identity', 'unlocked', 10),
         buildMilestone('first-loan-request', 'unlocked', 10),
         buildMilestone('first-funded-loan', 'locked', 15),
         buildMilestone('trusted-borrower-candidate', 'locked', 75)
      ]);

      expect(list.map((milestone) => [milestone.id, milestone.status, milestone.points, milestone.isTopReward])).toEqual([
         ['first-loan-request', 'unlocked', 10, false],
         ['first-funded-loan', 'next', 15, false],
         ['trusted-borrower-candidate', 'locked', 75, true]
      ]);
      expect(list[2].title).toBe('Become a trusted borrower');
   });

   it('sets the feeding goal to the next Moodeng tier', () => {
      expect(getNextTierGoal(10)).toBe(60);
      expect(getNextTierGoal(60)).toBe(200);
      expect(getNextTierGoal(400)).toBeNull();
   });

   it('builds an encoded invite link', () => {
      expect(buildInviteLink('maria cruz', 'https://moodeng.app')).toBe('https://moodeng.app/invite/maria%20cruz');
      expect(buildInviteLink('ABCDEF12345', 'null')).toBe('https://moodeng.app/invite/ABCDEF12345');
   });

   it('renders the milestone popup reward and call to action', () => {
      const milestone = SAMPLE_STATES.verified.milestones[0];
      const html = renderToStaticMarkup(
         createElement(
            MemoryRouter,
            null,
            createElement(MilestonePopup, { milestone, isVerified: true, onClose: () => undefined, onVerify: () => undefined })
         )
      );
      expect(html).toContain('Feed Moodeng to level up.');
      expect(html).toContain('Request Loan &amp; Feed Moodeng');
   });
});

describe('friend referrals client', () => {
   it('validates and normalizes invite codes', () => {
      expect(isValidInviteCode(' sdoivu01381 ')).toBe(true);
      expect(normalizeInviteCode(' sdoivu01381 ')).toBe('SDOIVU01381');
      expect(isValidInviteCode('BOOST5')).toBe(false);
   });

   it('parses get_my_rewards() defensively', () => {
      expect(parseMyRewards(null)).toEqual(EMPTY_REWARDS);
      const parsed = parseMyRewards({
         invitedCount: '2',
         qualifiedCount: 1,
         wasReferred: true,
         claimable: [{ reward: 'referral_inviter', friendReferralId: 'r1', amountPhp: '100' }],
         claims: [{ reward: 'first_on_time_repayment', friendReferralId: null, status: 'pending' }]
      });
      expect(parsed.invitedCount).toBe(2);
      expect(parsed.claimable[0]).toEqual({ reward: 'referral_inviter', friendReferralId: 'r1', amountPhp: 100 });
      expect(parsed.claims[0].status).toBe('pending');
   });

   it('reports voucher state from the server data', () => {
      const rewards = parseMyRewards({
         claimable: [{ reward: 'referral_inviter', friendReferralId: 'r1', amountPhp: 100 }],
         claims: [{ reward: 'first_on_time_repayment', friendReferralId: null, status: 'sent' }]
      });
      expect(getVoucherState(rewards, OWN_VOUCHER).state).toBe('sent');
      expect(getVoucherState(rewards, REFERRAL_VOUCHERS)).toEqual({
         state: 'claimable',
         voucher: { reward: 'referral_inviter', friendReferralId: 'r1', amountPhp: 100 }
      });
      expect(getVoucherState(EMPTY_REWARDS, OWN_VOUCHER).state).toBe('none');
   });
});
