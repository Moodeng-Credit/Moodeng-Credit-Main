import { Fragment } from 'react';

import clsx from 'clsx';
import { Link, useNavigate } from 'react-router-dom';

import { formatCurrency } from '@/utils/decimalHelpers';
import { DASHBOARD_V2_ASSETS } from '@/views/dashboard-v2/assets';
import DesignImage from '@/views/dashboard-v2/components/DesignImage';
import type { DashboardV2Due, DashboardV2Milestone, DashboardV2Model } from '@/views/dashboard-v2/types';

const SECTION_TITLE = 'text-[22px] font-black italic leading-[18px] text-[#594d65]';
const PILL_BUTTON = 'flex h-[34px] w-[82px] shrink-0 items-center justify-center rounded-full text-[16px] font-semibold leading-6 text-white';
const PRIMARY_GRADIENT = 'linear-gradient(85.47deg, #9584ff 0.5%, #6b55f7 98.16%)';
// Design numerals use SF Pro Compressed, which the app does not load; tight tracking approximates it.
const STAT_NUMBER = 'font-medium leading-[18px] tracking-[-0.06em]';

function Divider() {
   return <div className="h-px w-full bg-[#ece9f1]" aria-hidden="true" />;
}

function MilestoneAction({ milestone, onAction }: { milestone: DashboardV2Milestone; onAction: (milestone: DashboardV2Milestone) => void }) {
   if (milestone.status === 'unlocked') {
      return <span className={clsx(PILL_BUTTON, 'bg-[#e3f5e8] text-[#2f8a4a]')}>Done</span>;
   }

   if (milestone.status === 'locked') {
      return (
         <span className={clsx(PILL_BUTTON, 'relative overflow-hidden')}>
            <span
               className="absolute inset-0"
               style={{ backgroundImage: 'linear-gradient(85.47deg, #b9aeff 0.5%, #8b7afa 57.57%, #6b55f7 98.16%)' }}
               aria-hidden="true"
            />
            <span className="absolute inset-0 bg-white/80 mix-blend-color" aria-hidden="true" />
            <span className="relative">Locked</span>
         </span>
      );
   }

   return (
      <button type="button" onClick={() => onAction(milestone)} className={PILL_BUTTON} style={{ backgroundImage: PRIMARY_GRADIENT }}>
         Get
      </button>
   );
}

export function MilestonesSection({ model, onVerify }: { model: DashboardV2Model; onVerify: () => void }) {
   const navigate = useNavigate();
   const handleAction = (milestone: DashboardV2Milestone) => {
      if (!model.isVerified) {
         onVerify();
         return;
      }
      navigate(milestone.actionTo ?? '/request-board');
   };

   return (
      <section className="mx-5 flex flex-col" aria-labelledby="dv2-milestones-title">
         <h2 id="dv2-milestones-title" className={SECTION_TITLE}>
            Reputation Milestones
         </h2>
         <div className="relative h-[300px]">
            <DesignImage src={DASHBOARD_V2_ASSETS.milestonesCard} className="absolute inset-0 h-full w-full" />
            <div className="relative flex flex-col px-1.5 pt-[25px]">
               {model.milestones.map((milestone, index) => (
                  <Fragment key={milestone.id}>
                     {index > 0 ? <Divider /> : null}
                     <div
                        className={clsx(
                           'flex items-center justify-between gap-1',
                           index > 0 && 'py-[14px]',
                           index === 0 && 'pb-[14px]',
                           milestone.isVoucher && '-mx-1.5 px-1.5'
                        )}
                        style={
                           milestone.isVoucher
                              ? { backgroundImage: 'linear-gradient(90deg, rgba(255,206,27,0.36) 10.88%, rgba(255,255,255,0) 108.81%)' }
                              : undefined
                        }
                     >
                        <div className="flex min-w-0 items-center gap-1">
                           <DesignImage
                              src={milestone.isVoucher ? DASHBOARD_V2_ASSETS.coupon : DASHBOARD_V2_ASSETS.pandesal}
                              className="h-10 w-10 shrink-0 object-contain"
                           />
                           <div className="min-w-0">
                              <p
                                 className={clsx(
                                    'font-medium leading-6',
                                    index === 0 ? 'text-[20px]' : 'text-[18px]',
                                    milestone.isVoucher ? 'text-[#833000]' : 'text-[#0f172b]'
                                 )}
                              >
                                 {milestone.title}
                              </p>
                              <p className={clsx('text-[16px] leading-[18px]', milestone.isVoucher ? 'text-[#f90]' : 'text-[#45556c]')}>
                                 Reward: {milestone.reward}
                              </p>
                           </div>
                        </div>
                        <MilestoneAction milestone={milestone} onAction={handleAction} />
                     </div>
                  </Fragment>
               ))}
               <Link
                  to="/milestones"
                  className="mt-5 flex items-center justify-center gap-0.5 self-center text-[16px] font-semibold leading-[21px] tracking-[-0.32px] text-[#4492f1]"
               >
                  View All Milestones
                  <DesignImage src={DASHBOARD_V2_ASSETS.viewAllChevron} className="h-3.5 w-3.5" />
               </Link>
            </div>
         </div>
      </section>
   );
}

