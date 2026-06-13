import { useCallback, useEffect, useRef, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { SUPPORTED_DIDIT_COUNTRIES } from '@/components/verification/CountryFlags';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { WorldId } from '@/types/authTypes';

const STATUS_REFRESH_RETRIES = 40;
const STATUS_REFRESH_DELAY_MS = 3000;
const PENDING_FLAG_KEY = 'didit_verification_pending';

const wait = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });

type PageState = 'idle' | 'starting' | 'polling' | 'waiting' | 'success' | 'error';

export default function DiditVerification() {
   const navigate = useNavigate();
   const location = useLocation();
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);

   const isPreview = import.meta.env.DEV && location.pathname.includes('preview');
   const returnTo =
      (location.state as { returnTo?: string } | null)?.returnTo ||
      new URLSearchParams(location.search).get('returnTo') ||
      undefined;

   const [pageState, setPageState] = useState<PageState>('idle');
   const [errorMessage, setErrorMessage] = useState('');
   const pollCancelRef = useRef(false);

   const handleVerified = useCallback(() => {
      window.sessionStorage.removeItem(PENDING_FLAG_KEY);
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

   const pollUntilVerified = useCallback(async () => {
      pollCancelRef.current = false;
      setPageState('polling');

      for (let attempt = 0; attempt < STATUS_REFRESH_RETRIES; attempt++) {
         if (pollCancelRef.current) return;
         if (attempt > 0) await wait(STATUS_REFRESH_DELAY_MS);
         if (pollCancelRef.current) return;

         try {
            const refreshedUser = await dispatch(fetchUser()).unwrap();
            if (refreshedUser.isDidit === WorldId.ACTIVE) {
               window.sessionStorage.removeItem(PENDING_FLAG_KEY);
               setPageState('success');
               window.setTimeout(handleVerified, 1200);
               return;
            }
         } catch {
            // Ignore transient errors and keep polling.
         }
      }

      // Didit review can take minutes; let the user leave and come back.
      setPageState('waiting');
   }, [dispatch, handleVerified]);

   // Already verified, or returning from the Didit hosted flow → resume polling.
   useEffect(() => {
      if (user?.isDidit === WorldId.ACTIVE) {
         handleVerified();
         return;
      }
      if (window.sessionStorage.getItem(PENDING_FLAG_KEY) === '1') {
         void pollUntilVerified();
      }
      return () => {
         pollCancelRef.current = true;
      };
   // Run once on mount.
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   const startVerification = useCallback(async () => {
      if (isPreview) {
         handleVerified();
         return;
      }
      setErrorMessage('');
      setPageState('starting');
      try {
         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase.functions.invoke('create-didit-session', {
            body: returnTo ? { returnTo } : {}
         });
         const url = (data as { url?: string } | null)?.url;
         if (error || !url) {
            throw new Error('Could not start verification. Please try again.');
         }
         window.sessionStorage.setItem(PENDING_FLAG_KEY, '1');
         window.location.href = url;
      } catch (err) {
         setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
         setPageState('error');
      }
   }, [isPreview, returnTo, handleVerified]);

   if (pageState === 'success') {
      return <StatusPage title="Verified!" body="Your identity has been confirmed. Taking you to the next step." />;
   }

   if (pageState === 'polling' || pageState === 'starting') {
      return (
         <StatusPage
            title={pageState === 'starting' ? 'Starting verification…' : 'Checking verification…'}
            body="Waiting for Didit to confirm your identity. Keep this screen open."
         />
      );
   }

   if (pageState === 'waiting') {
      return (
         <StatusPage
            title="Verification Submitted"
            body="Didit is reviewing your documents. This usually takes a few minutes. You can close this page and come back — you'll be verified once the review is complete."
            action={{ label: 'Check again', onClick: () => void pollUntilVerified() }}
            secondaryAction={{ label: 'Go back', onClick: () => navigate(-1) }}
         />
      );
   }

   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white flex flex-col items-center justify-center max-w-modal mx-auto w-full px-md-4 py-md-5">
         <div className="flex flex-col items-center gap-md-3 text-center w-full">
            <img src="/hippos/hippo-with-id-card.png" alt="" aria-hidden="true" className="w-40" />
            <div className="flex flex-col gap-md-1">
               <h1 className="text-md-display text-md-heading">Verify Your Identity</h1>
               <p className="text-md-b1 font-medium text-md-neutral-700">
                  Complete a quick ID and selfie check. This is a one-time step.
               </p>
            </div>

            {errorMessage ? <p className="text-md-b2 font-medium text-md-red-400">{errorMessage}</p> : null}

            <div className="flex flex-col gap-md-2 w-full">
               <p className="text-md-b2 font-semibold text-md-neutral-700">Supported countries</p>
               <div className="grid grid-cols-2 gap-2 w-full">
                  {SUPPORTED_DIDIT_COUNTRIES.map(({ code, name, Flag }) => (
                     <div
                        key={code}
                        className="flex items-center gap-2 bg-md-neutral-100 border border-md-neutral-600 rounded-md-input px-md-3 py-md-2"
                     >
                        <Flag className="w-6 h-4 rounded-[2px] shrink-0 overflow-hidden" />
                        <span className="text-md-b2 font-medium text-md-neutral-1200 truncate">{name}</span>
                     </div>
                  ))}
               </div>
            </div>

            <button
               type="button"
               onClick={() => void startVerification()}
               className="flex items-center justify-center w-full px-md-4 py-md-3 rounded-md-lg bg-md-primary-1200 text-md-b1 font-semibold text-md-neutral-100"
            >
               {isPreview ? 'Simulate Verified' : 'Start Verification'}
            </button>

            <button
               type="button"
               onClick={() => navigate(-1)}
               className="text-md-b2 font-medium text-md-neutral-700 underline underline-offset-2"
            >
               Go back
            </button>
         </div>
      </div>
   );
}

function StatusPage({
   title,
   body,
   action,
   secondaryAction
}: {
   title: string;
   body: string;
   action?: { label: string; onClick: () => void };
   secondaryAction?: { label: string; onClick: () => void };
}) {
   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white flex flex-col items-center justify-center max-w-modal mx-auto w-full px-md-4 py-md-5">
         <div className="flex flex-col items-center gap-md-3 text-center w-full">
            <img src="/hippos/hippo-with-id-card.png" alt="" aria-hidden="true" className="w-40" />
            <div className="flex flex-col gap-md-1">
               <h1 className="text-md-display text-md-heading">{title}</h1>
               <p className="text-md-b1 font-medium text-md-neutral-700">{body}</p>
            </div>
            {action ? (
               <button
                  type="button"
                  onClick={action.onClick}
                  className="flex items-center justify-center w-full px-md-4 py-md-3 rounded-md-lg bg-md-primary-1200 text-md-b1 font-semibold text-md-neutral-100"
               >
                  {action.label}
               </button>
            ) : null}
            {secondaryAction ? (
               <button
                  type="button"
                  onClick={secondaryAction.onClick}
                  className="text-md-b2 font-medium text-md-neutral-700 underline underline-offset-2"
               >
                  {secondaryAction.label}
               </button>
            ) : null}
         </div>
      </div>
   );
}
