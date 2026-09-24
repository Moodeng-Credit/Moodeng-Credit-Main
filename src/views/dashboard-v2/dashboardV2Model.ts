import { formatCurrency, toNumber } from '@/utils/decimalHelpers';

import { CREDIT_TIERS, getCreditLevelNumber, MAX_CREDIT_LIMIT } from '@/config/creditTiers';
import { isRepaidOnTime } from '@/lib/creditLeveling';
import type { ClaimableVoucher, MyRewards, VoucherReward } from '@/lib/friendReferrals';
import { trustPointMilestoneRuleById } from '@/shared/points';
import type { Loan } from '@/types/loanTypes';
import type { CreditLevelHint, DashboardV2Milestone, MoodengMood, MoodengTierId } from '@/views/dashboard-v2/types';
import type { DashboardMilestone } from '@/views/dashboard/dashboardHelpers';

/**
 * Moodeng growth tiers from the Figma design. "Pandesal" is the design's name for Trust Points,
 * so thresholds are compared against `user_trust_points.points_total`.
 * Pandesal comes from milestones plus +10 per on-time repayment and streak bonuses, so Prime lands
 * around 10 on-time loans and Apex around 20. Keep in sync with app_private.tier_voucher() in
 * migration 20260925090000_pandesal_repayments_and_tier_vouchers.
 */
export const MOODENG_TIERS: { id: MoodengTierId; label: string; minPandesal: number }[] = [
   { id: 'rookie', label: 'Rookie', minPandesal: 0 },
   { id: 'rising', label: 'Rising', minPandesal: 60 },
   { id: 'prime', label: 'Prime', minPandesal: 200 },
   { id: 'apex', label: 'Apex', minPandesal: 400 }
];

/** The GrabFood voucher each tier unlocks (validated and paid out by the database, not here). */
export const TIER_VOUCHERS: { reward: VoucherReward; tier: MoodengTierId; label: string; minPandesal: number; amountPhp: number }[] = [
   { reward: 'tier_rising', tier: 'rising', label: 'Rising', minPandesal: 60, amountPhp: 50 },
   { reward: 'tier_prime', tier: 'prime', label: 'Prime', minPandesal: 200, amountPhp: 100 },
   { reward: 'tier_apex', tier: 'apex', label: 'Apex', minPandesal: 400, amountPhp: 150 }
];
export const TIER_VOUCHER_REWARDS: VoucherReward[] = TIER_VOUCHERS.map((voucher) => voucher.reward);

/** Milestones the new design shows on the dashboard, in order. Verification has its own banner. */
const DASHBOARD_MILESTONE_IDS = ['first-loan-request', 'first-funded-loan', 'first-on-time-repayment'];

/**
 * SAMPLE DATA: the design rewards the first on-time repayment with a GrabFood voucher.
 * No voucher backend exists yet, so this label is design-only.
 */
const VOUCHER_REWARD_OVERRIDES: Record<string, string> = {
   'first-on-time-repayment': '₱50 GrabFood voucher'
};

export const getMoodengTier = (pandesal: number): MoodengTierId => {
   const tier = [...MOODENG_TIERS].reverse().find((candidate) => pandesal >= candidate.minPandesal);
   return tier?.id ?? 'rookie';
};

export const getMoodengMood = ({
   isVerified,
   hasUnpaidFundedLoan,
   hasRepaidLoan
}: {
   isVerified: boolean;
   hasUnpaidFundedLoan: boolean;
   hasRepaidLoan: boolean;
}): MoodengMood => {
   if (!isVerified) return 'waiting';
   if (hasUnpaidFundedLoan) return 'loan';
   if (hasRepaidLoan) return 'repaid';
   return 'waiting';
};

/** Same on-time rule `buildCreditLevels` uses to unlock tiers (fully repaid, on time, not refunded). */
export const getOnTimeRepaidTotal = (loans: Loan[]): number =>
   loans
      .filter((loan) => {
         if (loan.repaymentStatus !== 'Paid' || loan.refundedAt) return false;
         const repaidAmount = toNumber(loan.repaidAmount);
         const totalRepayment = toNumber(loan.totalRepaymentAmount);
         const isFullyRepaid = totalRepayment > 0 ? repaidAmount >= totalRepayment : repaidAmount > 0;
         return isFullyRepaid && isRepaidOnTime(loan.repaidAt ?? loan.updatedAt, loan.dueDate);
      })
      .reduce((sum, loan) => sum + toNumber(loan.loanAmount), 0);

/**
 * Credit level + progress toward the next one. A tier unlocks once the cumulative on-time repaid
 * amount reaches the previous tier's limit (see `buildCreditLevels`), so the gap to the next level is
 * `currentTier - onTimeRepaidTotal`.
 */
