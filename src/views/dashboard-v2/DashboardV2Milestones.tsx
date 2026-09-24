import { Fragment, useState } from 'react';

import clsx from 'clsx';
import { ChevronLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import type { ClaimableVoucher } from '@/lib/friendReferrals';
import { isPreviewHost } from '@/lib/previewHost';
import { DASHBOARD_V2_ASSETS } from '@/views/dashboard-v2/assets';
import { VerifyIdentityBanner } from '@/views/dashboard-v2/components/DashboardV2Banners';
import { MilestonePopup, VerifyPopup } from '@/views/dashboard-v2/components/DashboardV2Popups';
import { VoucherStatusPill } from '@/views/dashboard-v2/components/DashboardV2Sections';
import DesignImage from '@/views/dashboard-v2/components/DesignImage';
import { getVoucherState, OWN_VOUCHER, type VoucherState } from '@/views/dashboard-v2/dashboardV2Model';
import DashboardV2PreviewBar from '@/views/dashboard-v2/DashboardV2Preview';
import { VoucherClaimPopup } from '@/views/dashboard-v2/DashboardV2Rewards';
import type { DashboardV2Milestone } from '@/views/dashboard-v2/types';
import { useDashboardV2Preview } from '@/views/dashboard-v2/useDashboardV2Preview';

const PRIMARY_GRADIENT = 'linear-gradient(77.58deg, #9584ff 0.5%, #6b55f7 98.16%)';
const HIGHLIGHT_GRADIENT = 'linear-gradient(90deg, rgba(255,206,27,0.36) 10.88%, rgba(255,255,255,0) 108.81%)';

function MilestoneRowAction({
   milestone,
   onGet,
   onClaim,
   voucherState
}: {
   milestone: DashboardV2Milestone;
   onGet: () => void;
   onClaim: () => void;
   voucherState: VoucherState;
}) {
   // The database decides voucher eligibility, so its answer wins over the milestone's own status.
   if (milestone.isVoucher && voucherState !== 'none') {
      return <VoucherStatusPill state={voucherState} onClaim={onClaim} />;
   }

   if (milestone.status === 'next') {
      return (
         <button
            type="button"
            onClick={onGet}
            className="flex h-[34px] w-[82px] shrink-0 items-center justify-center rounded-full text-[16px] font-semibold text-white"
            style={{ backgroundImage: PRIMARY_GRADIENT }}
         >
            Get
         </button>
      );
   }

   if (milestone.status === 'unlocked' && milestone.isVoucher) {
      return <VoucherStatusPill state={voucherState} onClaim={onClaim} />;
   }

   if (milestone.status === 'unlocked') {
      return (
         <span className="flex w-[82px] shrink-0 items-center justify-center gap-1 text-[14px] font-semibold text-[#6b55f7]">
            <DesignImage src={DASHBOARD_V2_ASSETS.verified} className="h-4 w-4" />
            Done
         </span>
      );
   }

   return (
      <span className="flex w-[82px] shrink-0 justify-center" aria-label="Locked">
         <DesignImage src={DASHBOARD_V2_ASSETS.lock} className="h-5 w-5" />
      </span>
   );
}

function MilestoneRow({
   milestone,
   onGet,
   onClaim,
   voucherState
}: {
   milestone: DashboardV2Milestone;
   onGet: () => void;
   onClaim: () => void;
   voucherState: VoucherState;
}) {
   const isHighlighted = milestone.isVoucher || milestone.isTopReward;

   return (
      <div
         className={clsx('flex min-h-[70px] items-center justify-between gap-2 py-3.5', isHighlighted ? '-mx-1.5 px-1.5' : '')}
         style={isHighlighted ? { backgroundImage: HIGHLIGHT_GRADIENT } : undefined}
      >
         <div className="flex min-w-0 items-center gap-1">
            <DesignImage
               src={milestone.isVoucher ? DASHBOARD_V2_ASSETS.coupon : DASHBOARD_V2_ASSETS.pandesal}
               className="h-10 w-10 shrink-0 object-contain"
            />
            <div className="min-w-0">
               <p className={clsx('text-[18px] font-medium leading-6', isHighlighted ? 'text-[#833000]' : 'text-[#0f172b]')}>
                  {milestone.title}
               </p>
               <p className="flex flex-wrap items-center gap-1.5 text-[16px] leading-[18px]">
                  <span className={isHighlighted ? 'text-[#f90]' : 'text-[#45556c]'}>Reward: {milestone.reward}</span>
                  {milestone.isTopReward ? (
                     <span className="rounded-[5px] bg-gradient-to-b from-[#ffe27a] to-[#ffc93b] px-1.5 py-px text-[10px] font-bold tracking-[-0.3px] text-[#a04c0f]">
                        Top Reward
                     </span>
                  ) : null}
               </p>
            </div>
         </div>
         <MilestoneRowAction milestone={milestone} onGet={onGet} onClaim={onClaim} voucherState={voucherState} />
      </div>
   );
}

/** Figma "milestone_unverified" / "milestone_verified" — the full reputation milestone list. */
export default function DashboardV2Milestones() {
   const navigate = useNavigate();
   const { model, previewState, isReal, isSignedIn, isReady, language, previewSearch } = useDashboardV2Preview();
   const [openMilestone, setOpenMilestone] = useState<DashboardV2Milestone | null>(null);
   const [isVerifyOpen, setIsVerifyOpen] = useState(false);
   const [claimingVoucher, setClaimingVoucher] = useState<ClaimableVoucher | null>(null);
   const ownVoucher = getVoucherState(model.rewards, OWN_VOUCHER, model.referralLoading);
   const goal = model.pandesalGoal;
   const goalProgress = goal ? Math.min(model.pandesal / goal, 1) : 1;

   return (
      <div className="min-h-screen bg-[#f7f7f7]">
         <div className="mx-auto max-w-[440px] pb-28">
            {isPreviewHost() ? <DashboardV2PreviewBar previewState={previewState} isSignedIn={isSignedIn} language={language} /> : null}

            <header className="relative flex h-16 items-end justify-center px-5 pb-1">
               <Link
                  to={`/dashboard${previewSearch}`}
                  className="absolute bottom-1 left-5 text-[#594d65]"
                  aria-label="Back to dashboard"
               >
                  <ChevronLeft className="h-6 w-6" strokeWidth={2} />
               </Link>
               <h1 className="text-[24px] font-semibold leading-[1.1] tracking-[-0.48px] text-[#594d65]">All Milestones</h1>
            </header>

            {isReal && !isReady ? (
               <div className="mx-5 mt-[58px] flex flex-col gap-3" aria-busy="true" aria-label="Loading milestones">
                  {['m1', 'm2', 'm3', 'm4'].map((id) => (
                     <div key={id} className="h-[70px] animate-pulse rounded-[8px] bg-[#ece9f1]" />
                  ))}
               </div>
            ) : !model.isVerified ? (
               <>
                  <div className="mt-[58px]">
                     <VerifyIdentityBanner onVerify={() => setIsVerifyOpen(true)} />
                  </div>
                  <div className="mx-auto mt-[146px] flex w-[380px] max-w-full flex-col items-center gap-8 text-center">
                     <div className="flex flex-col items-center gap-[5px]">
                        <DesignImage src={DASHBOARD_V2_ASSETS.emptyMoodeng} className="h-[190px] w-[190px] object-contain" />
                        <p className="text-[24px] font-medium leading-6 text-[#0f172b]">No milestones yet</p>
                        <p className="mt-1.5 text-[16px] leading-[18px] text-[#45556c]">Your first one unlocks when you post a request</p>
                     </div>
                     <button
                        type="button"
                        onClick={() => navigate('/request-board')}
                        className="flex h-[46px] w-[308px] max-w-full items-center justify-center rounded-[23px] text-[20px] font-semibold text-white"
                        style={{ backgroundImage: PRIMARY_GRADIENT }}
                     >
                        Request a loan
                     </button>
                  </div>
               </>
            ) : (
               <section className="relative mx-5 mt-[58px]" aria-label="Reputation milestones">
                  <div
                     className="absolute right-0 top-0 h-10 w-[37%] rounded-t-[12px] bg-gradient-to-b from-[#efeaff] to-white"
                     aria-hidden="true"
                  />
                  <div className="relative flex w-[257px] max-w-[60%] flex-col gap-[3px]">
                     <div className="flex items-center justify-between">
                        <p className="flex items-center gap-px text-[16px] font-medium leading-[14px] text-[#7b6b8c]">
                           <DesignImage src={DASHBOARD_V2_ASSETS.pandesalSmall} className="h-5 w-5 object-contain" />
                           Grow Trust with feeding
                        </p>
                        <p className="text-[16px] font-semibold leading-[1.2] text-[#877897]">
                           <span className="text-[#7e6afa]">{model.pandesal}</span>
                           {goal ? `/${goal}` : ''}
                        </p>
                     </div>
                     <div
                        className="h-[7px] w-full rounded-full bg-[#e0dbff]"
                        role="progressbar"
                        aria-valuenow={Math.round(goalProgress * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                     >
                        <div className="h-full rounded-full bg-[#7e6afa]" style={{ width: `${Math.max(goalProgress * 100, 4)}%` }} />
                     </div>
                  </div>
                  <div className="relative mt-3 rounded-[8px] rounded-tr-none bg-white px-1.5 pb-6 pt-2">
                     {model.allMilestones.map((milestone, index) => (
                        <Fragment key={milestone.id}>
                           {index > 0 ? <div className="h-px bg-[#ece9f1]" aria-hidden="true" /> : null}
                           <MilestoneRow
                              milestone={milestone}
                              onGet={() => setOpenMilestone(milestone)}
                              onClaim={() => setClaimingVoucher(ownVoucher.voucher)}
                              voucherState={ownVoucher.state}
                           />
                        </Fragment>
                     ))}
                  </div>
               </section>
            )}
         </div>

         {openMilestone ? (
            <MilestonePopup
               milestone={openMilestone}
               isVerified={model.isVerified}
               onClose={() => setOpenMilestone(null)}
               onVerify={() => setIsVerifyOpen(true)}
            />
         ) : null}
         {claimingVoucher ? (
            <VoucherClaimPopup voucher={claimingVoucher} isPreview={!isReal} onClose={() => setClaimingVoucher(null)} />
         ) : null}
         {isVerifyOpen ? (
            <VerifyPopup onClose={() => setIsVerifyOpen(false)} returnTo={`/dashboard/milestones${previewSearch}`} />
         ) : null}
      </div>
   );
}
