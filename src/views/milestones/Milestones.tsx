import { useCallback, useMemo, useState } from 'react';

import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { isUserVerified } from '@/lib/isUserVerified';
import { getBaseWalletLockStatus } from '@/lib/walletProvider';
import type { RootState } from '@/store/store';
import { type Loan, LoanStatus, RepaymentStatus } from '@/types/loanTypes';
import {
   MILESTONE_ICON_CONFIG,
   MILESTONE_STATUS_CLASSES,
   MilestoneDetailSheet,
   MilestoneHelpSheet
} from '@/views/dashboard/components/MilestoneSheets';
import {
   buildReputationMilestones,
   type DashboardMilestone,
   getBorrowerLoans,
   getMilestoneSummary
} from '@/views/dashboard/dashboardHelpers';
import { getEarnedMilestonePoints, getTrustPointRewardProgress, type TrustPointRewardProgress } from '@/views/dashboard/trustPointRewards';
import { useMilestonePointAwards } from '@/views/dashboard/useMilestonePointAwards';
import { useTrustPointTotal } from '@/views/dashboard/useTrustPointTotal';
import { useTrustRewardOwnership } from '@/views/dashboard/useTrustRewardOwnership';
import { useDashboardData } from '@/views/profile/components/tabs/useDashboardData';

const PREVIEW_REPAID_LOANS: Loan[] = [
   {
      id: 'preview-paid-loan-1',
      trackingId: 'preview-paid-loan-1',
      borrowerUser: 'preview-borrower',
      lenderUser: 'preview-lender-a',
      borrowerWallet: '0x71c...9d42',
      lenderWallet: '0x8a4...19b0',
      loanAmount: 15,
      repaidAmount: 18,
      totalRepaymentAmount: 18,
      reason: 'Preview loan',
      loanStatus: LoanStatus.LENT,
      repaymentStatus: RepaymentStatus.PAID,
      dueDate: '2026-05-10T00:00:00.000Z',
      coin: 'USDC',
      hash: [],
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-08T00:00:00.000Z',
      fundedAt: '2026-05-01T00:00:00.000Z'
   },
   {
      id: 'preview-paid-loan-2',
      trackingId: 'preview-paid-loan-2',
      borrowerUser: 'preview-borrower',
      lenderUser: 'preview-lender-b',
      borrowerWallet: '0x71c...9d42',
      lenderWallet: '0x31d...f6aa',
      loanAmount: 20,
      repaidAmount: 23,
      totalRepaymentAmount: 23,
      reason: 'Preview second lender loan',
      loanStatus: LoanStatus.LENT,
      repaymentStatus: RepaymentStatus.PAID,
      dueDate: '2026-05-18T00:00:00.000Z',
      coin: 'USDC',
      hash: [],
      createdAt: '2026-05-12T00:00:00.000Z',
      updatedAt: '2026-05-17T00:00:00.000Z',
      fundedAt: '2026-05-12T00:00:00.000Z'
   }
];

function MilestoneCard({ milestone, onView }: { milestone: DashboardMilestone; onView: (milestone: DashboardMilestone) => void }) {
   const config = MILESTONE_ICON_CONFIG[milestone.status];
   const summary = getMilestoneSummary(milestone);

   return (
      <article className="grid min-h-[76px] w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-[12px] border border-md-primary-100 bg-md-neutral-200 px-3 py-3 antialiased">
         <div className={`flex h-8 w-8 items-center justify-center overflow-hidden rounded-[8px] ${config.bg ?? ''}`}>
            <img src={config.icon} alt="" className={milestone.status === 'locked' ? 'h-5 w-5' : 'h-8 w-8'} />
         </div>
         <div className="min-w-0">
            {milestone.eyebrow ? (
               <p className="text-[10px] font-normal leading-[15px] tracking-[-0.2px] text-md-neutral-700">{milestone.eyebrow}</p>
            ) : null}
            <p className="truncate text-[16px] font-[510] leading-6 tracking-[-0.32px] text-md-heading">{milestone.title}</p>
            <p className="truncate text-[12px] font-normal leading-[18px] tracking-[-0.24px] text-md-neutral-700">{summary}</p>
         </div>

         {milestone.status === 'next' ? (
            <button
               type="button"
               onClick={() => onView(milestone)}
               className={`flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-[8px] px-3 py-2 text-[10px] font-[590] leading-[15px] tracking-[-0.2px] antialiased ${config.labelClass}`}
            >
               {config.label}
            </button>
         ) : milestone.status === 'locked' ? (
            <button
               type="button"
               onClick={() => onView(milestone)}
               className={`flex h-8 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-[8px] px-3 py-2 text-center text-[10px] font-[590] leading-[15px] tracking-[-0.2px] antialiased transition-transform active:scale-[0.98] ${config.labelClass}`}
            >
               {config.label}
               <img src="/icons/locked.svg" alt="" className="h-4 w-4 invert" />
            </button>
         ) : (
            <button
               type="button"
               onClick={() => onView(milestone)}
               className={`flex h-8 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-[8px] px-3 py-2 text-center text-[10px] font-[590] leading-[15px] tracking-[-0.2px] antialiased ${config.labelClass}`}
            >
               {config.label}
               <img src="/icons/check-fill.svg" alt="" className="h-4 w-4" />
            </button>
         )}
      </article>
   );
}