export const getCreditLevelProgress = ({
   creditLimit,
   isVerified,
   onTimeRepaidTotal,
   isPaused
}: {
   creditLimit: number;
   isVerified: boolean;
   onTimeRepaidTotal: number;
   isPaused: boolean;
}): { level: number; progress: number; hint: CreditLevelHint } => {
   if (!isVerified || creditLimit <= 0) {
      return { level: 0, progress: 0, hint: { highlight: 'Verify', rest: ' to unlock LV.1' } };
   }

   const level = getCreditLevelNumber(creditLimit);

   if (creditLimit >= MAX_CREDIT_LIMIT) {
      return { level, progress: 1, hint: { highlight: 'Top', rest: ' level reached' } };
   }

   const tierIndex = level - 1;
   const floor = tierIndex > 0 ? CREDIT_TIERS[tierIndex - 1] : 0;
   const target = CREDIT_TIERS[tierIndex];
   const remaining = Math.max(target - onTimeRepaidTotal, 0);
   const progress = target > floor ? Math.min(Math.max((onTimeRepaidTotal - floor) / (target - floor), 0), 1) : 0;

   if (isPaused) {
      return { level, progress, hint: { highlight: 'Paused', rest: ' · repay on time to resume' } };
   }

   return { level, progress, hint: { highlight: `$${formatCurrency(remaining)}`, rest: ` left to LV.${level + 1}` } };
};

/** The designer's shorter titles for the shared milestones (same rules, same points). */
const MILESTONE_TITLES: Record<string, string> = {
   'first-loan-request': 'Post your first loan request',
   'first-funded-loan': 'Get funded by a lender',
   'first-on-time-repayment': 'Repay a loan on time',
   'two-on-time-streak': '2-loan on-time streak',
   'full-limit-credit-builder': 'Repay a full-limit credit',
   'two-unique-lenders': 'Borrow from 2 lenders',
   'repay-100-total': 'Repay $100 total',
   'trusted-borrower-candidate': 'Become a trusted borrower'
};

/** The dashboard's title for a milestone id, falling back to the shared rule's title. */
export const getMilestoneTitle = (id: string): string => MILESTONE_TITLES[id] ?? trustPointMilestoneRuleById[id]?.title ?? id;

const TOP_REWARD_MILESTONE_ID = 'trusted-borrower-candidate';

/**
 * Every borrower milestone except verification (the design shows that as a banner), with next/locked
 * re-assigned so the first open milestone is the one to "Get".
 */
export const toDashboardV2MilestoneList = (milestones: DashboardMilestone[]): DashboardV2Milestone[] => {
   let nextAssigned = false;

   return milestones
      .filter((milestone) => milestone.id !== 'verify-identity')
      .map((milestone) => {
         let status: DashboardV2Milestone['status'] = 'unlocked';
         if (milestone.status !== 'unlocked') {
            status = nextAssigned ? 'locked' : 'next';
            nextAssigned = true;
         }

         const voucherReward = VOUCHER_REWARD_OVERRIDES[milestone.id];

         return {
            id: milestone.id,
            title: MILESTONE_TITLES[milestone.id] ?? milestone.title,
            reward: voucherReward ?? `+${milestone.points ?? 0} Pandesal`,
            status,
            isVoucher: Boolean(voucherReward),
            points: milestone.points ?? 0,
            isTopReward: milestone.id === TOP_REWARD_MILESTONE_ID,
            actionLabel: milestone.actionLabel,
            actionTo: milestone.actionTo
         };
      });
};

/** The three milestones the dashboard card shows, in design order. */
export const toDashboardV2Milestones = (milestones: DashboardMilestone[]): DashboardV2Milestone[] => {
   const list = toDashboardV2MilestoneList(milestones);
   return DASHBOARD_MILESTONE_IDS.map((id) => list.find((milestone) => milestone.id === id)).filter(
      (milestone): milestone is DashboardV2Milestone => Boolean(milestone)
   );
};

/** Pandesal needed for the next Moodeng tier ("Grow Trust with feeding 10/50"), or null at Apex. */
export const getNextTierGoal = (pandesal: number): number | null =>
   MOODENG_TIERS.find((tier) => tier.minPandesal > pandesal)?.minPandesal ?? null;

const PRODUCTION_ORIGIN = 'https://moodeng.app';

/**
 * Public invite link for the referral screen, on the site the borrower is using (so a link shared from a
 * preview deployment opens that preview, where the code exists).
 */
export const buildInviteLink = (code: string, origin = typeof window === 'undefined' ? PRODUCTION_ORIGIN : window.location.origin) =>
   `${origin.startsWith('http') ? origin : PRODUCTION_ORIGIN}/invite/${encodeURIComponent(code)}`;

export type VoucherState = 'claimable' | 'pending' | 'sent' | 'rejected' | 'none' | 'loading';

/** Where a voucher stands, as reported by the database (the UI never decides eligibility itself). */
export const getVoucherState = (
   rewards: MyRewards,
   rewardsFor: VoucherReward[],
   isLoading = false
): { state: VoucherState; voucher: ClaimableVoucher | null } => {
   if (isLoading) return { state: 'loading', voucher: null };
   const voucher = rewards.claimable.find((item) => rewardsFor.includes(item.reward)) ?? null;
   if (voucher) return { state: 'claimable', voucher };

   const claim = rewards.claims.find((item) => rewardsFor.includes(item.reward));
   return { state: claim ? claim.status : 'none', voucher: null };
};

export const OWN_VOUCHER: VoucherReward[] = ['first_on_time_repayment'];
export const REFERRAL_VOUCHERS: VoucherReward[] = ['referral_invitee', 'referral_inviter'];
