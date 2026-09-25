import { useState } from 'react';

import { useSelector } from 'react-redux';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import GuidedTourPreview from '@/components/GuidedTourPreview';

import { useIsBorrower } from '@/hooks/useIsBorrower';
import { usePushNotifications } from '@/hooks/usePushNotifications';

import type { ClaimableVoucher } from '@/lib/friendReferrals';
import { recordGuidedTourEvent } from '@/lib/guidedTourEvents';
import { BORROWER_GUIDED_TOUR_ID, markGuidedTourCompleted, shouldShowGuidedTour } from '@/lib/guidedTourStorage';
import { isPreviewHost } from '@/lib/previewHost';
import type { RootState } from '@/store/store';
import WalletBalanceCard from '@/views/account/WalletBalanceCard';
import {
   ConnectWalletBanner,
   TurnOnRemindersBanner,
   VerifyIdentityBanner,
   VoucherReferralBanner,
   WithdrawBanner
} from '@/views/dashboard-v2/components/DashboardV2Banners';
import DashboardV2Hero from '@/views/dashboard-v2/components/DashboardV2Hero';
import { MilestonePopup, MilestoneStreakPopup, VerifyPopup } from '@/views/dashboard-v2/components/DashboardV2Popups';
import {
   LoanSummarySection,
   MilestonesSection,
   TierVoucherCard,
   UpcomingDuesSection
} from '@/views/dashboard-v2/components/DashboardV2Sections';
import { getVoucherState, OWN_VOUCHER, TIER_VOUCHERS } from '@/views/dashboard-v2/dashboardV2Model';
import DashboardV2PreviewBar from '@/views/dashboard-v2/DashboardV2Preview';
import { VoucherClaimPopup } from '@/views/dashboard-v2/DashboardV2Rewards';
import type { DashboardV2Milestone } from '@/views/dashboard-v2/types';
import { useDashboardV2Preview } from '@/views/dashboard-v2/useDashboardV2Preview';
import { STREAK_MIN_MILESTONES, type StreakMilestone, useWeeklyMilestoneStreak } from '@/views/dashboard-v2/useWeeklyMilestoneStreak';

// Mirrors the live dashboard's tour (the request board hands off with ?tour=1&requestBoardTourSteps=N).
const REQUEST_BOARD_TOUR_STEP_COUNT = 5;
const DASHBOARD_TOUR_STEPS = [
   {
      target: '[data-tour-target="dashboard-trust-score-heading"]',
      title: 'Trust & Pandesal',
      body: 'Feed Moodeng Pandesal to grow your trust: verifying, repaying on time and milestones earn it, and Moodeng grows from Rookie to Apex.',
      durationMs: 6500
   },
   {
      target: '[data-tour-target="dashboard-credit-level"]',
      title: 'Credit Level',
      body: 'Credit Level is your borrowing tier. Trust is what you build; Credit Level is what that trust unlocks.',
      durationMs: 7200
   },
   {
      target: '[data-tour-target="dashboard-milestones-heading"]',
      title: 'Milestones',
      body: 'Milestones are extra ways to earn Pandesal. Complete them to strengthen your profile and make lenders more confident in your requests.',
      durationMs: 7600
   }
];

// Preview-only sample for ?streak=1 on dev / Vercel previews.
const SAMPLE_STREAK: StreakMilestone[] = [
   {
      id: 'first-loan-request',
      title: 'Post your first loan request',
      points: 10,
      completedAt: new Date(Date.now() - 3 * 864e5).toISOString()
   },
   { id: 'first-funded-loan', title: 'Get funded by a lender', points: 15, completedAt: new Date(Date.now() - 864e5).toISOString() }
];

const streakSeenKey = (userId: string) => `moodeng:milestone-streak-seen:${userId}`;

const readSeenStreak = (userId: string): string | null => {
   try {
      return window.localStorage.getItem(streakSeenKey(userId));
   } catch {
      return null;
   }
};

const SKELETON_BLOCKS = [
   { id: 'banner', height: 64 },
   { id: 'milestones', height: 300 },
   { id: 'voucher', height: 81 },
   { id: 'summary', height: 123 },
   { id: 'dues', height: 113 }
];