function MilestoneSkeletonCard() {
   return (
      <article className="grid min-h-[76px] w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-[12px] border border-md-primary-100 bg-md-neutral-200 px-3 py-3">
         <div className="h-8 w-8 rounded-[8px] bg-md-neutral-500" />
         <div className="min-w-0 space-y-2">
            <div className="h-[10px] w-20 rounded-full bg-md-neutral-500" />
            <div className="h-4 w-40 rounded-full bg-md-neutral-500" />
            <div className="h-3 w-32 rounded-full bg-md-neutral-500" />
         </div>
         <div className="h-8 w-20 rounded-[8px] bg-md-neutral-500" />
      </article>
   );
}

function RewardStatusPill({ reward, pointsToNext }: { reward: TrustPointRewardProgress; pointsToNext: number }) {
   const label =
      reward.status === 'unlocked' ? 'Unlocked' : reward.status === 'next' ? `${pointsToNext} pts left` : `${reward.threshold} pts`;
   const className =
      reward.status === 'unlocked'
         ? MILESTONE_STATUS_CLASSES.unlocked
         : reward.status === 'next'
           ? 'bg-[#f1ebff] text-md-primary-900'
           : 'bg-[#f2eef8] text-md-neutral-700';

   return (
      <span className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] px-3 text-[11px] font-[590] leading-none ${className}`}>
         {label}
         {reward.status === 'unlocked' ? <img src="/icons/check-fill.svg" alt="" className="h-4 w-4" /> : null}
      </span>
   );
}

function RewardPreviewIcon({
   reward,
   avatarUrl,
   avatarBackground
}: {
   reward: TrustPointRewardProgress;
   avatarUrl?: string | null;
   avatarBackground?: string | null;
}) {
   if (reward.id === 'silver-avatar-ring' || reward.id === 'gold-avatar-ring') {
      const isGold = reward.id === 'gold-avatar-ring';
      const outerClass = isGold
         ? 'bg-[conic-gradient(from_145deg,#f6d365,#fff3b0,#b97916,#fff0a3,#f6d365)] shadow-[0_3px_9px_rgba(183,121,22,0.2)]'
         : 'bg-[conic-gradient(from_145deg,#f8fafc,#a8afbf,#ffffff,#7f879a,#f8fafc)] shadow-[0_3px_9px_rgba(89,99,120,0.16)]';
      const innerClass = isGold ? 'ring-[#fff3b0]' : 'ring-[#eef2f7]';

      return (
         <div className={`flex h-11 w-11 items-center justify-center rounded-full p-[3px] ${outerClass}`}>
            <div
               className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#f3eefb] ring-2 ${innerClass}`}
               style={{ backgroundColor: avatarBackground ?? '#f3eefb' }}
            >
               <img src={avatarUrl || '/icons/avatar-placeholder.png'} alt="" className="h-full w-full object-cover" />
            </div>
         </div>
      );
   }

   const icon = reward.id === 'trusted-profile-badge' ? '/icons/milestone-star-box.svg' : '/icons/milestone-trophy-box.svg';
   const wrapperClass = reward.status === 'unlocked' ? 'bg-[#dcfce7]' : reward.status === 'next' ? 'bg-[#f1ebff]' : 'bg-[#f2eef8]';

   return (
      <div className={`flex h-11 w-11 items-center justify-center rounded-[14px] ${wrapperClass}`}>
         <img src={icon} alt="" className="h-8 w-8" />
      </div>
   );
}

function getRewardThresholdCopy(reward: TrustPointRewardProgress) {
   const action = reward.status === 'unlocked' ? 'Unlocked' : 'Unlocks';
   return `${action} at ${reward.threshold} Trust Points`;
}

