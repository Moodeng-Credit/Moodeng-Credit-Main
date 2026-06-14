import { useCallback, useEffect } from 'react';

import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import WorldIDVerifyChoice from '@/components/worldId/WorldIDVerifyChoice';

import { isWorldIdVerified } from '@/lib/isWorldIdVerified';
import type { RootState } from '@/store/store';

export default function WorldIdVerification() {
   const navigate = useNavigate();
   const location = useLocation();
   const user = useSelector((state: RootState) => state.auth.user);
   const isPreview = import.meta.env.DEV && location.pathname.includes('preview');
   const returnTo =
      (location.state as { returnTo?: string } | null)?.returnTo || new URLSearchParams(location.search).get('returnTo') || undefined;
   const shouldShowInlineSuccess = Boolean(returnTo);

   const handleVerified = useCallback(() => {
      if (!isPreview && returnTo === 'loan-request') {
         navigate('/request-board', { replace: true, state: { openLoanRequest: true } });
         return;
      }
      if (!isPreview && returnTo === 'account-settings') {
         navigate('/account/settings', { replace: true });
         return;
      }
      if (!isPreview && returnTo === 'repay') {
         navigate('/repay', { replace: true });
         return;
      }
      if (!isPreview && returnTo === 'milestones') {
         navigate('/milestones', { replace: true });
         return;
      }
      if (!isPreview && returnTo === 'dashboard-credit-level') {
         navigate('/dashboard', { replace: true });
         return;
      }
      navigate(isPreview ? '/onboarding/congratulations-preview' : '/onboarding/congratulations', { replace: true });
   }, [isPreview, returnTo, navigate]);

   useEffect(() => {
      if (isWorldIdVerified(user)) {
         handleVerified();
      }
   }, [user, handleVerified]);

   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f] flex flex-col items-center justify-center max-w-modal mx-auto w-full px-md-4 py-md-5">
         <div className="flex flex-col items-center gap-md-3 text-center w-full">
            <img src="/hippos/hippo-with-id-card.png" alt="" aria-hidden="true" className="w-40" />
            <div className="flex flex-col gap-md-1">
               <h1 className="text-md-display text-md-heading">Verify You&rsquo;re Human</h1>
               <p className="text-md-b1 font-medium text-md-neutral-700">
                  Prove you&rsquo;re a real person with World ID. This is a one-time step.
               </p>
            </div>

            <WorldIDVerifyChoice
               onSuccess={handleVerified}
               showSuccessFeedback={shouldShowInlineSuccess}
               showSuccessToast={shouldShowInlineSuccess}
            >
               {({ open }) => (
                  <button
                     type="button"
                     onClick={isPreview ? handleVerified : open}
                     className="flex w-full items-center justify-center gap-md-1 rounded-md-lg bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100"
                  >
                     Verify with World ID
                  </button>
               )}
            </WorldIDVerifyChoice>
         </div>
      </div>
   );
}
