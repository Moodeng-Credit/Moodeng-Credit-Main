import clsx from 'clsx';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useVerifyYourself } from '@/components/verification/VerifyYourselfModal';
import { ConnectWalletBanner, VerifyIdentityBanner, VoucherReferralBanner } from '@/views/dashboard-v2/components/DashboardV2Banners';
import DashboardV2Hero from '@/views/dashboard-v2/components/DashboardV2Hero';
import { LoanSummarySection, MilestonesSection, UpcomingDuesSection } from '@/views/dashboard-v2/components/DashboardV2Sections';
import { SAMPLE_STATES } from '@/views/dashboard-v2/sampleStates';
import type { DashboardV2PreviewState } from '@/views/dashboard-v2/types';
import { useDashboardV2Model } from '@/views/dashboard-v2/useDashboardV2Model';

const PREVIEW_STATES: { id: DashboardV2PreviewState; label: string }[] = [
   { id: 'real', label: 'My data' },
   { id: 'unverified', label: 'Unverified' },
   { id: 'verified', label: 'Verified' },
   { id: 'defaulted', label: 'Defaulted' }
];

const isPreviewState = (value: string | null): value is DashboardV2PreviewState =>
   PREVIEW_STATES.some((state) => state.id === value);

/**
 * Preview of the redesigned borrower dashboard (Figma "New Dashboard for Borrowers").
 * Only routed on dev and *.vercel.app previews. It reads the same data as /dashboard and never writes.
 */
export default function DashboardV2() {
   const navigate = useNavigate();
   const [searchParams, setSearchParams] = useSearchParams();
   const { model: realModel, isSignedIn } = useDashboardV2Model();
   const { open: openVerify, modal: verifyModal } = useVerifyYourself();
   const requestedState = searchParams.get('state');
   const previewState: DashboardV2PreviewState = isPreviewState(requestedState)
      ? requestedState
      : isSignedIn
        ? 'real'
        : 'verified';
   const isReal = previewState === 'real' && isSignedIn;
   const model = isReal ? realModel : SAMPLE_STATES[previewState === 'real' ? 'verified' : previewState];

   const milestonesAndVoucher = (
      <div className="flex flex-col">
         <MilestonesSection model={model} onVerify={openVerify} />
         <div className="-mt-[5px]">
            <VoucherReferralBanner />
         </div>
      </div>
   );

   return (
      <div className="min-h-screen bg-[#f7f7f7]">
         <div className="mx-auto max-w-[440px] pb-28">
            <div className="sticky top-0 z-30 flex items-center gap-2 bg-[#1c053d]/90 px-3 py-2 backdrop-blur">
               <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[#c9bfe6]">Preview</span>
               <div className="flex flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="Dashboard preview state">
                  {PREVIEW_STATES.map((state) => {
                     const isDisabled = state.id === 'real' && !isSignedIn;
                     const isActive = state.id === previewState && !isDisabled;
                     return (
                        <button
                           key={state.id}
                           type="button"
                           role="tab"
                           aria-selected={isActive}
                           disabled={isDisabled}
                           title={isDisabled ? 'Sign in to see your real data' : undefined}
                           onClick={() => setSearchParams({ state: state.id }, { replace: true })}
                           className={clsx(
                              'shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold transition',
                              isActive ? 'bg-white text-[#1c053d]' : 'text-white/80',
                              isDisabled && 'cursor-not-allowed opacity-40'
                           )}
                        >
                           {state.label}
                        </button>
                     );
                  })}
               </div>
            </div>

            <DashboardV2Hero key={previewState} model={model} showRealAvatar={isReal} />

            <div className="mt-[30px] flex flex-col gap-[30px]">
               {!model.isVerified ? <VerifyIdentityBanner onVerify={openVerify} /> : null}
               {model.showConnectWallet ? <ConnectWalletBanner onConnect={() => navigate('/onboarding/wallet')} /> : null}
               {model.hasOverdue ? <UpcomingDuesSection model={model} /> : null}
               {milestonesAndVoucher}
               <LoanSummarySection model={model} />
               {!model.hasOverdue ? <UpcomingDuesSection model={model} /> : null}
            </div>
         </div>
         {verifyModal}
      </div>
   );
}