export function LoanSummarySection({ model }: { model: DashboardV2Model }) {
   const { summary } = model;

   return (
      <section className="relative mx-5 h-[123px]" aria-labelledby="dv2-loan-summary-title">
         <DesignImage src={DASHBOARD_V2_ASSETS.loanSummaryCard} className="absolute inset-0 h-full w-full" />
         <h2 id="dv2-loan-summary-title" className={clsx(SECTION_TITLE, 'relative')}>
            Loan Summary
         </h2>
         <p className="absolute left-[186px] top-1.5 flex items-center gap-1 text-[16px] leading-[18px] text-[#45556c]">
            <DesignImage src={DASHBOARD_V2_ASSETS.repayments} className="h-3.5 w-3.5" />
            <span>
               <span className="text-[#6b55f7]">${formatCurrency(summary.repaymentsTotal).replace(/\.00$/, '')}</span> Repayments
            </span>
         </p>
         <div className="absolute left-[9px] right-2 top-14 flex items-center gap-[34px]">
            <Link to="/repay" className="flex w-[105px] flex-col gap-[7px]">
               <span className="flex items-center gap-0.5">
                  <span className={clsx(STAT_NUMBER, 'text-[38px] text-[#5c44f1]')}>{formatCurrency(summary.active)}</span>
                  <DesignImage src={DASHBOARD_V2_ASSETS.activeLoanChevron} className="h-4 w-4" />
               </span>
               <span className="text-[14px] leading-[18px] text-[#45556c]">Active Loans($)</span>
            </Link>
            <div className="flex w-[117px] flex-col gap-[7px]">
               <span className={clsx(STAT_NUMBER, 'text-[28px] text-[#594d65]')}>{formatCurrency(summary.pending)}</span>
               <span className="text-[14px] leading-[18px] text-[#45556c]">Pending Loans($)</span>
            </div>
            <div className="flex w-[110px] flex-col gap-[7px]">
               <span className={clsx(STAT_NUMBER, 'text-[28px]', summary.defaulted > 0 ? 'text-[#d51728]' : 'text-[#c0b9c8]')}>
                  {formatCurrency(summary.defaulted)}
               </span>
               <span className="text-[14px] leading-[18px] text-[#45556c]">Defaulted($)</span>
            </div>
         </div>
      </section>
   );
}

const formatDueLabel = (due: DashboardV2Due) => {
   if (due.daysRemaining < 0) return `Overdue ${-due.daysRemaining} ${due.daysRemaining === -1 ? 'day' : 'days'}`;
   if (due.daysRemaining === 0) return 'Due today';
   return `Due in ${due.daysRemaining} ${due.daysRemaining === 1 ? 'day' : 'days'}`;
};

function DueRow({ due }: { due: DashboardV2Due }) {
   return (
      <div
         className={clsx('flex items-center justify-between py-3', due.isOverdue && '-mx-2.5 px-2.5')}
         style={due.isOverdue ? { backgroundImage: 'linear-gradient(90deg, #ff5b6b 0%, #ff8e98 55%, #ffe3e6 100%)' } : undefined}
      >
         <div className="flex flex-col">
            <div className="flex items-center gap-0.5">
               <span className={clsx('text-[18px] font-bold leading-6', due.isOverdue ? 'text-white' : 'text-[#0f172b]')}>
                  ${formatCurrency(due.amount)}
               </span>
               <span
                  className={clsx(
                     'flex h-[22px] items-center justify-center rounded-[11px] px-[9px] text-[16px] leading-[18px]',
                     due.isOverdue ? 'bg-[#d51728] text-white' : 'bg-[#e0dbff] text-[#5640e0]'
                  )}
               >
                  {formatDueLabel(due)}
               </span>
            </div>
            <span className={clsx('text-[16px] leading-[18px]', due.isOverdue ? 'text-[#ffb8b8]' : 'text-[#c0b9c8]')}>Lent by {due.lenderName}</span>
         </div>
         {due.isOverdue ? (
            <Link to="/repay" className={PILL_BUTTON} style={{ backgroundImage: PRIMARY_GRADIENT }}>
               Pay Now
            </Link>
         ) : null}
      </div>
   );
}

export function UpcomingDuesSection({ model }: { model: DashboardV2Model }) {
   return (
      <section className="mx-5 rounded-[8px] bg-white px-2.5 pb-3.5 pt-5" aria-labelledby="dv2-dues-title">
         <div className="flex items-center justify-between">
            <h2 id="dv2-dues-title" className="text-[20px] font-medium leading-6 text-[#0f172b]">
               Upcoming Loan Dues
            </h2>
            <Link to={model.insightsHref} className="flex items-center text-[18px] leading-[18px] text-[#45556c]">
               My insights
               <DesignImage src={DASHBOARD_V2_ASSETS.insightsChevron} className="h-4 w-4" />
            </Link>
         </div>
         <div className="mt-4">
            <Divider />
         </div>
         {model.dues.length === 0 ? (
            <p className="pt-4 text-center text-[14px] font-medium leading-[21px] tracking-[-0.28px] text-[#877897]">No Active Loans</p>
         ) : (
            model.dues.map((due, index) => (
               <Fragment key={due.id}>
                  {index > 0 ? <Divider /> : null}
                  <DueRow due={due} />
               </Fragment>
            ))
         )}
      </section>
   );
}
