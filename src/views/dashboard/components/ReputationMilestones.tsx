import { Award, Check, Lock, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { DashboardMilestone } from '@/views/dashboard/dashboardHelpers';

interface ReputationMilestonesProps {
   milestones: DashboardMilestone[];
}

const STATUS_STYLES: Record<DashboardMilestone['status'], { iconClass: string; icon: typeof Star; badgeClass: string; label: string }> = {
   next: {
      icon: Star,
      iconClass: 'bg-md-primary-900 text-white',
      badgeClass: 'bg-md-primary-100 text-md-primary-900',
      label: 'Next'
   },
   unlocked: {
      icon: Check,
      iconClass: 'bg-md-green-700 text-white',
      badgeClass: 'bg-md-green-100 text-md-green-900',
      label: 'Unlocked'
   },
   locked: {
      icon: Lock,
      iconClass: 'bg-md-neutral-800 text-white',
      badgeClass: 'bg-md-neutral-300 text-md-neutral-1400',
      label: 'Locked'
   }
};

function MilestoneCard({ milestone }: { milestone: DashboardMilestone }) {
   const status = STATUS_STYLES[milestone.status];
   const Icon = status.icon;

   return (
      <article className="flex gap-md-3 rounded-[16px] border border-[#eadfff] bg-[#fbf8ff] p-md-3">
         <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${status.iconClass}`}>
            <Icon className="h-5 w-5" strokeWidth={2.4} />
         </span>
         <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-md-1">
               <p className="text-md-b4 font-semibold uppercase text-md-neutral-1200">{milestone.eyebrow}</p>
               <span className={`rounded-md-pill px-md-1 py-[2px] text-[9px] font-semibold uppercase leading-none ${status.badgeClass}`}>
                  {status.label}
               </span>
            </div>
            <p className="text-md-b2 font-semibold text-md-heading">{milestone.title}</p>
            <p className="mt-1 text-md-b3 text-md-neutral-1200">{milestone.description}</p>
            {milestone.actionLabel && milestone.actionTo ? (
               <Link
                  className="mt-md-2 inline-flex rounded-md-md bg-md-primary-900 px-md-2 py-2 text-md-b3 font-semibold text-white"
                  to={milestone.actionTo}
               >
                  {milestone.actionLabel}
               </Link>
            ) : null}
         </div>
      </article>
   );
}

export default function ReputationMilestones({ milestones }: ReputationMilestonesProps) {
   return (
      <section className="rounded-md-lg bg-white p-md-4 shadow-md-card">
         <div className="mb-md-1 flex items-center justify-between gap-md-2">
            <div className="flex min-w-0 items-center gap-md-1">
               <Award className="h-5 w-5 shrink-0 text-md-primary-900" strokeWidth={2.2} />
               <h2 className="truncate text-md-h5 font-semibold text-md-heading">Reputation Milestones</h2>
            </div>
            <Link className="shrink-0 text-md-b3 font-semibold text-md-blue-600 underline" to="/milestones">
               View all
            </Link>
         </div>
         <p className="mb-md-3 text-md-b3 text-md-neutral-1200">Complete milestones to unlock higher loan levels.</p>
         <div className="flex flex-col gap-md-2">
            {milestones.slice(0, 3).map((milestone) => (
               <MilestoneCard key={milestone.id} milestone={milestone} />
            ))}
         </div>
      </section>
   );
}
