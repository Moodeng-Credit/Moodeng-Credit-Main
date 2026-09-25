import { Fragment } from 'react';

import clsx from 'clsx';
import { Link } from 'react-router-dom';

import { formatCurrency } from '@/utils/decimalHelpers';

import { DASHBOARD_V2_ASSETS } from '@/views/dashboard-v2/assets';
import { TabbedCard } from '@/views/dashboard-v2/components/DashboardV2Graphics';
import DesignImage from '@/views/dashboard-v2/components/DesignImage';
import { getVoucherState, OWN_VOUCHER, type VoucherState } from '@/views/dashboard-v2/dashboardV2Model';
import type { DashboardV2Due, DashboardV2Milestone, DashboardV2Model } from '@/views/dashboard-v2/types';

const PILL_BUTTON = 'flex h-[34px] w-[82px] shrink-0 items-center justify-center rounded-full text-[16px] font-semibold leading-6';
const PRIMARY_GRADIENT = 'linear-gradient(85.47deg, #9584ff 0.5%, #6b55f7 98.16%)';
// Design numerals use SF Pro Compressed, which the app does not load; tight tracking approximates it.
const STAT_NUMBER = 'font-medium leading-[18px] tracking-[-0.06em]';

function Divider() {
   return <div className="h-px w-full bg-[#ece9f1]" aria-hidden="true" />;
}

/** Claim / Pending / Sent pill for an earned voucher. */
export function VoucherStatusPill({ state, onClaim }: { state: VoucherState; onClaim: () => void }) {
   if (state === 'claimable') return <ClaimVoucherButton onClaim={onClaim} />;
   if (state === 'loading') return <span className={clsx(PILL_BUTTON, 'animate-pulse bg-[#ece9f1]')} aria-label="Loading voucher" />;
   if (state === 'rejected') {
      return (
         <Link to="/help" className={clsx(PILL_BUTTON, 'bg-[#fde8ea] text-[#d51728]')}>
            Help
         </Link>
      );
   }
   const label = state === 'sent' ? 'Sent' : state === 'pending' ? 'Pending' : 'Done';
   const tone = state === 'sent' || state === 'none' ? 'bg-[#e3f5e8] text-[#2f8a4a]' : 'bg-[#fff4cc] text-[#a06a00]';
   return <span className={clsx(PILL_BUTTON, tone)}>{label}</span>;
}

/** Gold "Claim" pill — same treatment as the "+10Pandesal" pill on the Verify banner. */
export function ClaimVoucherButton({ onClaim }: { onClaim: () => void }) {
   return (
      <button
         type="button"
         onClick={onClaim}
         className="flex h-[34px] w-[82px] shrink-0 items-center justify-center rounded-full bg-[#ffce1b] text-[16px] font-bold tracking-[-0.3px] text-[#704518] shadow-[0_-2px_1px_rgba(255,255,255,0.3),0_2px_1px_rgba(63,89,79,0.4)]"
      >
         Claim
      </button>
   );
}

function MilestoneAction({
   milestone,
   onAction,
   onClaim,
   voucherState
}: {
   milestone: DashboardV2Milestone;
   onAction: (milestone: DashboardV2Milestone) => void;
   onClaim: () => void;
   voucherState: VoucherState;
}) {
   // The database decides voucher eligibility, so its answer wins over the milestone's own status.
   if (milestone.isVoucher && (milestone.status === 'unlocked' || voucherState !== 'none')) {
      return <VoucherStatusPill state={voucherState} onClaim={onClaim} />;
   }

   if (milestone.status === 'unlocked') {
      return <span className={clsx(PILL_BUTTON, 'bg-[#e3f5e8] text-[#2f8a4a]')}>Done</span>;
   }

   if (milestone.status === 'locked') {
      return (
         <span className={clsx(PILL_BUTTON, 'relative overflow-hidden text-white')}>
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
      <button
         type="button"
         onClick={() => onAction(milestone)}
         className={clsx(PILL_BUTTON, 'text-white')}
         style={{ backgroundImage: PRIMARY_GRADIENT }}
      >
         Get
      </button>
   );
}

export function MilestonesSection({
   model,
   allMilestonesHref,
   onGet,
   onClaim
}: {
   model: DashboardV2Model;
   allMilestonesHref: string;
   onGet: (milestone: DashboardV2Milestone) => void;
   onClaim: () => void;
}) {
   const voucherState = getVoucherState(model.rewards, OWN_VOUCHER, model.referralLoading).state;

   return (
      <TabbedCard title="Reputation Milestones" titleId="dv2-milestones-title" tabWidth="37%">
         <div className="relative flex flex-col px-1.5 pb-7 pt-4">
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
                     <MilestoneAction milestone={milestone} onAction={onGet} onClaim={onClaim} voucherState={voucherState} />
                  </div>
               </Fragment>
            ))}
            <Link
               to={allMilestonesHref}
               className="mt-5 flex items-center justify-center gap-0.5 self-center text-[16px] font-semibold leading-[21px] tracking-[-0.32px] text-[#4492f1]"
            >
               View All Milestones
               <DesignImage src={DASHBOARD_V2_ASSETS.viewAllChevron} className="h-3.5 w-3.5" />
            </Link>
         </div>
      </TabbedCard>
   );
}

