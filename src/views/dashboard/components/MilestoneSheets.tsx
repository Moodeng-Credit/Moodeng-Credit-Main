import type { ReactNode } from 'react';

import { Link } from 'react-router-dom';

import type { DashboardMilestone } from '@/views/dashboard/dashboardHelpers';

export const MILESTONE_ICON_CONFIG: Record<
   DashboardMilestone['status'],
   { bg?: string; icon: string; iconClass?: string; label: string; labelClass: string }
> = {
   next: {
      icon: '/icons/milestone-star-box.svg',
      iconClass: 'h-10 w-10',
      label: 'View Milestone',
      labelClass: 'bg-md-primary-900 text-white'
   },
   unlocked: {
      icon: '/icons/milestone-trophy-box.svg',
      iconClass: 'h-10 w-10',
      label: 'Unlocked',
      labelClass: 'bg-[#9285a0] text-white'
   },
   locked: {
      bg: 'bg-[#9285a0]',
      icon: '/icons/locked.svg',
      label: 'Locked',
      labelClass: 'bg-[#9285a0] text-white'
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
   <div className="fixed inset-0 z-[80] flex items-end">
      <button type="button" aria-label={`Close ${title}`} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <section
         role="dialog"
         aria-modal="true"
         aria-labelledby={labelledBy}
         className="relative mx-auto max-h-[88dvh] w-full max-w-[440px] overflow-y-auto rounded-t-[28px] bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.15)]"
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
   if (!milestone) return null;

   const config = MILESTONE_ICON_CONFIG[milestone.status];
   const actionHref = `${milestone.actionTo ?? '/milestones'}${previewQuery ? `?${previewQuery}` : ''}`;
   const isLocked = milestone.status === 'locked';

   return (
      <SheetShell title="milestone detail" labelledBy="milestone-detail-title" onClose={onClose}>
         <div className="flex items-start gap-4 border-b border-[#f1edf8] px-6 pb-5 pt-2">
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[16px] ${config.bg ?? ''}`}>
               <img src={config.icon} alt="" className={config.iconClass ?? 'h-8 w-8'} />
            </div>
            <div className="min-w-0 flex-1">
               <p className="text-md-b3 font-medium text-md-neutral-700">{milestone.eyebrow}</p>
               <h3 id="milestone-detail-title" className="mt-1 text-[26px] font-semibold leading-tight text-md-heading">
                  {milestone.title}
               </h3>
               <p className="mt-2 text-md-b2 text-md-neutral-900">
                  {milestone.outcome} · {milestone.benefit}
               </p>
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

         <div className="flex flex-col gap-4 px-6 py-5">
            <div className="rounded-[18px] border border-md-primary-100 bg-md-neutral-200 p-4">
               <p className="text-md-b3 font-semibold text-md-heading">What this means</p>
               <p className="mt-1 text-md-b3 leading-6 text-md-neutral-900">{milestone.description}</p>
            </div>

            <div className="rounded-[18px] border border-md-primary-100 bg-white p-4">
               <p className="text-md-b3 font-semibold text-md-heading">What changes after this</p>
               <p className="mt-1 text-md-b3 leading-6 text-md-neutral-900">
                  Your profile shows the new signal: {milestone.outcome.toLowerCase()} · {milestone.benefit.toLowerCase()}.
               </p>
            </div>

            {isLocked ? (
               <button
                  type="button"
                  disabled
                  className="rounded-md-lg bg-[#9285a0] px-4 py-3 text-md-b2 font-semibold text-white opacity-80"
               >
                  Complete earlier milestones first
               </button>
            ) : (
               <Link to={actionHref} className="rounded-md-lg bg-md-primary-900 px-4 py-3 text-center text-md-b2 font-semibold text-white">
                  {milestone.actionLabel ?? 'Continue'}
               </Link>
            )}
         </div>
      </SheetShell>
   );
};

export const MilestoneHelpSheet = ({ onClose }: { onClose: () => void }) => (
   <div className="fixed inset-0 z-[80] flex items-start justify-center px-5 pt-[120px] [font-family:'SF_Pro_Display','SF_Pro',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]">
      <button type="button" aria-label="Close milestone help" className="absolute inset-0 bg-black/20" onClick={onClose} />
      <section
         role="tooltip"
         aria-label="Milestone help"
         className="relative w-[300px] rounded-[8px] bg-[#360975] p-[10px] shadow-[0_8px_24px_rgba(20,18,24,0.18)] before:absolute before:right-[34px] before:top-[-6px] before:h-0 before:w-0 before:border-x-[6px] before:border-b-[6px] before:border-x-transparent before:border-b-[#360975]"
      >
         <p className="text-center text-[14px] font-normal leading-[21px] tracking-[-0.28px] text-[#f1e9fd]">
            Reputation milestones track how you build trust and credit over time through on-time repayments.
         </p>
      </section>
   </div>
);
