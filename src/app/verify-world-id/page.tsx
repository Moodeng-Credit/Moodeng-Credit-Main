import { useCallback, useEffect } from 'react';

import { FileText } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { SUPPORTED_DIDIT_COUNTRIES } from '@/components/verification/CountryFlags';
import { WorldIdOrb } from '@/components/verification/VerifyYourselfModal';
import { isUserVerified } from '@/lib/isUserVerified';
import type { RootState } from '@/store/store';

export default function WorldIdVerification() {
   const navigate = useNavigate();
   const location = useLocation();
   const user = useSelector((state: RootState) => state.auth.user);
   const isPreview = import.meta.env.DEV && location.pathname.includes('preview');
   const returnTo =
      (location.state as { returnTo?: string } | null)?.returnTo || new URLSearchParams(location.search).get('returnTo') || undefined;

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
      if (isUserVerified(user)) {
         handleVerified();
      }
   }, [user, handleVerified]);

   // Both options run the shared liveness check first, then the chosen method (handled by /verify).
   const startVerification = useCallback(
      (method: 'worldid' | 'didit') => {
         if (isPreview) {
            handleVerified();
            return;
         }
         navigate('/verify', { state: { method, returnTo } });
      },
      [handleVerified, isPreview, navigate, returnTo]
   );

   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f] flex flex-col items-center justify-center max-w-modal mx-auto w-full px-md-4 py-md-5">
         <div className="flex flex-col items-center gap-md-4 w-full">
            <div className="flex flex-col items-center gap-md-1 text-center">
               <img src="/hippos/hippo-with-id-card.png" alt="" aria-hidden="true" className="w-28" />
               <h1 className="text-md-h3 font-semibold text-md-heading">Verify Your Identity</h1>
               <p className="text-md-b2 font-medium text-md-neutral-700">
                  To keep Moodeng safe and prevent fake or duplicate accounts, borrowers complete a short
                  one-time identity check.
               </p>
            </div>

            {/* Primary, recommended path: national ID + selfie check via Didit. */}
            <button
               type="button"
               onClick={() => startVerification('didit')}
               className="w-full text-left rounded-md-lg border-2 border-md-primary-1200 bg-md-primary-100 p-4 flex items-center gap-3 transition-all duration-150 active:scale-[0.99]"
            >
               <div className="shrink-0 w-10 h-10 rounded-md-md flex items-center justify-center bg-md-primary-1200 text-md-neutral-100">
                  <FileText size={20} />
               </div>
               <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                     <span className="text-md-b1 font-semibold text-md-primary-1200">Verify Your ID</span>
                     <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-md-primary-1200 text-md-neutral-100">
                        Recommended
                     </span>
                  </div>
                  <p className="text-md-b3 text-md-neutral-1000 mt-0.5 leading-snug">
                     Quick national ID &amp; selfie check — available in select countries.
                  </p>
               </div>
            </button>

            {/* Supported countries for the recommended path */}
            <div className="flex flex-col gap-3 w-full">
               <p className="text-md-b3 font-semibold uppercase tracking-[0.08em] text-md-neutral-700 text-center">
                  Supported countries
               </p>
               <div className="grid grid-cols-2 gap-y-3 gap-x-6 w-fit mx-auto">
                  {SUPPORTED_DIDIT_COUNTRIES.map(({ code, name, Flag }) => (
                     <div key={code} className="flex items-center gap-3">
                        <div className="shrink-0 overflow-hidden rounded-[3px] shadow-sm shadow-black/10">
                           <Flag className="w-[30px] h-5 block" />
                        </div>
                        <span className="text-md-b2 font-medium text-md-heading">{name}</span>
                     </div>
                  ))}
               </div>
            </div>

            {/* Secondary, de-emphasised path: World ID (Orb/passport). A quiet labeled row so
                a supported-country user doesn't tap it by accident; still goes into the World
                ID flow for anyone outside the supported countries. */}
            <div className="flex flex-col gap-1.5 w-full border-t border-md-neutral-300 pt-md-3">
               <p className="text-md-b3 text-md-neutral-700">Not in a supported country?</p>
               <button
                  type="button"
                  onClick={() => startVerification('worldid')}
                  className="w-full rounded-md-lg border border-md-neutral-300 p-3.5 flex items-center gap-3 text-left transition-colors hover:bg-md-neutral-200 active:scale-[0.99]"
               >
                  <div className="shrink-0 w-10 h-10 rounded-md-md flex items-center justify-center bg-md-neutral-200 text-md-neutral-700">
                     <WorldIdOrb size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                     <span className="text-md-b1 font-semibold text-md-heading">Verify with World ID</span>
                     <p className="text-md-b3 text-md-neutral-1000 mt-0.5 leading-snug">
                        For World App users — verified at an Orb or with a passport.
                     </p>
                  </div>
               </button>
            </div>
         </div>
      </div>
   );
}
