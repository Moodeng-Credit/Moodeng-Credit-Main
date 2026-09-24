import { useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { ConnectWalletBanner, VerifyIdentityBanner, VoucherReferralBanner } from '@/views/dashboard-v2/components/DashboardV2Banners';
import DashboardV2Hero from '@/views/dashboard-v2/components/DashboardV2Hero';
import { MilestonePopup, VerifyPopup } from '@/views/dashboard-v2/components/DashboardV2Popups';
import { LoanSummarySection, MilestonesSection, UpcomingDuesSection } from '@/views/dashboard-v2/components/DashboardV2Sections';
import DashboardV2PreviewBar from '@/views/dashboard-v2/DashboardV2Preview';
import { VoucherClaimPopup } from '@/views/dashboard-v2/DashboardV2Rewards';
import type { DashboardV2Milestone } from '@/views/dashboard-v2/types';
import { useDashboardV2Preview } from '@/views/dashboard-v2/useDashboardV2Preview';

const SKELETON_BLOCKS = [
   { id: 'banner', height: 64 },
   { id: 'milestones', height: 300 },
   { id: 'voucher', height: 81 },
   { id: 'summary', height: 123 },
   { id: 'dues', height: 113 }
];

/** Loading state: the sections keep their shape so the page doesn't jump when data lands. */
function DashboardV2Skeleton() {
   return (
      <div className="mt-[30px] flex flex-col gap-[30px] px-5" aria-busy="true" aria-label="Loading your dashboard">
         {SKELETON_BLOCKS.map(({ id, height }) => (
            <div key={id} className="animate-pulse rounded-[8px] bg-[#ece9f1]" style={{ height }} />
         ))}
      </div>
   );
}

/**
 * Preview of the redesigned borrower dashboard (Figma "New Dashboard for Borrowers").
 * Only routed on dev and *.vercel.app previews. It reads the same data as /dashboard and never writes.
 */
export default function DashboardV2() {
   const navigate = useNavigate();
   const { model, previewState, isReal, isSignedIn, isReady, language, previewSearch } = useDashboardV2Preview();
   const [openMilestone, setOpenMilestone] = useState<DashboardV2Milestone | null>(null);
   const [isVerifyOpen, setIsVerifyOpen] = useState(false);
   const [isVoucherOpen, setIsVoucherOpen] = useState(false);
   const isLoading = isReal && !isReady;

   const milestonesAndVoucher = (
      <div className="flex flex-col">
         <MilestonesSection
            model={model}
            allMilestonesHref={`/dashboard-v2-preview/milestones${previewSearch}`}
            onGet={setOpenMilestone}
            onClaim={() => setIsVoucherOpen(true)}
         />
         <div className="-mt-[5px]">
            <VoucherReferralBanner language={language} onRefer={() => navigate(`/dashboard-v2-preview/refer${previewSearch}`)} />
         </div>
      </div>
   );

   return (
      <div className="min-h-screen bg-[#f7f7f7]">
         <div className="mx-auto max-w-[440px] pb-28">
            <DashboardV2PreviewBar previewState={previewState} isSignedIn={isSignedIn} language={language} />

            <DashboardV2Hero key={previewState} model={model} showRealAvatar={isReal} />

            {isLoading ? (
               <DashboardV2Skeleton />
            ) : (
               <div className="mt-[30px] flex flex-col gap-[30px]">
                  {!model.isVerified ? <VerifyIdentityBanner onVerify={() => setIsVerifyOpen(true)} /> : null}
                  {model.showConnectWallet ? <ConnectWalletBanner onConnect={() => navigate('/onboarding/wallet')} /> : null}
                  {model.hasOverdue ? <UpcomingDuesSection model={model} /> : null}
                  {milestonesAndVoucher}
                  <LoanSummarySection model={model} />
                  {!model.hasOverdue ? <UpcomingDuesSection model={model} /> : null}
               </div>
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
         {isVerifyOpen ? <VerifyPopup onClose={() => setIsVerifyOpen(false)} returnTo="/dashboard-v2-preview" /> : null}
         {isVoucherOpen ? <VoucherClaimPopup onClose={() => setIsVoucherOpen(false)} /> : null}
      </div>
   );
}
