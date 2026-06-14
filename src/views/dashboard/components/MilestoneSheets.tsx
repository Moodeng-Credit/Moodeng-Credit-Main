import type { ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { useVerifyYourself } from '@/components/verification/VerifyYourselfModal';
import { formatMilestoneTrustPoints, type DashboardMilestone } from '@/views/dashboard/dashboardHelpers';

export const MILESTONE_STATUS_CLASSES = {
   next: 'bg-md-primary-900 text-white',
   unlocked:
      'bg-[#dcfce7] text-[#10783d] ring-1 ring-inset ring-[#b8f0cf] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
   locked: 'bg-[#9285a0] text-white'
} as const;

export const MILESTONE_ICON_CONFIG: Record<
   DashboardMilestone['status'],
   { bg?: string; icon: string; iconClass?: string; label: string; labelClass: string }
> = {
   next: {
      icon: '/icons/milestone-star-box.svg',
      iconClass: 'h-10 w-10',
      label: 'View Milestone',
      labelClass: MILESTONE_STATUS_CLASSES.next
   },
   unlocked: {
      icon: '/icons/milestone-trophy-box.svg',
      iconClass: 'h-10 w-10',
      label: 'Unlocked',
      labelClass: MILESTONE_STATUS_CLASSES.unlocked
   },
   locked: {
      bg: 'bg-[#9285a0]',
      icon: '/icons/locked.svg',
      label: 'Locked',
      labelClass: MILESTONE_STATUS_CLASSES.locked
   }
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
   <div className="fixed inset-0 z-[80] flex items-center justify-center px-5 py-6">
      <button type="button" aria-label={`Close ${title}`} className="absolute inset-0 bg-[#12071f]/40 backdrop-blur-sm" onClick={onClose} />
      <section
         role="dialog"
         aria-modal="true"
         aria-labelledby={labelledBy}
         className="relative mx-auto max-h-[88dvh] w-full max-w-[440px] overflow-y-auto rounded-[28px] bg-white shadow-[0_18px_60px_rgba(20,18,24,0.22)]"
      >
         <div className="pb-2 pt-3">
            <div className="mx-auto h-1 w-12 rounded-full bg-[#c9c3d4]" />
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

   const config = MILESTONE_ICON_CONFIG[milestone.status];
   const actionHref = `${milestone.actionTo ?? '/milestones'}${previewQuery ? `?${previewQuery}` : ''}`;
   const opensWorldId = milestone.actionTo === '/verify-world-id';
   const isLocked = milestone.status === 'locked';
   const isUnlocked = milestone.status === 'unlocked';
   const pointReward = formatMilestoneTrustPoints(milestone);
   const pointTitle =
      isUnlocked
         ? 'Trust Points earned'
         : milestone.status === 'next'
           ? 'Reward for completing this'
           : 'Locked reward';
   const pointDescription =
      isUnlocked
         ? 'These points are added to your borrower reputation.'
         : 'Complete this milestone to add these points to your borrower reputation.';

   return (
      <SheetShell title="milestone detail" labelledBy="milestone-detail-title" onClose={onClose}>
         <div className="relative px-6 pb-5 pt-2">
            <button
               type="button"
               onClick={onClose}
               className="absolute right-5 top-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-md-neutral-900 active:scale-95"
               aria-label="Close"
            >
               <img src="/icons/close.svg" alt="" className="h-5 w-5" />
            </button>
            <div className="flex items-start gap-4 pr-10">
               <div className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[16px] ${config.bg ?? ''}`}>
                  <img src={config.icon} alt="" className={config.iconClass ?? 'h-8 w-8'} />
               </div>
               <div className="min-w-0 flex-1">
                  <div className="inline-flex rounded-full bg-[#f1ebff] px-3 py-1 text-[12px] font-semibold leading-none text-md-primary-900">
                     {isUnlocked ? 'Completed' : milestone.eyebrow}
                  </div>
                  <h3 id="milestone-detail-title" className="mt-3 text-[28px] font-semibold leading-[1.05] tracking-[-0.56px] text-md-heading">
                     {milestone.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-6 text-md-neutral-900">
                     {milestone.outcome} · {milestone.benefit}
                  </p>
               </div>
            </div>
         </div>

         <div className="flex flex-col gap-4 border-t border-[#f1edf8] px-6 py-5">
            <div className="rounded-[22px] bg-gradient-to-br from-[#efe4ff] to-[#f8f3ff] p-5">
               <p className="text-[13px] font-semibold leading-5 text-md-heading">{pointTitle}</p>
               <p className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.68px] text-md-primary-900">{pointReward}</p>
               <p className="mt-3 text-[14px] leading-5 text-md-neutral-900">{pointDescription}</p>
            </div>

            <div className="divide-y divide-[#f1edf8] rounded-[20px] border border-md-primary-100 bg-white">
               <div className="p-4">
                  <p className="text-[13px] font-semibold leading-5 text-md-heading">Why it matters</p>
                  <p className="mt-1 text-[14px] leading-6 text-md-neutral-900">{milestone.description}</p>
               </div>
               <div className="p-4">
                  <p className="text-[13px] font-semibold leading-5 text-md-heading">What lenders see</p>
                  <p className="mt-1 text-[14px] leading-6 text-md-neutral-900">
                     {milestone.outcome} · {milestone.benefit}
                  </p>
               </div>
            </div>

            {isLocked ? (
               <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md-lg bg-md-neutral-500 px-4 py-3 text-md-b2 font-semibold text-md-heading active:scale-[0.99]"
               >
                  Finish earlier milestones first
               </button>
            ) : isUnlocked ? (
               <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md-lg bg-md-primary-900 px-4 py-3 text-md-b2 font-semibold text-white active:scale-[0.99]"
               >
                  Done
               </button>
            ) : opensWorldId ? (
               <button
                  type="button"
                  onClick={openVerify}
                  className="rounded-md-lg bg-md-primary-900 px-4 py-3 text-center text-md-b2 font-semibold text-white"
               >
                  {milestone.actionLabel ?? 'Continue'}
               </button>
            ) : (
               <Link to={actionHref} className="rounded-md-lg bg-md-primary-900 px-4 py-3 text-center text-md-b2 font-semibold text-white">
                  {milestone.actionLabel ?? 'Continue'}
               </Link>
            )}
         </div>
         {verifyModal}
      </SheetShell>
   );
};

export const MilestoneHelpSheet = ({ onClose }: { onClose: () => void }) => (
   <div className="fixed inset-0 z-[80] flex items-center justify-center px-5 [font-family:'SF_Pro_Display','SF_Pro',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]">
      <button type="button" aria-label="Close milestone help" className="absolute inset-0 bg-[#12071f]/20" onClick={onClose} />
      <section
         role="tooltip"
         aria-label="Milestone help"
         className="relative w-[300px] rounded-[12px] bg-[#360975] p-3 shadow-[0_8px_24px_rgba(20,18,24,0.18)]"
      >
         <p className="text-center text-[14px] font-normal leading-[21px] tracking-[-0.28px] text-[#f1e9fd]">
            Reputation milestones track how you build trust and credit over time through on-time repayments.
         </p>
      </section>
   </div>
);
