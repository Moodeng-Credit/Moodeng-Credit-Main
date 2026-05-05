import { useMemo, useState } from 'react';

import { Award, Check, HelpCircle, Lock, Star } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import SwipeableBottomSheet from '@/components/ui/SwipeableBottomSheet';

import type { RootState } from '@/store/store';
import { WorldId } from '@/types/authTypes';
import DashboardHeader from '@/views/dashboard/components/DashboardHeader';
import {
   buildReputationMilestones,
   buildTrustMilestones,
   type DashboardMilestone,
   getBorrowerLoans
} from '@/views/dashboard/dashboardHelpers';
import { useDashboardData } from '@/views/profile/components/tabs/useDashboardData';

const STATUS_CONFIG: Record<DashboardMilestone['status'], { icon: typeof Star; iconClass: string; cardClass: string; label: string }> = {
   next: {
      icon: Star,
      iconClass: 'bg-md-primary-900 text-white',
      cardClass: 'border-md-primary-300 bg-[#fbf8ff]',
      label: 'Next'
   },
   unlocked: {
      icon: Check,
      iconClass: 'bg-md-green-700 text-white',
      cardClass: 'border-[#bfe8cf] bg-[#f5fff9]',
      label: 'Unlocked'
   },
   locked: {
      icon: Lock,
      iconClass: 'bg-md-neutral-800 text-white',
      cardClass: 'border-md-neutral-300 bg-white',
      label: 'Locked'
   }
};

function MilestoneCard({ milestone }: { milestone: DashboardMilestone }) {
   const config = STATUS_CONFIG[milestone.status];
   const Icon = config.icon;

   return (
      <article className={`rounded-[18px] border p-md-3 ${config.cardClass}`}>
         <div className="flex gap-md-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${config.iconClass}`}>
               <Icon className="h-5 w-5" strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1">
               <div className="mb-1 flex items-center gap-md-1">
                  <span className="text-md-b4 font-semibold uppercase text-md-neutral-1200">{milestone.eyebrow}</span>
                  <span className="rounded-md-pill bg-white px-md-1 py-[2px] text-[9px] font-semibold uppercase text-md-primary-900">
                     {config.label}
                  </span>
               </div>
               <p className="text-md-b1 font-semibold text-md-heading">{milestone.title}</p>
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
         </div>
      </article>
   );
}

function MilestoneGroup({
   title,
   description,
   icon,
   milestones
}: {
   title: string;
   description: string;
   icon: 'award' | 'trust';
   milestones: DashboardMilestone[];
}) {
   const Icon = icon === 'award' ? Award : HelpCircle;

   return (
      <section className="rounded-md-lg bg-white p-md-4 shadow-md-card">
         <div className="mb-md-3 flex items-start gap-md-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eadfff] text-md-primary-900">
               <Icon className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div>
               <h2 className="text-md-h5 font-semibold text-md-heading">{title}</h2>
               <p className="mt-1 text-md-b3 text-md-neutral-1200">{description}</p>
            </div>
         </div>
         <div className="flex flex-col gap-md-2">
            {milestones.map((milestone) => (
               <MilestoneCard key={milestone.id} milestone={milestone} />
            ))}
         </div>
      </section>
   );
}

export default function Milestones() {
   const user = useSelector((state: RootState) => state.auth.user);
   const loans = useSelector((state: RootState) => state.loans.loans.gloans || []);
   const { creditLevels } = useDashboardData('borrower');
   const [isSheetOpen, setIsSheetOpen] = useState(false);
   const isVerified = user.isWorldId === WorldId.ACTIVE;
   const borrowerLoans = useMemo(() => getBorrowerLoans(loans, user.id), [loans, user.id]);
   const reputationMilestones = useMemo(
      () => buildReputationMilestones({ creditLevels, borrowerLoans, isVerified }),
      [borrowerLoans, creditLevels, isVerified]
   );
   const trustMilestones = useMemo(() => buildTrustMilestones({ user, borrowerLoans, isVerified }), [borrowerLoans, isVerified, user]);

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <main className="mx-auto flex max-w-[440px] flex-col gap-md-5 px-md-4 pb-32 pt-md-3">
            <DashboardHeader title="Milestones" />
            <section className="rounded-md-lg bg-gradient-to-b from-white to-[#f1e9fd] p-md-4 shadow-md-card">
               <div className="flex items-start justify-between gap-md-3">
                  <div>
                     <p className="text-md-b4 font-semibold uppercase text-md-primary-900">Borrower progress</p>
                     <h1 className="mt-1 text-md-h4 font-semibold text-md-heading">Build your borrowing reputation</h1>
                     <p className="mt-md-2 text-md-b2 text-md-neutral-1200">
                        These milestones explain what has already unlocked and what needs to happen next.
                     </p>
                  </div>
                  <button
                     aria-label="Open milestone explanation"
                     className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-md-primary-900 shadow-md-card"
                     type="button"
                     onClick={() => setIsSheetOpen(true)}
                  >
                     <HelpCircle className="h-5 w-5" strokeWidth={2.2} />
                  </button>
               </div>
            </section>

            <MilestoneGroup
               description="Loan-limit and repayment achievements that unlock higher borrowing power."
               icon="award"
               milestones={reputationMilestones}
               title="Reputation milestones"
            />
            <MilestoneGroup
               description="The trust-building steps behind the borrower profile lenders inspect."
               icon="trust"
               milestones={trustMilestones}
               title="Trust building milestones"
            />
         </main>

         <SwipeableBottomSheet
            isOpen={isSheetOpen}
            title="How milestones work"
            description="Milestones turn borrower behavior into clear next steps."
            onClose={() => setIsSheetOpen(false)}
         >
            <div className="space-y-md-3 text-md-b1 text-md-neutral-1400">
               <p>Unlocked milestones are already part of the borrower’s reputation.</p>
               <p>Next milestones are the most useful action to focus on now.</p>
               <p>Locked milestones explain what will become available later as the borrower builds more history.</p>
            </div>
         </SwipeableBottomSheet>
      </div>
   );
}
