import { useEffect, useMemo } from 'react';

import { useDispatch, useSelector } from 'react-redux';

import { useFriendReferrals } from '@/hooks/useFriendReferrals';
import { useRecordedMilestones } from '@/hooks/useRecordedMilestones';
import { useVerificationStatusSync } from '@/hooks/useVerificationStatusSync';

import { calculateDaysBetween, calculateDaysRemaining, parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

import { getBorrowerUsedCreditAmount } from '@/lib/borrowerCreditUsage';
import { getEffectiveCreditLimit } from '@/lib/creditLeveling';
import { isUserVerified } from '@/lib/isUserVerified';
import { getBaseWalletLockStatus } from '@/lib/walletProvider';
import { fetchUserProfiles } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import {
   getCreditLevelProgress,
   getMoodengMood,
   getMoodengTier,
   getNextTierGoal,
   getOnTimeRepaidTotal,
   toDashboardV2MilestoneList,
   toDashboardV2Milestones
} from '@/views/dashboard-v2/dashboardV2Model';
import type { DashboardV2Due, DashboardV2Model } from '@/views/dashboard-v2/types';
import { buildReputationMilestones, getBorrowerLoans } from '@/views/dashboard/dashboardHelpers';
import { useMilestonePointAwards } from '@/views/dashboard/useMilestonePointAwards';
import { useTrustPointTotal } from '@/views/dashboard/useTrustPointTotal';
import { useDashboardData } from '@/views/profile/components/tabs/useDashboardData';

/** Read-only: builds the new dashboard's view model from the same sources as `/dashboard`. */
export function useDashboardV2Model(): { model: DashboardV2Model; isSignedIn: boolean; isReady: boolean } {
   const dispatch = useDispatch<AppDispatch>();
   useVerificationStatusSync();
   const user = useSelector((state: RootState) => state.auth.user);
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const gloanRequests = useSelector((state: RootState) => state.loans.loans.gloans || []);
   const { stats, creditLevels, loanArrays, isReady } = useDashboardData('borrower');
   const isSignedIn = Boolean(user?.id);
   const isVerified = isUserVerified(user);
   const { inviteCode, rewards, error: referralError, isLoading: referralLoading } = useFriendReferrals(isSignedIn);
   const { pointsTotal } = useTrustPointTotal({ userId: user.id, fallbackPoints: 0, enabled: isSignedIn && isVerified });

   const borrowerLoans = useMemo(() => getBorrowerLoans(gloanRequests, user.id), [gloanRequests, user.id]);
   // Same rule as the live dashboard's "Withdraw your USDC" button.
   const hasFundedLoan = gloanRequests.some((loan) => loan.borrowerUser === user.id && loan.loanStatus === 'Lent');

   const dueLoans = useMemo(() => {
      const overdueIds = new Set(loanArrays.defaultedLoans.map((loan) => loan.id));
      return [...loanArrays.activeLoans, ...loanArrays.defaultedLoans]
         .filter((loan, index, all) => all.findIndex((candidate) => candidate.id === loan.id) === index)
         .map((loan) => ({ loan, isOverdue: overdueIds.has(loan.id) }))
         .sort((a, b) => {
            if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
            return parseDateSafely(a.loan.dueDate).getTime() - parseDateSafely(b.loan.dueDate).getTime();
         });
   }, [loanArrays.activeLoans, loanArrays.defaultedLoans]);

   const missingLenderIds = useMemo(
      () =>
         [...new Set(dueLoans.map(({ loan }) => loan.lenderUser).filter(Boolean))].filter(
            (lenderId): lenderId is string => typeof lenderId === 'string' && !userProfiles[lenderId]
         ),
      [dueLoans, userProfiles]
   );

   useEffect(() => {
      if (missingLenderIds.length === 0) return;
      dispatch(fetchUserProfiles(missingLenderIds)).catch(() => undefined);
   }, [dispatch, missingLenderIds]);

   const recordedMilestones = useRecordedMilestones(user.id, isSignedIn);
   const sharedMilestones = useMemo(
      () => buildReputationMilestones({ creditLevels, borrowerLoans, isVerified, recordedCompletionIds: recordedMilestones }),
      [borrowerLoans, creditLevels, isVerified, recordedMilestones]
   );
   // Same as the live dashboard: unlocked milestones are recorded server-side (the RPC re-checks
   // each rule), which is what actually awards their Pandesal.
   useMilestonePointAwards({ userId: user.id, milestones: sharedMilestones, enabled: isSignedIn && isReady });

   const model = useMemo<DashboardV2Model>(() => {
      const pandesal = isVerified ? pointsTotal : 0;
      const creditLimit = getEffectiveCreditLimit(user.cs, isVerified);
      // Same expiry-aware helper and loan set as the Request Board, which enforces the limit: unpaid funded
      // loans plus open (unexpired) requests.
      const creditInUse = Math.min(getBorrowerUsedCreditAmount(borrowerLoans), creditLimit);
      const credit = getCreditLevelProgress({
         creditLimit,
         isVerified,
         onTimeRepaidTotal: getOnTimeRepaidTotal(borrowerLoans),
         isPaused: Boolean(user.creditProgressionPaused)
      });
      const dues: DashboardV2Due[] = dueLoans.map(({ loan, isOverdue }) => {
         const lender = loan.lenderUser ? userProfiles[loan.lenderUser] : undefined;
         return {
            id: loan.id,
            amount: toNumber(loan.loanAmount),
            daysRemaining: calculateDaysRemaining(loan.dueDate),
            lenderName: lender?.displayName || lender?.username || 'a lender',
            isOverdue
         };
      });

      return {
         firstName: user.displayName?.split(' ')[0] || user.username?.split(' ')[0] || 'there',
         daysLive: user.createdAt ? calculateDaysBetween(parseDateSafely(user.createdAt), new Date()) : 0,
         isVerified,
         pandesal,
         tier: getMoodengTier(pandesal),
         mood: getMoodengMood({
            isVerified,
            hasUnpaidFundedLoan: loanArrays.activeLoans.length > 0,
            hasRepaidLoan: loanArrays.repayments.length > 0
         }),
         creditLevel: credit.level,
         creditLimit,
         creditInUse,
         creditHint: credit.hint,
         showConnectWallet: !getBaseWalletLockStatus(user).isConfirmedBorrowerWallet,
         showWithdraw: hasFundedLoan && !getBaseWalletLockStatus(user).isConfirmedOpenfort,
         milestones: toDashboardV2Milestones(sharedMilestones),
         allMilestones: toDashboardV2MilestoneList(sharedMilestones),
         pandesalGoal: getNextTierGoal(pandesal),
         referralCode: inviteCode,
         referralUnavailable: Boolean(referralError),
         referralLoading,
         rewards,
         summary: {
            repaymentsTotal: stats.repayments.total,
            active: stats.active.total,
            pending: stats.pending.total,
            defaulted: stats.defaulted.total
         },
         dues,
         hasOverdue: dues.some((due) => due.isOverdue),
         insightsHref: user.username ? `/user/${encodeURIComponent(user.username)}#loan-summary` : '/dashboard'
      };
   }, [
      borrowerLoans,
      dueLoans,
      hasFundedLoan,
      inviteCode,
      isVerified,
      loanArrays,
      pointsTotal,
      referralError,
      referralLoading,
      rewards,
      sharedMilestones,
      stats,
      user,
      userProfiles
   ]);

   return { model, isSignedIn, isReady };
}