function RewardsHelpSheet({ rewards, onClose }: { rewards: TrustPointRewardProgress[]; onClose: () => void }) {
   return (
      <div className="fixed inset-0 z-[80] flex items-end justify-center px-5 pb-5 [font-family:'SF_Pro_Display','SF_Pro',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]">
         <button type="button" aria-label="Close rewards help" className="absolute inset-0 bg-[#12071f]/28" onClick={onClose} />
         <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="rewards-help-title"
            className="relative w-full max-w-[440px] rounded-[28px] bg-white px-5 pb-5 pt-3 shadow-[0_24px_80px_rgba(44,19,82,0.18)]"
         >
            <div className="mx-auto h-1 w-12 rounded-full bg-[#c9c3d4]" />
            <div className="mt-5 flex items-start justify-between gap-4">
               <div>
                  <p className="text-[12px] font-[590] uppercase leading-none tracking-[0.06em] text-md-primary-900">Rewards</p>
                  <h3 id="rewards-help-title" className="mt-2 text-[24px] font-[590] leading-[1.12] tracking-[-0.48px] text-md-heading">
                     How rewards unlock
                  </h3>
               </div>
               <button
                  type="button"
                  onClick={onClose}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-md-neutral-900 active:scale-95"
                  aria-label="Close"
               >
                  <img src="/icons/close.svg" alt="" className="h-5 w-5" />
               </button>
            </div>
            <p className="mt-3 text-[14px] font-normal leading-5 text-md-neutral-700">
               Complete milestones to earn Trust Points. Profile rewards unlock automatically when you reach the required points.
            </p>
            <div className="mt-5 flex flex-col gap-2">
               {rewards.map((reward) => (
                  <div key={reward.id} className="flex items-center justify-between gap-4 rounded-[12px] bg-md-neutral-200 px-3 py-3">
                     <div className="min-w-0">
                        <p className="truncate text-[14px] font-[590] leading-5 tracking-[-0.28px] text-md-heading">{reward.title}</p>
                        <p className="text-[12px] font-normal leading-[18px] tracking-[-0.24px] text-md-neutral-700">
                           {reward.description}
                        </p>
                     </div>
                     <span className="shrink-0 rounded-[8px] bg-[#f1ebff] px-2.5 py-2 text-[11px] font-[590] leading-none text-md-primary-900">
                        {reward.threshold} pts
                     </span>
                  </div>
               ))}
            </div>
         </section>
      </div>
   );
}

function TrustPointRewardsPanel({
   pointsTotal,
   unlockedRewardIds,
   avatarUrl,
   avatarBackground
}: {
   pointsTotal: number;
   unlockedRewardIds?: string[];
   avatarUrl?: string | null;
   avatarBackground?: string | null;
}) {
   const [isRewardsHelpOpen, setIsRewardsHelpOpen] = useState(false);
   const progress = getTrustPointRewardProgress(pointsTotal, unlockedRewardIds);
   const visibleRewards = progress.rewards.slice(0, 3);
   const nextRewardLabel = progress.nextReward ? progress.nextReward.title : 'all preview rewards';

   return (
      <section className="rounded-[18px] border border-md-primary-100 bg-white p-4 shadow-[0_10px_28px_rgba(36,13,72,0.06)]">
         <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
               <div className="inline-flex rounded-full bg-[#f1ebff] px-2.5 py-1 text-[10px] font-[590] uppercase leading-none tracking-[0.04em] text-md-primary-900">
                  Rewards
               </div>
               <h2 className="mt-3 text-[22px] font-[590] leading-[1.1] tracking-[-0.44px] text-md-heading">
                  {progress.pointsTotal} Trust Points
               </h2>
               <p className="mt-1 text-[13px] font-normal leading-5 text-md-neutral-700">
                  Trust Points unlock profile rewards. They do not guarantee funding.
               </p>
               <button
                  type="button"
                  onClick={() => setIsRewardsHelpOpen(true)}
                  className="mt-2 text-left text-[13px] font-[590] leading-5 text-md-blue-600 underline"
               >
                  How rewards work
               </button>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#eafff3]">
               <img src="/icons/milestone-trophy-box.svg" alt="" className="h-10 w-10" />
            </div>
         </div>

         <div className="mt-4">
            <div className="flex items-center justify-between gap-3 text-[12px] font-normal leading-[18px] text-md-neutral-700">
               <span>Next reward</span>
               <span className="truncate text-right text-md-heading">{nextRewardLabel}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f0e9fb]">
               <div className="h-full rounded-full bg-md-primary-900" style={{ width: `${progress.progressPercent}%` }} />
            </div>
         </div>

         <div className="mt-4 flex flex-col gap-2">
            {visibleRewards.map((reward) => (
               <div
                  key={reward.id}
                  className="grid min-h-[68px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-[12px] bg-md-neutral-200 px-3 py-3"
               >
                  <RewardPreviewIcon reward={reward} avatarUrl={avatarUrl} avatarBackground={avatarBackground} />
                  <div className="min-w-0">
                     <p className="truncate text-[14px] font-[590] leading-5 tracking-[-0.28px] text-md-heading">{reward.title}</p>
                     <p className="truncate text-[12px] font-normal leading-[18px] tracking-[-0.24px] text-md-neutral-700">
                        {getRewardThresholdCopy(reward)}
                     </p>
                  </div>
                  <RewardStatusPill reward={reward} pointsToNext={progress.pointsToNext} />
               </div>
            ))}
         </div>
         {isRewardsHelpOpen ? <RewardsHelpSheet rewards={progress.rewards} onClose={() => setIsRewardsHelpOpen(false)} /> : null}
      </section>
   );
}