export function LoanSummarySection({ model }: { model: DashboardV2Model }) {
   const { summary } = model;

   return (
      <TabbedCard
         title="Loan Summary"
         titleId="dv2-loan-summary-title"
         tabWidth="min(56%, calc(100% - 150px))"
         overlapTitle
         tab={
            <p className="flex items-center gap-1 whitespace-nowrap text-[clamp(13px,4vw,16px)] leading-[18px] text-[#45556c]">
               <DesignImage src={DASHBOARD_V2_ASSETS.repayments} className="h-3.5 w-3.5 shrink-0" />
               <span>
                  <span className="text-[#6b55f7]">${formatCurrency(summary.repaymentsTotal).replace(/\.00$/, '')}</span> Repayments
               </span>
            </p>
         }
      >
         <div className="flex items-start justify-between gap-3 px-[9px] pb-6 pt-7">
            <Link
               to="/repay"
               className="group flex min-w-0 flex-1 flex-col gap-[7px] transition-transform duration-150 active:scale-[0.97]"
            >
               <span className="mb-1 flex items-center gap-0.5">
                  <span className={clsx(STAT_NUMBER, 'text-[clamp(28px,8.6vw,38px)] text-[#5c44f1]')}>
                     {formatCurrency(summary.active)}
                  </span>
                  <DesignImage
                     src={DASHBOARD_V2_ASSETS.activeLoanChevron}
                     className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1 group-active:translate-x-1.5"
                  />
               </span>
               <span className="text-[14px] leading-[18px] text-[#45556c]">Active Loans($)</span>
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
               <span className={clsx(STAT_NUMBER, 'text-[clamp(22px,6.4vw,28px)] text-[#594d65]')}>{formatCurrency(summary.pending)}</span>
               <span className="text-[14px] leading-[18px] text-[#45556c]">Pending Loans($)</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
               <span
                  className={clsx(
                     STAT_NUMBER,
                     'text-[clamp(22px,6.4vw,28px)]',
                     summary.defaulted > 0 ? 'text-[#d51728]' : 'text-[#c0b9c8]'
                  )}
               >
                  {formatCurrency(summary.defaulted)}
               </span>
               <span className="text-[14px] leading-[18px] text-[#45556c]">Defaulted($)</span>
            </div>
         </div>
      </TabbedCard>
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
            <span className={clsx('text-[16px] leading-[18px]', due.isOverdue ? 'text-[#ffb8b8]' : 'text-[#c0b9c8]')}>
               Lent by {due.lenderName}
            </span>
         </div>
         {due.isOverdue ? (
            <Link to="/repay" className={clsx(PILL_BUTTON, 'text-white')} style={{ backgroundImage: PRIMARY_GRADIENT }}>
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
            <h2 id="dv2-dues-title" className="whitespace-nowrap text-[clamp(17px,5vw,20px)] font-medium leading-6 text-[#0f172b]">
               Upcoming Loan Dues
            </h2>
            <Link
               to={model.insightsHref}
               className="group flex shrink-0 items-center whitespace-nowrap text-[clamp(15px,4.5vw,18px)] leading-[18px] text-[#45556c] transition duration-150 hover:text-[#4f36ef] active:scale-[0.96]"
            >
               My insights
               <DesignImage
                  src={DASHBOARD_V2_ASSETS.insightsChevron}
                  className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1 group-active:translate-x-1.5"
               />
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

/** "Moodeng grew to Rising!": shown on the dashboard while a tier's GrabFood voucher is waiting to be claimed. */
export function TierVoucherCard({ label, amountPhp, onClaim }: { label: string; amountPhp: number; onClaim: () => void }) {
   return (
      <section
         className="mx-5 flex items-center gap-3 rounded-[8px] px-3 py-3"
         style={{ backgroundImage: 'linear-gradient(90deg, #fff3a3 0%, #ffe27a 100%)' }}
         aria-label={`${label} tier voucher`}
      >
         <DesignImage src={DASHBOARD_V2_ASSETS.coupon} className="h-12 w-12 shrink-0 object-contain" />
         <div className="min-w-0 flex-1">
            <p className="text-[18px] font-black italic leading-6 text-[#3c8248]">Moodeng grew to {label}!</p>
            <p className="text-[14px] font-medium leading-[18px] text-[#6f7d1d]">Claim your ₱{amountPhp} GrabFood voucher</p>
         </div>
         <ClaimVoucherButton onClaim={onClaim} />
      </section>
   );
}
