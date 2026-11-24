import { useMemo, useState } from 'react';

import { useSelector } from 'react-redux';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { AddEmailCard } from '@/components/account/AddEmailCard';
import { ConnectFacebookLoginCard } from '@/components/account/ConnectFacebookLoginCard';
import { ConfirmEmailReminder } from '@/components/account/ConfirmEmailReminder';
import ContactLinesCard from '@/components/ContactLinesCard';
import GuidedTourPreview from '@/components/GuidedTourPreview';
import VerifyYourselfModal from '@/components/verification/VerifyYourselfModal';

import { useConfirmVoucherReceived } from '@/hooks/useFriendReferrals';
import { useIsBorrower } from '@/hooks/useIsBorrower';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useVerificationJourney } from '@/hooks/useVerificationJourney';

import { getEffectiveCreditLimit } from '@/lib/creditLeveling';
import type { ClaimableVoucher } from '@/lib/friendReferrals';
import { recordGuidedTourEvent } from '@/lib/guidedTourEvents';
import { BORROWER_GUIDED_TOUR_ID, markGuidedTourCompleted, shouldShowGuidedTour } from '@/lib/guidedTourStorage';
import { isPreviewHost } from '@/lib/previewHost';
import { needsHomeScreenForPush } from '@/lib/push/webPushClient';
import { getVerificationUiState } from '@/lib/verificationUiState';
import type { RootState } from '@/store/store';
import WalletBalanceCard from '@/views/account/WalletBalanceCard';
import CreditTrackCard from '@/views/dashboard-v2/components/CreditTrackCard';
import {
   ConnectFacebookBanner,
   ConnectWalletBanner,
   TurnOnRemindersBanner,
   VerifyIdentityBanner,
   WithdrawBanner
} from '@/views/dashboard-v2/components/DashboardV2Banners';
import DashboardV2Hero from '@/views/dashboard-v2/components/DashboardV2Hero';
import { buildFastRepayPreviewLoan, FastRepayCarousel, useFastRepayNotice } from '@/views/dashboard-v2/components/FastRepayNotice';
import { MilestonePopup, MilestoneStreakPopup } from '@/views/dashboard-v2/components/DashboardV2Popups';
import {
   LoanSummarySection,
   MilestonesSection,
   RewardsWaitingCard,
   UpcomingDuesSection,
   VoucherFollowUpCard
} from '@/views/dashboard-v2/components/DashboardV2Sections';
import LimitStaysCard from '@/views/dashboard-v2/components/LimitStaysCard';
import RatesAnnouncement from '@/views/dashboard-v2/components/RatesAnnouncement';
import { findOpenFullLimitLoan } from '@/views/dashboard-v2/dashboardV2Model';
import { getVoucherFollowUp, getVoucherState, OWN_VOUCHER } from '@/views/dashboard-v2/dashboardV2Model';
import DashboardV2PreviewBar from '@/views/dashboard-v2/DashboardV2Preview';
import { VoucherClaimPopup } from '@/views/dashboard-v2/DashboardV2Rewards';
import type { DashboardV2Milestone } from '@/views/dashboard-v2/types';
import { useDashboardV2Preview } from '@/views/dashboard-v2/useDashboardV2Preview';
import { STREAK_MIN_MILESTONES, type StreakMilestone, useWeeklyMilestoneStreak } from '@/views/dashboard-v2/useWeeklyMilestoneStreak';
import DashboardStampStrip from '@/views/referral/sharkFighter/DashboardStampStrip';

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
      body: 'Milestones are extra ways to earn Pandesal. Complete them to strengthen your profile and make moo-lenders more confident in your requests.',
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
   { id: 'first-funded-loan', title: 'Get funded by a moo-lender', points: 15, completedAt: new Date(Date.now() - 864e5).toISOString() }
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
            <div key={id} className="animate-pulse rounded-[8px] bg-[#ece9f1] dark:bg-dv2-card" style={{ height }} />
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
   // An ID already with Didit (in review, processing, unfinished, declined) goes to its status page:
   // the chooser starts a new paid Didit session, which also wipes the "in review" status.
   const verifyJourney = useVerificationJourney();
   const handleVerify = () => {
      if (verifyJourney.stage === 'id_with_didit') verifyJourney.go();
      else setIsVerifyOpen(true);
   };
   // Snapshot of the voucher being claimed: the rewards refetch after submitting removes it from `claimable`,
   // and the popup must stay open to show its thank-you screen.
   const [claimingVoucher, setClaimingVoucher] = useState<ClaimableVoucher | null>(null);
   const isLoading = isReal && !isReady;
   const isBorrower = useIsBorrower();
   const userId = useSelector((state: RootState) => state.auth.user?.id) ?? '';
   const authUser = useSelector((state: RootState) => state.auth.user);
   // Phone sign-ups are asked for an email only after their first loan request, so nothing slows
   // them down on the way there (they often do the whole thing inside Facebook's browser).
   const hasRequestedLoan = useSelector((state: RootState) =>
      (state.loans.loans.gloans || []).some((loan) => loan.borrowerUser === userId)
   );
   const allLoans = useSelector((state: RootState) => state.loans.loans.gloans);
   const myLoans = useMemo(() => (allLoans || []).filter((loan) => loan.borrowerUser === userId), [allLoans, userId]);
   // In manual review — or declined — without a confirmed Facebook/WhatsApp line: point them to the
   // Facebook step, so the team can tell them the result (review) or talk them through it (declined).
   const verificationState = getVerificationUiState(authUser);
   const showConnectFacebook =
      isReal && (verificationState === 'review' || verificationState === 'declined') && !authUser?.hasVerifiedContact;
   const push = usePushNotifications(isReal ? userId : null);
   // Borrowers with something to repay who haven't allowed push. Only permission is checked (not the
   // subscription, which resolves asynchronously) so the card never flashes for someone who has it on.
   const remindersVariant = push.isSupported
      ? push.permission === 'denied'
         ? 'blocked'
         : push.permission === 'granted'
           ? null
           : 'enable'
      : needsHomeScreenForPush()
        ? 'home-screen'
        : null;
   const showRemindersBanner = isReal && model.dues.length > 0 && remindersVariant !== null;
   const [searchParams] = useSearchParams();
   const tourStepsParam = Number(searchParams.get('requestBoardTourSteps'));
   const requestBoardTourStepCount =
      Number.isInteger(tourStepsParam) && tourStepsParam > 0 ? tourStepsParam : REQUEST_BOARD_TOUR_STEP_COUNT;
   const trackParam = searchParams.get('track');
   const creditLimitNow = model.isVerified ? getEffectiveCreditLimit(authUser?.cs, true) : 0;
   const previewTrack = isPreviewHost() && (trackParam === 'A' || trackParam === 'B') ? trackParam : undefined;
   const showTour = searchParams.has('tour') && shouldShowGuidedTour(BORROWER_GUIDED_TOUR_ID, userId, false);
   // "Before you repay" carousel for a loan funded under 48 hours ago. Preview: ?fast=1.
   const isFastPreview = !isReal && searchParams.get('fast') === '1';
   const fastRepayLoans = useMemo(() => (isFastPreview ? [buildFastRepayPreviewLoan()] : isReal ? myLoans : []), [isFastPreview, isReal, myLoans]);
   const fastRepay = useFastRepayNotice({ loans: fastRepayLoans, isPreview: isFastPreview });
   const showFastRepay = fastRepay.isOpen && Boolean(fastRepay.notice) && !showTour && !openMilestone && !isVerifyOpen && !claimingVoucher;
   const ownVoucher = getVoucherState(model.rewards, OWN_VOUCHER, model.referralLoading);
   const voucherFollowUp = getVoucherFollowUp(model.rewards);
   const confirmVoucher = useConfirmVoucherReceived();
   const waitingRewards = model.rewards.claimable;

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
      !claimingVoucher &&
      !showFastRepay;
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
            <DashboardStampStrip preview={!isReal} onOpen={() => navigate('/affiliate')} />
         </div>
      </div>
   );

   return (
      <div className="min-h-screen bg-dv2-page">
         <div className="mx-auto max-w-[440px] pb-28">
            {isPreviewHost() ? <DashboardV2PreviewBar previewState={previewState} isSignedIn={isSignedIn} language={language} /> : null}

            <DashboardV2Hero
               key={`${previewState}-${model.tier}-${model.isVerified}-${model.creditLevel}`}
               model={model}
               showRealAvatar={isReal}
               // Sample states have no account to send anywhere, so they open the verify chooser instead.
               onVerify={
                  isReal
                     ? () => {
                          if (!verifyJourney.isLoading) verifyJourney.go();
                       }
                     : () => setIsVerifyOpen(true)
               }
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
                  {/* Phone sign-ups: add an email after the first loan request, then confirm it with a code. */}
                  {isReal && hasRequestedLoan ? <AddEmailCard /> : null}
                  {isReal ? <ConfirmEmailReminder placement="dashboard" /> : null}
                  {model.showWithdraw ? <WithdrawBanner onWithdraw={() => navigate('/withdraw')} /> : null}
                  {isReal && !showConnectFacebook ? <ContactLinesCard className="mx-5" /> : null}
                  {/* Existing accounts: attach Facebook so "Continue with Facebook" opens this account next time. */}
                  {isReal ? <ConnectFacebookLoginCard language={language} /> : null}
                  {showConnectFacebook ? (
                     <ConnectFacebookBanner
                        declined={verificationState === 'declined'}
                        language={language}
                        onConnect={() => navigate('/verify')}
                     />
                  ) : null}
                  {waitingRewards.length ? (
                     <RewardsWaitingCard claimable={waitingRewards} onClaim={() => setClaimingVoucher(waitingRewards[0])} />
                  ) : null}
                  {!model.isVerified ? <VerifyIdentityBanner onVerify={handleVerify} /> : null}
                  {model.showConnectWallet ? <ConnectWalletBanner onConnect={() => navigate('/onboarding/wallet')} /> : null}
                  {showRemindersBanner ? (
                     <TurnOnRemindersBanner
                        language={language}
                        variant={remindersVariant ?? 'enable'}
                        isBusy={push.isBusy}
                        onEnable={() => void push.enable()}
                     />
                  ) : null}
                  {/* The 48-hour rule: why their limit didn't go up, and how to talk to us about it. */}
                  {isReal || new URLSearchParams(window.location.search).has('limit') ? (
                     <LimitStaysCard language={language} preview={!isReal} />
                  ) : null}
                  {/* Credit tracks: early members keep the old ladder; others at an old limit see the new steps. */}
                  {isReal || previewTrack ? (
                     <CreditTrackCard
                        language={language}
                        userId={userId}
                        joinedAt={authUser?.createdAt}
                        limit={creditLimitNow}
                        openFundedAt={findOpenFullLimitLoan(myLoans, creditLimitNow)?.fundedAt ?? null}
                        preview={isReal ? undefined : previewTrack}
                        previewPromise={searchParams.has('promise')}
                     />
                  ) : null}
                  {/* Anything to repay sits near the top, with the streak and what paying on time earns. */}
                  {model.dues.length ? <UpcomingDuesSection model={model} /> : null}
                  {voucherFollowUp ? (
                     <VoucherFollowUpCard
                        claim={voucherFollowUp}
                        isAnswering={confirmVoucher.isPending}
                        onAnswer={(gotIt) => {
                           if (isReal) confirmVoucher.mutate({ claimId: voucherFollowUp.id, gotIt });
                        }}
                     />
                  ) : null}
                  {milestonesAndVoucher}
                  <LoanSummarySection model={model} />
                  {!model.dues.length ? <UpcomingDuesSection model={model} /> : null}
               </div>
            )}
         </div>

         {openMilestone ? (
            <MilestonePopup
               milestone={openMilestone}
               isVerified={model.isVerified}
               onClose={() => setOpenMilestone(null)}
               onVerify={handleVerify}
            />
         ) : null}
         {/* Same "Verify Yourself" chooser as onboarding, Milestones, the loan form and Repay. */}
         <VerifyYourselfModal isOpen={isVerifyOpen} onClose={() => setIsVerifyOpen(false)} returnTo={`/dashboard${previewSearch}`} />
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
         {/* Monthly "rates go down when we all repay" card: once a month, swipe or tap to close. */}
         {isReal || searchParams.get('rates') === '1' ? (
            <RatesAnnouncement
               language={language}
               userId={userId}
               preview={!isReal || searchParams.get('rates') === '1'}
               blocked={showTour || showStreak || showFastRepay || Boolean(openMilestone) || isVerifyOpen || Boolean(claimingVoucher)}
            />
         ) : null}
         {showFastRepay && fastRepay.notice ? (
            <FastRepayCarousel locale={fastRepay.locale} notice={fastRepay.notice} onClose={fastRepay.close} where="dashboard" />
         ) : null}
         {claimingVoucher ? (
            <VoucherClaimPopup voucher={claimingVoucher} isPreview={!isReal} onClose={() => setClaimingVoucher(null)} />
         ) : null}
      </div>
   );
}