export default function Milestones() {
   const navigate = useNavigate();
   const user = useSelector((state: RootState) => state.auth.user);
   const loans = useSelector((state: RootState) => state.loans.loans.gloans || []);
   const [searchParams] = useSearchParams();
   const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
   const [isHelpOpen, setIsHelpOpen] = useState(false);
   const { creditLevels, isReady: isDashboardDataReady } = useDashboardData('borrower');
   const isPreview = import.meta.env.DEV && searchParams.get('mockData') === 'rich';
   const isMilestoneDataReady = isPreview || isDashboardDataReady;
   const borrowerLoans = useMemo(() => (isPreview ? PREVIEW_REPAID_LOANS : getBorrowerLoans(loans, user.id)), [isPreview, loans, user.id]);
   const milestones = useMemo(
      () => buildReputationMilestones({ creditLevels, borrowerLoans, isVerified: isUserVerified(user) || isPreview }),
      [borrowerLoans, creditLevels, isPreview, user.isWorldId]
   );
   useMilestonePointAwards({
      userId: user.id,
      milestones,
      enabled: isMilestoneDataReady && !isPreview
   });
   const earnedMilestonePoints = useMemo(() => getEarnedMilestonePoints(milestones), [milestones]);
   const { pointsTotal } = useTrustPointTotal({
      userId: user.id,
      fallbackPoints: earnedMilestonePoints,
      enabled: isMilestoneDataReady && !isPreview
   });
   const fallbackRewardIds = useMemo(
      () =>
         getTrustPointRewardProgress(pointsTotal)
            .rewards.filter((reward) => reward.status === 'unlocked')
            .map((reward) => reward.id),
      [pointsTotal]
   );
   const { unlockedRewardIds } = useTrustRewardOwnership({
      userId: user.id,
      fallbackRewardIds,
      enabled: isMilestoneDataReady && !isPreview
   });
   const nextMilestone = milestones.find((milestone) => milestone.status === 'next') ?? milestones[0];
   const selectedMilestone = milestones.find((milestone) => milestone.id === selectedMilestoneId) ?? null;
   const previewQuery = searchParams.toString();
   const hasUnlockedMilestones = milestones.some((milestone) => milestone.status === 'unlocked');
   const isVerified = isUserVerified(user) || isPreview;
   const baseWalletLock = getBaseWalletLockStatus(user);
   const hasCompletedBaseWalletSetup = isPreview || baseWalletLock.isConfirmedBase;
   const hasFinishedBorrowerSetup = isVerified && hasCompletedBaseWalletSetup;
   const setupCtaLabel =
      !isVerified && !hasCompletedBaseWalletSetup ? 'Start setup' : !hasCompletedBaseWalletSetup ? 'Add Base Wallet' : 'Verify identity';
   const setupEmptyCopy =
      !isVerified && !hasCompletedBaseWalletSetup
         ? 'Finish setup with World ID and a Base Wallet to unlock borrowing and start building your public trust record.'
         : !hasCompletedBaseWalletSetup
           ? 'Add a Base Wallet to unlock borrowing and start building your public trust record.'
           : 'Verify your identity to unlock borrowing and start building your public trust record.';
   const handleSetupCtaClick = useCallback(() => {
      if (!isVerified && !hasCompletedBaseWalletSetup) {
         navigate('/onboarding/welcome', { state: { returnTo: 'milestones' } });
         return;
      }

      if (!hasCompletedBaseWalletSetup) {
         navigate('/onboarding/wallet', { state: { returnTo: 'milestones' } });
         return;
      }

      navigate('/verify-world-id', { state: { returnTo: 'milestones' } });
   }, [hasCompletedBaseWalletSetup, isVerified, navigate]);

   return (
      <div className="min-h-screen bg-md-neutral-200 [font-family:'SF_Pro_Display','SF_Pro',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]">
         <div className="mx-auto flex w-full max-w-[440px] flex-col gap-7 px-5 pb-28 pt-8">
            <div className="grid grid-cols-[24px_minmax(0,1fr)_48px] items-center gap-5">
               <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center"
                  aria-label="Back"
               >
                  <img src="/icons/arrow-left.svg" alt="" className="h-5 w-5" />
               </button>
               <h1 className="min-w-0 whitespace-nowrap text-[28px] font-[590] leading-[1.1] tracking-[-0.56px] text-md-heading">
                  Reputation Milestones
               </h1>
               <button
                  type="button"
                  onClick={() => setIsHelpOpen(true)}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-md-card"
                  aria-label="How milestones work"
               >
                  <img src="/icons/question_light.svg" alt="" className="h-6 w-6" />
               </button>
            </div>

            {isMilestoneDataReady && nextMilestone ? (
               <section className="flex flex-col gap-4">
                  <h2 className="text-[18px] font-[590] leading-[1.2] tracking-[-0.72px] text-md-heading">Upcoming</h2>
                  <MilestoneCard milestone={nextMilestone} onView={(milestone) => setSelectedMilestoneId(milestone.id)} />
               </section>
            ) : !isMilestoneDataReady ? (
               <section className="flex flex-col gap-4">
                  <h2 className="text-[18px] font-[590] leading-[1.2] tracking-[-0.72px] text-md-heading">Upcoming</h2>
                  <MilestoneSkeletonCard />
               </section>
            ) : null}

            {isMilestoneDataReady ? (
               <TrustPointRewardsPanel
                  pointsTotal={pointsTotal}
                  unlockedRewardIds={isPreview ? undefined : unlockedRewardIds}
                  avatarUrl={user.avatarUrl}
                  avatarBackground={user.avatarBackground}
               />
            ) : null}

            <section className="flex flex-col gap-4">
               <h2 className="text-[18px] font-[590] leading-[1.2] tracking-[-0.72px] text-md-heading">All Milestones</h2>
               {!isMilestoneDataReady ? (
                  <div className="flex flex-col gap-3">
                     {[0, 1, 2].map((item) => (
                        <MilestoneSkeletonCard key={item} />
                     ))}
                  </div>
               ) : !hasUnlockedMilestones ? (
                  <div className="flex min-h-[360px] flex-col items-center justify-center px-8 text-center">
                     <h3 className="text-[22px] font-medium leading-tight text-md-heading">No milestones yet</h3>
                     <p className="mt-7 text-[18px] leading-7 text-md-neutral-900">
                        {hasFinishedBorrowerSetup
                           ? 'Your reputation milestones will appear here as you repay loans on time.'
                           : setupEmptyCopy}
                     </p>
                     {hasFinishedBorrowerSetup ? (
                        <button
                           type="button"
                           onClick={() => navigate('/request-board')}
                           className="mt-8 rounded-[16px] bg-md-primary-900 px-8 py-4 text-[18px] font-medium text-white"
                        >
                           Request a loan
                        </button>
                     ) : (
                        <button
                           type="button"
                           onClick={handleSetupCtaClick}
                           className="mt-8 rounded-[16px] bg-md-primary-900 px-8 py-4 text-[18px] font-medium text-white"
                        >
                           {setupCtaLabel}
                        </button>
                     )}
                  </div>
               ) : (
                  <div className="flex flex-col gap-3">
                     {milestones.map((milestone) => (
                        <MilestoneCard key={milestone.id} milestone={milestone} onView={(item) => setSelectedMilestoneId(item.id)} />
                     ))}
                  </div>
               )}
            </section>
         </div>
         <MilestoneDetailSheet milestone={selectedMilestone} previewQuery={previewQuery} onClose={() => setSelectedMilestoneId(null)} />
         {isHelpOpen ? <MilestoneHelpSheet onClose={() => setIsHelpOpen(false)} /> : null}
      </div>
   );
}
