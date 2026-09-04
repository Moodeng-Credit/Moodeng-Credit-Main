import type { ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { useVerifyYourself } from '@/components/verification/VerifyYourselfModal';

import { type DashboardMilestone, formatMilestoneTrustPoints } from '@/views/dashboard/dashboardHelpers';

export const MILESTONE_STATUS_CLASSES = {
   next: 'bg-md-primary-900 text-white',
   unlocked: 'bg-[#dcfce7] text-[#10783d] ring-1 ring-inset ring-[#b8f0cf] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
   locked: 'bg-[#9285a0] text-white'
} as const;

export const MILESTONE_ICON_CONFIG: Record<
   DashboardMilestone['status'],
   { bg?: string; icon: string; iconClass?: string; label: string; labelClass: string }
> = {
   next: {
      bg: 'bg-md-primary-100',
      icon: '/icons/milestone-star-box.svg',
      iconClass: 'h-10 w-10',
      label: 'View Milestone',
      labelClass: MILESTONE_STATUS_CLASSES.next
   },
   unlocked: {
      bg: 'bg-md-green-100',
      icon: '/icons/milestone-trophy-box.svg',
      iconClass: 'h-10 w-10',
      label: 'Unlocked',
      labelClass: MILESTONE_STATUS_CLASSES.unlocked
   },
   locked: {
      bg: 'bg-md-neutral-300',
      icon: '/icons/locked.svg',
      label: 'Locked',
      labelClass: MILESTONE_STATUS_CLASSES.locked
   }
};

/**
 * Per-milestone icon art, keyed by DashboardMilestone.id. Only covers milestones with a
 * bespoke icon; anything not listed here falls back to MILESTONE_ICON_CONFIG[status] via
 * getMilestoneIconConfig below.
 */
export const MILESTONE_ID_ICON_OVERRIDES: Partial<Record<string, { bg: string; icon: string }>> = {
   'verify-identity': { bg: 'bg-md-primary-100', icon: '/icons/milestones/verify-identity.png' },
   'first-loan-request': { bg: 'bg-md-primary-100', icon: '/icons/milestones/first-loan-request.png' },
   'first-funded-loan': { bg: 'bg-md-primary-100', icon: '/icons/milestones/first-funded-loan.png' },
   'first-on-time-repayment': { bg: 'bg-md-primary-100', icon: '/icons/milestones/on-time-repayment.png' },
   'two-on-time-streak': { bg: 'bg-md-primary-100', icon: '/icons/milestones/two-on-time-streak.png' },
   'full-limit-credit-builder': { bg: 'bg-md-primary-100', icon: '/icons/milestones/full-limit-credit-builder.png' },
   'two-unique-lenders': { bg: 'bg-md-primary-100', icon: '/icons/milestones/two-unique-lenders.png' },
   'repay-100-total': { bg: 'bg-md-primary-100', icon: '/icons/milestones/repay-100-total.png' },
   'reach-level-three': { bg: 'bg-md-primary-100', icon: '/icons/milestones/reach-level-three.png' },
   'trusted-borrower-candidate': { bg: 'bg-md-primary-100', icon: '/icons/milestones/trusted-borrower-candidate.png' }
};

export const getMilestoneIconConfig = (milestone: Pick<DashboardMilestone, 'id' | 'status'>) => {
   const base = MILESTONE_ICON_CONFIG[milestone.status];
   const override = MILESTONE_ID_ICON_OVERRIDES[milestone.id];
   if (!override) return base;
   // Locked milestones keep their real icon (so the row previews what's coming) but stay muted —
   // the consumer applies grayscale via className, not by swapping back to the generic lock icon.
   return { ...base, icon: override.icon, bg: milestone.status === 'locked' ? 'bg-md-neutral-300' : override.bg, iconClass: 'h-10 w-10' };
};

const SheetShell = ({
   title,
   labelledBy,
   children,
   onClose
}: {
   title: string;
   labelledBy: string;
   children: ReactNode;
   onClose: () => void;
}) => (
   <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:px-5 sm:py-6">
      <button type="button" aria-label={`Close ${title}`} className="absolute inset-0 bg-[#12071f]/36" onClick={onClose} />
      <section
         role="dialog"
         aria-modal="true"
         aria-labelledby={labelledBy}
         className="relative mx-auto max-h-[90dvh] w-full max-w-[440px] overflow-y-auto rounded-t-[28px] border border-[#e7e0ec] bg-[#fdfcfd] shadow-[0_24px_80px_rgba(44,19,82,0.2)] [font-family:'SF_Pro_Display','SF_Pro',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] sm:rounded-[28px]"
      >
         <div className="pb-1 pt-3">
            <div className="mx-auto h-1 w-11 rounded-full bg-[#cec6d7]" />
         </div>
         {children}
      </section>
   </div>
);

export const MilestoneDetailSheet = ({
   milestone,
   previewQuery,
   onClose
}: {
   milestone: DashboardMilestone | null;
   previewQuery: string;
   onClose: () => void;
}) => {
   const { open: openVerify, modal: verifyModal } = useVerifyYourself('milestones');

   if (!milestone) return null;

   const config = getMilestoneIconConfig(milestone);
   const actionHref = `${milestone.actionTo ?? '/milestones'}${previewQuery ? `?${previewQuery}` : ''}`;
   const opensWorldId = milestone.actionTo === '/verify-world-id';
   const isLocked = milestone.status === 'locked';
   const isUnlocked = milestone.status === 'unlocked';
   const pointReward = formatMilestoneTrustPoints(milestone);
   const pointTitle = isUnlocked ? 'Trust Points earned' : milestone.status === 'next' ? 'Reward for completing this' : 'Locked reward';
   const pointDescription = isUnlocked
      ? 'These points are added to your borrower reputation.'
      : 'Complete this milestone to add these points to your borrower reputation.';

   return (
      <SheetShell title="milestone detail" labelledBy="milestone-detail-title" onClose={onClose}>
         <div className="relative px-5 pb-5 pt-3">
            <button
               type="button"
               onClick={onClose}
               className="absolute right-4 top-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-md-neutral-1200 transition hover:bg-[#f3edf8] active:scale-95"
               aria-label="Close"
            >
               <img src="/icons/close.svg" alt="" className="h-5 w-5 dark:invert" />
            </button>
            <div className="flex items-start gap-3 pr-10">
               <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] ${
                     config.bg ?? 'bg-[#f3e8ff]'
                  }`}
               >
                  <img src={config.icon} alt="" className={milestone.status === 'locked' ? 'h-6 w-6' : 'h-9 w-9'} />
               </div>
               <div className="min-w-0 flex-1">
                  <div className="inline-flex rounded-full bg-[#f1ebff] px-2.5 py-1 text-[11px] font-[590] leading-4 text-md-primary-1200">
                     {isUnlocked ? 'Completed' : milestone.eyebrow}
                  </div>
                  <h3 id="milestone-detail-title" className="mt-2 text-[24px] font-[590] leading-[1.12] tracking-[-0.48px] text-md-heading">
                     {milestone.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] font-normal leading-5 text-md-neutral-1200">{milestone.outcome}</p>
               </div>
            </div>
         </div>

         <div className="flex flex-col gap-5 border-t border-[#eee7f5] px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5">
            <div className="rounded-[20px] border border-[#e7d8ff] bg-[#f8f4fc] p-4">
               <p className="text-[12px] font-[590] leading-[18px] text-[#695b7b]">{pointTitle}</p>
               <p className="mt-1 text-[28px] font-[590] leading-8 tracking-[-0.56px] text-[#6c24e8]">{pointReward}</p>
               <p className="mt-2 text-[13px] font-normal leading-5 text-[#695b7b]">{pointDescription}</p>
            </div>

            <div className="divide-y divide-[#eee7f5]">
               <div className="pb-4">
                  <p className="text-[12px] font-[590] leading-[18px] text-md-heading">Why it matters</p>
                  <p className="mt-1 text-[14px] font-normal leading-6 text-md-neutral-1200">{milestone.description}</p>
               </div>
               <div className="pt-4">
                  <p className="text-[12px] font-[590] leading-[18px] text-md-heading">What changes on your profile</p>
                  <p className="mt-1 text-[14px] font-normal leading-6 text-md-neutral-1200">{milestone.benefit}</p>
               </div>
            </div>

            {isLocked ? (
               <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[52px] rounded-[16px] bg-[#eee9f2] px-4 py-3 text-md-b2 font-[590] text-md-neutral-1200 active:scale-[0.99]"
               >
                  Complete earlier milestones first
               </button>
            ) : isUnlocked ? (
               <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[52px] rounded-[16px] bg-md-primary-900 px-4 py-3 text-md-b2 font-[590] text-white transition hover:bg-[#5200c8] active:scale-[0.99]"
               >
                  Done
               </button>
            ) : opensWorldId ? (
               <button
                  type="button"
                  onClick={openVerify}
                  className="min-h-[52px] rounded-[16px] bg-md-primary-900 px-4 py-3 text-center text-md-b2 font-[590] text-white transition hover:bg-[#5200c8]"
               >
                  {milestone.actionLabel ?? 'Continue'}
               </button>
            ) : (
               <Link
                  to={actionHref}
                  className="inline-flex min-h-[52px] items-center justify-center rounded-[16px] bg-md-primary-900 px-4 py-3 text-center text-md-b2 font-[590] text-white transition hover:bg-[#5200c8]"
               >
                  {milestone.actionLabel ?? 'Continue'}
               </Link>
            )}
         </div>
         {verifyModal}
      </SheetShell>
   );
};

export const MilestoneHelpSheet = ({ onClose }: { onClose: () => void }) => (
   <SheetShell title="milestone help" labelledBy="milestone-help-title" onClose={onClose}>
      <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3">
         <div className="flex items-start justify-between gap-4">
            <div>
               <p className="text-[12px] font-[590] leading-[18px] text-md-primary-1200">Reputation milestones</p>
               <h3 id="milestone-help-title" className="mt-1 text-[24px] font-[590] leading-[1.12] tracking-[-0.48px] text-md-heading">
                  Build trust one step at a time
               </h3>
            </div>
            <button
               type="button"
               onClick={onClose}
               className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-md-neutral-1200 transition hover:bg-[#f3edf8] active:scale-95"
               aria-label="Close"
            >
               <img src="/icons/close.svg" alt="" className="h-5 w-5" />
            </button>
         </div>
         <p className="mt-3 text-[14px] font-normal leading-6 text-md-neutral-1200">
            Complete clear actions, such as verifying your identity and repaying on time. Each completed milestone adds Trust Points to your
            borrower profile.
         </p>
         <div className="mt-5 divide-y divide-[#eee7f5] rounded-[20px] border border-[#e7d8ff] bg-[#f8f4fc] px-4">
            <div className="py-4">
               <p className="text-[13px] font-[590] leading-5 text-md-heading">Next milestone</p>
               <p className="mt-1 text-[13px] font-normal leading-5 text-md-neutral-1200">The clearest action you can complete now.</p>
            </div>
            <div className="py-4">
               <p className="text-[13px] font-[590] leading-5 text-md-heading">Locked milestones</p>
               <p className="mt-1 text-[13px] font-normal leading-5 text-md-neutral-1200">
                  These become available after earlier steps are complete.
               </p>
            </div>
         </div>
         <button
            type="button"
            onClick={onClose}
            className="mt-5 min-h-[52px] w-full rounded-[16px] bg-md-primary-900 px-4 py-3 text-md-b2 font-[590] text-white transition hover:bg-[#5200c8] active:scale-[0.99]"
         >
            Got it
         </button>
      </div>
   </SheetShell>
);
