import { useState } from 'react';

import { useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';

import type { RootState } from '@/store/store';
import { getMilestoneIconConfig, MilestoneDetailSheet } from '@/views/dashboard/components/MilestoneSheets';
import {
   formatMilestoneTrustPoints,
   getDashboardMilestoneHighlights,
   getMilestoneSummary,
   type DashboardMilestone
} from '@/views/dashboard/dashboardHelpers';
import { useMilestonePointAwards } from '@/views/dashboard/useMilestonePointAwards';

interface ReputationMilestonesProps {
   milestones: DashboardMilestone[];
   isLoading?: boolean;
}

function MilestoneIcon({ milestone }: { milestone: Pick<DashboardMilestone, 'id' | 'status'> }) {
   const { icon, bg } = getMilestoneIconConfig(milestone);
   const isLocked = milestone.status === 'locked';
   return (
      <div className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center overflow-hidden rounded-[13px] ${bg ?? ''}`}>
         <img src={icon} alt="" className={`${isLocked ? 'h-5 w-5' : 'h-9 w-9'} object-contain ${isLocked ? 'opacity-60 grayscale' : ''}`} />
      </div>
   );
}

function MilestoneCard({ milestone, onView }: { milestone: DashboardMilestone; onView: (milestone: DashboardMilestone) => void }) {
   const config = getMilestoneIconConfig(milestone);
   const summary = getMilestoneSummary(milestone);
   const showRewardChip = milestone.status !== 'unlocked';

   return (
      <div className="grid min-h-[84px] grid-cols-[46px_minmax(0,1fr)_auto] items-center gap-[12px] rounded-[12px] border border-md-primary-100 bg-md-neutral-200 p-3 antialiased">
         <MilestoneIcon milestone={milestone} />

         <div className="min-w-0">
            {milestone.eyebrow ? (
               <p className="text-[10px] font-normal leading-[15px] tracking-[-0.2px] text-md-neutral-700">{milestone.eyebrow}</p>
            ) : null}
            <p className="truncate text-[16px] font-[510] leading-6 tracking-[-0.32px] text-md-heading">{milestone.title}</p>
            <p className="truncate text-[12px] font-normal leading-[18px] tracking-[-0.24px] text-md-neutral-700">{summary}</p>
            {showRewardChip && (
               <span className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full bg-md-yellow-100 px-2 py-0.5 text-[10.5px] font-[700] tracking-[-0.2px] text-md-yellow-700">
                  {formatMilestoneTrustPoints(milestone)}
               </span>
            )}
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
               <button
                  type="button"
                  onClick={() => onView(milestone)}
                  className={`inline-flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-[8px] px-3 py-2 text-[10px] font-[590] leading-[15px] tracking-[-0.2px] antialiased ${config.labelClass}`}
               >
                  Unlocked
                  <img src="/icons/check-fill.svg" alt="" className="h-4 w-4" />
               </button>
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
      <div className="grid min-h-[84px] grid-cols-[46px_minmax(0,1fr)_auto] items-center gap-[12px] rounded-[12px] border border-md-primary-100 bg-md-neutral-200 p-3">
         <div className="h-[46px] w-[46px] rounded-[13px] bg-md-neutral-500" />
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
   const userId = useSelector((state: RootState) => state.auth.user.id);
   const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
   const [isHelpOpen, setIsHelpOpen] = useState(false);
   const previewQuery = searchParams.toString();
   const milestonesHref = previewQuery ? `/milestones?${previewQuery}` : '/milestones';
   const selectedMilestone = milestones.find((milestone) => milestone.id === selectedMilestoneId) ?? null;
   const isPreview = import.meta.env.DEV && searchParams.get('mockData') === 'rich';
   const visibleMilestones = getDashboardMilestoneHighlights(milestones, 3);

   useMilestonePointAwards({
      userId,
      milestones,
      enabled: !isLoading && !isPreview
   });

   const totalCount = milestones.length;
   const unlockedCount = milestones.filter((milestone) => milestone.status === 'unlocked').length;
   const progressPct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

   return (
      <div className="overflow-hidden rounded-md-lg bg-md-neutral-100 shadow-md-card [font-family:'SF_Pro_Display','SF_Pro',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]">
         <div className="relative overflow-hidden bg-gradient-to-br from-md-primary-900 to-md-primary-1200 p-4 pb-5 text-white">
            <img
               src="/icons/milestones/level-up-hippo.png"
               alt=""
               className="pointer-events-none absolute bottom-[-8px] right-[-4px] w-[104px]"
            />
            <div className="relative z-[1] flex items-start justify-between gap-3" data-tour-target="dashboard-milestones-heading">
               <div className="flex items-center gap-2">
                  <h2 className="text-[18px] font-[590] leading-[1.2] tracking-[-0.72px] text-white">Reputation Milestones</h2>
                  <button
                     type="button"
                     onClick={() => setIsHelpOpen(true)}
                     className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15"
                     aria-label="How milestones work"
                  >
                     <img src="/icons/question_light.svg" alt="" className="h-4 w-4 brightness-0 invert" />
                  </button>
                  {isHelpOpen && (
                     <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsHelpOpen(false)} />
                        <div
                           role="tooltip"
                           className="absolute left-0 top-8 z-20 w-[300px] rounded-[10px] bg-[#360975] px-3 py-2 shadow-[0_8px_24px_rgba(20,18,24,0.18)] before:absolute before:left-[202px] before:top-[-6px] before:h-0 before:w-0 before:border-x-[6px] before:border-b-[6px] before:border-x-transparent before:border-b-[#360975]"
                        >
                           <p className="text-center text-[14px] font-normal leading-[21px] tracking-[-0.28px] text-[#f1e9fd]">
                              Milestones show what to do next to build trust with lenders.
                           </p>
                        </div>
                     </>
                  )}
               </div>
               <Link
                  to={milestonesHref}
                  className="shrink-0 whitespace-nowrap rounded-full bg-white/18 px-3 py-1.5 text-[11.5px] font-[700] tracking-[-0.2px] text-white"
               >
                  View all &#8250;
               </Link>
            </div>
            <p className="relative z-[1] mt-1 max-w-[62%] text-[12.5px] leading-[1.4] text-md-primary-100">
               Complete milestones to unlock higher loan levels.
            </p>
            <div className="relative z-[1] mt-3 pr-[112px]">
               <p className="mb-1.5 text-[11.5px] font-[700] tracking-[-0.2px] text-white">
                  {unlockedCount} of {totalCount} complete
               </p>
               <div className="h-2 overflow-hidden rounded-full bg-white/28">
                  <div className="h-full rounded-full bg-md-yellow-700 transition-[width]" style={{ width: `${progressPct}%` }} />
               </div>
            </div>
         </div>

         <div className="p-4 pt-3">
            <div className="flex flex-col gap-2">
               {isLoading
                  ? [0, 1, 2].map((item) => <MilestoneSkeletonCard key={item} />)
                  : visibleMilestones.map((milestone) => (
                       <MilestoneCard key={milestone.id} milestone={milestone} onView={(item) => setSelectedMilestoneId(item.id)} />
                    ))}
            </div>
         </div>
         <MilestoneDetailSheet milestone={selectedMilestone} previewQuery={previewQuery} onClose={() => setSelectedMilestoneId(null)} />
      </div>
   );
}
