import { useMemo, useState } from 'react';

import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type { RootState } from '@/store/store';
import { type Loan, LoanStatus, RepaymentStatus } from '@/types/loanTypes';
import { MILESTONE_ICON_CONFIG, MilestoneDetailSheet, MilestoneHelpSheet } from '@/views/dashboard/components/MilestoneSheets';
import { buildReputationMilestones, type DashboardMilestone, getBorrowerLoans } from '@/views/dashboard/dashboardHelpers';
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
   const summary =
      milestone.status === 'next'
         ? milestone.id === 'first-on-time-repayment'
            ? 'Increase your Trust Score'
            : milestone.reward
         : `${milestone.outcome} · ${milestone.benefit}`;

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
         ) : (
            <span
               className={`flex h-8 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-[8px] px-3 py-2 text-center text-[10px] font-[590] leading-[15px] tracking-[-0.2px] antialiased ${config.labelClass}`}
            >
               {config.label}
               <img src={milestone.status === 'unlocked' ? '/icons/unlocked.svg' : '/icons/locked.svg'} alt="" className="h-4 w-4 invert" />
            </span>
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
      () => buildReputationMilestones({ creditLevels, borrowerLoans, isVerified: user.isWorldId === 'ACTIVE' || isPreview }),
      [borrowerLoans, creditLevels, isPreview, user.isWorldId]
   );
   const nextMilestone = milestones.find((milestone) => milestone.status === 'next') ?? milestones[0];
   const selectedMilestone = milestones.find((milestone) => milestone.id === selectedMilestoneId) ?? null;
   const previewQuery = searchParams.toString();
   const hasUnlockedMilestones = milestones.some((milestone) => milestone.status === 'unlocked');

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
                        Your reputation milestones will appear here as you repay loans on time.
                     </p>
                     <button
                        type="button"
                        onClick={() => navigate('/request-board')}
                        className="mt-8 rounded-[16px] bg-md-primary-900 px-8 py-4 text-[18px] font-medium text-white"
                     >
                        Request a loan
                     </button>
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
         {isHelpOpen && <MilestoneHelpSheet onClose={() => setIsHelpOpen(false)} />}
      </div>
   );
}