/** Loading state: the sections keep their shape so the page doesn't jump when data lands. */
function DashboardV2Skeleton() {
   return (
      <div className="mt-[30px] flex flex-col gap-[30px] px-5" aria-busy="true" aria-label="Loading your dashboard">
         {SKELETON_BLOCKS.map(({ id, height }) => (
            <div key={id} className="animate-pulse rounded-[8px] bg-[#ece9f1]" style={{ height }} />
         ))}
      </div>
   );
}

/**
 * Preview of the redesigned borrower dashboard (Figma "New Dashboard for Borrowers").
 * Only routed on dev and *.vercel.app previews. It reads the same data as /dashboard and never writes.
 */
export default function DashboardV2() {
   const navigate = useNavigate();
   const { model, previewState, isReal, isSignedIn, isReady, language, previewSearch } = useDashboardV2Preview();
   const [openMilestone, setOpenMilestone] = useState<DashboardV2Milestone | null>(null);
   const [isVerifyOpen, setIsVerifyOpen] = useState(false);
   // Snapshot of the voucher being claimed: the rewards refetch after submitting removes it from `claimable`,
   // and the popup must stay open to show its thank-you screen.
   const [claimingVoucher, setClaimingVoucher] = useState<ClaimableVoucher | null>(null);
   const isLoading = isReal && !isReady;
   const isBorrower = useIsBorrower();
   const userId = useSelector((state: RootState) => state.auth.user?.id) ?? '';
   const push = usePushNotifications(isReal ? userId : null);
   // Borrowers with something to repay who haven't allowed push. Only permission is checked (not the
   // subscription, which resolves asynchronously) so the card never flashes for someone who has it on.
   const showRemindersBanner = isReal && push.isSupported && model.dues.length > 0 && push.permission !== 'granted';
   const [searchParams] = useSearchParams();
   const tourStepsParam = Number(searchParams.get('requestBoardTourSteps'));
   const requestBoardTourStepCount =
      Number.isInteger(tourStepsParam) && tourStepsParam > 0 ? tourStepsParam : REQUEST_BOARD_TOUR_STEP_COUNT;
   const showTour = searchParams.has('tour') && shouldShowGuidedTour(BORROWER_GUIDED_TOUR_ID, userId, false);
   const ownVoucher = getVoucherState(model.rewards, OWN_VOUCHER, model.referralLoading);
   // The lowest tier whose GrabFood voucher is waiting to be claimed (one card at a time).
   const claimableTierVoucher = TIER_VOUCHERS.map((tier) => ({
      tier,
      claimable: model.rewards.claimable.find((item) => item.reward === tier.reward) ?? null
   })).find((entry) => entry.claimable);

   // Milestone streak: 2+ milestones in the last 7 days. Shown once per new set of milestones (so the
   // next milestone inside the week celebrates again), remembered per device.
   const weeklyStreak = useWeeklyMilestoneStreak(isReal);
   const isStreakPreview = isPreviewHost() && searchParams.get('streak') === '1';
   const streakMilestones = isStreakPreview ? SAMPLE_STREAK : weeklyStreak.milestones;
   const streakSignature = streakMilestones.map((milestone) => milestone.id).join(',');
   // Read at render time: the user id arrives after the first render, so a lazy initial state would miss it.
   const [dismissedStreak, setDismissedStreak] = useState<string | null>(null);
   const isStreakSeen = dismissedStreak === streakSignature || (Boolean(userId) && readSeenStreak(userId) === streakSignature);
   const showStreak =
      streakMilestones.length >= STREAK_MIN_MILESTONES &&
      (isStreakPreview || (Boolean(userId) && !isStreakSeen)) &&
      !showTour &&
      !openMilestone &&
      !isVerifyOpen &&
      !claimingVoucher;
   const dismissStreak = () => {
      setDismissedStreak(streakSignature);
      try {
         window.localStorage.setItem(streakSeenKey(userId), streakSignature);
      } catch {
         // Storage blocked: it just shows again next visit.
      }
   };

   // Same as /dashboard: lenders have their own dashboard. Sample states stay viewable for the team.
   if (isReal && !isBorrower) {
      return <Navigate to="/lender/dashboard" replace />;
   }

   const milestonesAndVoucher = (
      <div className="flex flex-col" data-tour-target="dashboard-milestones-heading">
         <MilestonesSection
            model={model}
            allMilestonesHref={`/dashboard/milestones${previewSearch}`}
            onGet={setOpenMilestone}
            onClaim={() => setClaimingVoucher(ownVoucher.voucher)}
         />
         <div className="-mt-[5px]">
            <VoucherReferralBanner language={language} onRefer={() => navigate(`/dashboard/refer${previewSearch}`)} />
         </div>
      </div>
   );

   return (
      <div className="min-h-screen bg-[#f7f7f7]">
         <div className="mx-auto max-w-[440px] pb-28">
            {isPreviewHost() ? <DashboardV2PreviewBar previewState={previewState} isSignedIn={isSignedIn} language={language} /> : null}

            <DashboardV2Hero
               key={`${previewState}-${model.tier}-${model.isVerified}-${model.creditLevel}`}
               model={model}
               showRealAvatar={isReal}
            />

            {isLoading ? (
               <DashboardV2Skeleton />
            ) : (
               <div className="mt-[30px] flex flex-col gap-[30px]">
                  {/* Instant-wallet borrowers' balance + Cash out (renders nothing otherwise), as on /dashboard. */}
                  {isReal ? (
                     <div className="px-5 empty:hidden">
                        <WalletBalanceCard />
                     </div>
                  ) : null}
                  {model.showWithdraw ? <WithdrawBanner onWithdraw={() => navigate('/withdraw')} /> : null}
                  {!model.isVerified ? <VerifyIdentityBanner onVerify={() => setIsVerifyOpen(true)} /> : null}
                  {model.showConnectWallet ? <ConnectWalletBanner onConnect={() => navigate('/onboarding/wallet')} /> : null}
                  {showRemindersBanner ? (
                     <TurnOnRemindersBanner
                        language={language}
                        isBlocked={push.permission === 'denied'}
                        isBusy={push.isBusy}
                        onEnable={() => void push.enable()}
                     />
                  ) : null}
                  {model.hasOverdue ? <UpcomingDuesSection model={model} /> : null}
                  {claimableTierVoucher ? (
                     <TierVoucherCard
                        label={claimableTierVoucher.tier.label}
                        amountPhp={claimableTierVoucher.tier.amountPhp}
                        onClaim={() => setClaimingVoucher(claimableTierVoucher.claimable)}
                     />
                  ) : null}
                  {milestonesAndVoucher}
                  <LoanSummarySection model={model} />
                  {!model.hasOverdue ? <UpcomingDuesSection model={model} /> : null}
               </div>
            )}
         </div>

         {openMilestone ? (
            <MilestonePopup
               milestone={openMilestone}
               isVerified={model.isVerified}
               onClose={() => setOpenMilestone(null)}
               onVerify={() => setIsVerifyOpen(true)}
            />
         ) : null}
         {isVerifyOpen ? <VerifyPopup onClose={() => setIsVerifyOpen(false)} returnTo={`/dashboard${previewSearch}`} /> : null}
         {showTour ? (
            <GuidedTourPreview
               startImmediately={searchParams.get('tour') === '1' || searchParams.get('startTour') === '1'}
               onStepBack={() => {
                  const back = new URLSearchParams({
                     startTour: '1',
                     tour: '1',
                     tourStep: String(Math.max(requestBoardTourStepCount - 1, 0))
                  });
                  navigate(`/request-board?${back.toString()}`);
                  return true;
               }}
               onFinish={(reason) => {
                  markGuidedTourCompleted(BORROWER_GUIDED_TOUR_ID, userId);
                  void recordGuidedTourEvent({
                     eventType: reason === 'skip' ? 'skipped' : 'completed',
                     metadata: { path: '/dashboard', role: 'borrower' },
                     tourId: BORROWER_GUIDED_TOUR_ID,
                     userId
                  });
                  navigate('/request-board');
               }}
               stepOffset={requestBoardTourStepCount}
               totalSteps={requestBoardTourStepCount + DASHBOARD_TOUR_STEPS.length}
               steps={DASHBOARD_TOUR_STEPS}
            />
         ) : null}
         {showStreak ? (
            <MilestoneStreakPopup
               milestones={streakMilestones}
               language={language}
               onClose={dismissStreak}
               onSeeNext={() => {
                  dismissStreak();
                  navigate(`/dashboard/milestones${previewSearch}`);
               }}
            />
         ) : null}
         {claimingVoucher ? (
            <VoucherClaimPopup voucher={claimingVoucher} isPreview={!isReal} onClose={() => setClaimingVoucher(null)} />
         ) : null}
      </div>
   );
}
