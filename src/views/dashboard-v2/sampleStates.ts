import { EMPTY_REWARDS } from '@/lib/friendReferrals';
import { toDashboardV2MilestoneList, toDashboardV2Milestones } from '@/views/dashboard-v2/dashboardV2Model';
import type { DashboardV2Model, DashboardV2PreviewState } from '@/views/dashboard-v2/types';
import { buildReputationMilestones } from '@/views/dashboard/dashboardHelpers';

// SAMPLE DATA: values copied from the Figma frames so each design state can be reviewed as drawn.

// Milestones come from the real shared definitions, evaluated for a borrower with no loans yet.
const SAMPLE_ALL_MILESTONES = toDashboardV2MilestoneList(
   buildReputationMilestones({ creditLevels: [], borrowerLoans: [], isVerified: true })
);
const SAMPLE_MILESTONES = toDashboardV2Milestones(buildReputationMilestones({ creditLevels: [], borrowerLoans: [], isVerified: true }));

// Not in the Figma: a borrower who repaid their first loan on time and can claim the GrabFood voucher.
const REWARDED_ALL_MILESTONES = SAMPLE_ALL_MILESTONES.map((milestone, index) => ({
   ...milestone,
   status: index < 3 ? ('unlocked' as const) : index === 3 ? ('next' as const) : ('locked' as const)
}));

const SAMPLE_BASE: Omit<
   DashboardV2Model,
   'isVerified' | 'pandesal' | 'mood' | 'creditLevel' | 'creditProgress' | 'creditHint' | 'dues' | 'summary' | 'hasOverdue'
> = {
   firstName: 'Jimmy',
   daysLive: 6,
   tier: 'rookie',
   showConnectWallet: true,
   showWithdraw: false,
   milestones: SAMPLE_MILESTONES,
   allMilestones: SAMPLE_ALL_MILESTONES,
   pandesalGoal: 50,
   referralCode: 'SDOIVU01381',
   rewards: EMPTY_REWARDS,
   insightsHref: '/dashboard'
};

export const SAMPLE_STATES: Record<Exclude<DashboardV2PreviewState, 'real'>, DashboardV2Model> = {
   unverified: {
      ...SAMPLE_BASE,
      isVerified: false,
      pandesal: 0,
      mood: 'waiting',
      creditLevel: 0,
      creditProgress: 0,
      creditHint: { highlight: '$20', rest: ' left to LV.1' },
      summary: { repaymentsTotal: 0, active: 0, pending: 0, defaulted: 0 },
      dues: [],
      hasOverdue: false
   },
   verified: {
      ...SAMPLE_BASE,
      isVerified: true,
      pandesal: 30,
      mood: 'loan',
      creditLevel: 1,
      creditProgress: 0.4,
      creditHint: { highlight: '$13.32', rest: ' left to LV.2' },
      summary: { repaymentsTotal: 1, active: 5, pending: 1.68, defaulted: 0 },
      dues: [
         { id: 'sample-due-1', amount: 5, daysRemaining: 5, lenderName: 'Maricar Cruz', isOverdue: false },
         { id: 'sample-due-2', amount: 1.68, daysRemaining: 13, lenderName: 'Milagros Reyes', isOverdue: false }
      ],
      hasOverdue: false,
      // Not in the Figma: shows where the live dashboard's "Withdraw your USDC" button sits.
      showWithdraw: true
   },
   defaulted: {
      ...SAMPLE_BASE,
      isVerified: true,
      pandesal: 30,
      mood: 'repaid',
      creditLevel: 1,
      creditProgress: 0.35,
      creditHint: { highlight: '$10.32', rest: ' left to LV.2' },
      summary: { repaymentsTotal: 1, active: 5, pending: 1.68, defaulted: 3 },
      dues: [
         { id: 'sample-due-0', amount: 3, daysRemaining: 0, lenderName: 'Maricar Cruz', isOverdue: true },
         { id: 'sample-due-1', amount: 5, daysRemaining: 5, lenderName: 'Maricar Cruz', isOverdue: false },
         { id: 'sample-due-2', amount: 1.68, daysRemaining: 13, lenderName: 'Milagros Reyes', isOverdue: false }
      ],
      hasOverdue: true
   },
   rewarded: {
      ...SAMPLE_BASE,
      isVerified: true,
      pandesal: 45,
      mood: 'repaid',
      creditLevel: 2,
      creditProgress: 0.25,
      creditHint: { highlight: '$15.00', rest: ' left to LV.3' },
      milestones: REWARDED_ALL_MILESTONES.slice(0, 3),
      allMilestones: REWARDED_ALL_MILESTONES,
      summary: { repaymentsTotal: 18, active: 0, pending: 0, defaulted: 0 },
      dues: [],
      hasOverdue: false,
      rewards: {
         invitedCount: 2,
         qualifiedCount: 1,
         wasReferred: false,
         claimable: [
            { reward: 'first_on_time_repayment', friendReferralId: null, amountPhp: 50 },
            { reward: 'referral_inviter', friendReferralId: 'sample-referral-1', amountPhp: 100 }
         ],
         claims: []
      }
   }
};
