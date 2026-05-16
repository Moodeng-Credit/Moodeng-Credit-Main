import { useState } from 'react';

import { Link, useSearchParams } from 'react-router-dom';

import { MILESTONE_ICON_CONFIG, MilestoneDetailSheet } from '@/views/dashboard/components/MilestoneSheets';
import type { DashboardMilestone } from '@/views/dashboard/dashboardHelpers';

interface ReputationMilestonesProps {
   milestones: DashboardMilestone[];
   isLoading?: boolean;
}

function MilestoneIcon({ status }: { status: DashboardMilestone['status'] }) {
   const { icon, bg } = MILESTONE_ICON_CONFIG[status];
   return (
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] ${bg ?? ''}`}>
         <img src={icon} alt="" className={status === 'locked' ? 'h-5 w-5' : 'h-8 w-8'} />
      </div>
   );
}

function MilestoneCard({ milestone, onView }: { milestone: DashboardMilestone; onView: (milestone: DashboardMilestone) => void }) {
   const config = MILESTONE_ICON_CONFIG[milestone.status];
   const summary =
      milestone.status === 'next'
         ? milestone.id === 'first-on-time-repayment'
            ? 'Increase your Trust Score'
            : milestone.reward
         : `${milestone.outcome} · ${milestone.benefit}`;

   return (
      <div className="grid min-h-[76px] grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-[10px] rounded-[12px] border border-md-primary-100 bg-md-neutral-200 p-3 antialiased">
         <MilestoneIcon status={milestone.status} />

         <div className="min-w-0">
            {milestone.eyebrow ? (
               <p className="text-[10px] font-normal leading-[15px] tracking-[-0.2px] text-md-neutral-700">{milestone.eyebrow}</p>
            ) : null}
            <p className="truncate text-[16px] font-[510] leading-6 tracking-[-0.32px] text-md-heading">{milestone.title}</p>
            <p className="truncate text-[12px] font-normal leading-[18px] tracking-[-0.24px] text-md-neutral-700">{summary}</p>
         </div>

         <div className="shrink-0">
            {milestone.status === 'next' && (
               <button
                  type="button"
                  onClick={() => onView(milestone)}
                  className={`inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[8px] px-3 py-2 text-[10px] font-[590] leading-[15px] tracking-[-0.2px] antialiased ${config.labelClass}`}
               >
                  View Milestone
               </button>
            )}
            {milestone.status === 'unlocked' && (
               <span
                  className={`inline-flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-[8px] px-3 py-2 text-[10px] font-[590] leading-[15px] tracking-[-0.2px] antialiased ${config.labelClass}`}
               >
                  Unlocked
                  <img src="/icons/unlocked.svg" alt="" className="h-3.5 w-3.5 invert" />
               </span>
            )}
            {milestone.status === 'locked' && (
               <button
                  type="button"
                  onClick={() => onView(milestone)}
                  className={`inline-flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-[8px] px-3 py-2 text-[10px] font-[590] leading-[15px] tracking-[-0.2px] antialiased transition-transform active:scale-[0.98] ${config.labelClass}`}
               >
                  Locked
                  <img src="/icons/locked.svg" alt="" className="h-3.5 w-3.5 invert" />
               </button>
            )}
         </div>
      </div>
   );
}

function MilestoneSkeletonCard() {
   return (
      <div className="grid min-h-[76px] grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-[10px] rounded-[12px] border border-md-primary-100 bg-md-neutral-200 p-3">
         <div className="h-8 w-8 rounded-[10px] bg-md-neutral-500" />
         <div className="min-w-0 space-y-2">
            <div className="h-[10px] w-20 rounded-full bg-md-neutral-500" />
            <div className="h-4 w-40 rounded-full bg-md-neutral-500" />
            <div className="h-3 w-32 rounded-full bg-md-neutral-500" />
         </div>
         <div className="h-8 w-20 rounded-[8px] bg-md-neutral-500" />
      </div>
   );
}

export default function ReputationMilestones({ milestones, isLoading = false }: ReputationMilestonesProps) {
   const [searchParams] = useSearchParams();
   const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
   const [isHelpOpen, setIsHelpOpen] = useState(false);
   const previewQuery = searchParams.toString();
   const milestonesHref = previewQuery ? `/milestones?${previewQuery}` : '/milestones';
   const selectedMilestone = milestones.find((milestone) => milestone.id === selectedMilestoneId) ?? null;

   return (
      <div className="rounded-md-lg bg-md-neutral-100 p-4 shadow-md-card [font-family:'SF_Pro_Display','SF_Pro',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]">
         <div className="relative mb-1 flex items-center justify-between gap-3" data-tour-target="dashboard-milestones-heading">
            <div className="flex items-center gap-2">
               <h2 className="text-[18px] font-[590] leading-[1.2] tracking-[-0.72px] text-[#040033]">Reputation Milestones</h2>
               <button
                  type="button"
                  onClick={() => setIsHelpOpen(true)}
                  className="flex h-6 w-6 items-center justify-center rounded-full"
                  aria-label="How milestones work"
               >
                  <img src="/icons/question_light.svg" alt="" className="h-5 w-5" />
               </button>
               {isHelpOpen && (
                  <div
                     role="tooltip"
                     className="absolute left-0 top-8 z-20 w-[300px] rounded-[10px] bg-[#360975] px-3 py-2 shadow-[0_8px_24px_rgba(20,18,24,0.18)] before:absolute before:left-[202px] before:top-[-6px] before:h-0 before:w-0 before:border-x-[6px] before:border-b-[6px] before:border-x-transparent before:border-b-[#360975]"
                  >
                     <button
                        type="button"
                        aria-label="Close milestone help"
                        className="absolute inset-0"
                        onClick={() => setIsHelpOpen(false)}
                     />
                     <p className="relative text-center text-[14px] font-normal leading-[21px] tracking-[-0.28px] text-[#f1e9fd]">
                        Milestones show what to do next to build trust with lenders.
                     </p>
                  </div>
               )}
            </div>
            <Link
               to={milestonesHref}
               className="shrink-0 text-[14px] font-[590] leading-[21px] tracking-[-0.28px] text-md-blue-600 underline"
            >
               View All Milestones
            </Link>
         </div>
         <p className="mb-3 text-[12px] font-normal leading-[18px] tracking-[-0.24px] text-md-neutral-700">
            Complete milestones to unlock higher loan levels.
         </p>

         <div className="flex flex-col gap-2">
            {isLoading
               ? [0, 1, 2].map((item) => <MilestoneSkeletonCard key={item} />)
               : milestones.slice(0, 3).map((milestone) => (
                    <MilestoneCard key={milestone.id} milestone={milestone} onView={(item) => setSelectedMilestoneId(item.id)} />
                 ))}
         </div>
         <MilestoneDetailSheet milestone={selectedMilestone} previewQuery={previewQuery} onClose={() => setSelectedMilestoneId(null)} />
      </div>
   );
}
