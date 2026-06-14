import { useCallback, useEffect, useRef, useState } from 'react';

import Veriff from '@veriff/js-sdk';
import { MESSAGES, createVeriffFrame } from '@veriff/incontext-sdk';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { WorldId } from '@/types/authTypes';

const VERIFF_API_KEY = 'ce956592-1ed3-469a-bb05-5e11ed461fb9';
const VERIFF_HOST = 'https://stationapi.veriff.com';

const STATUS_REFRESH_RETRIES = 40;
const STATUS_REFRESH_DELAY_MS = 3000;

const wait = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });

type PageState = 'idle' | 'polling' | 'waiting' | 'success' | 'error';

const CONTAINER_ID = 'veriff-root';

export default function VeriffVerification() {
   const navigate = useNavigate();
   const location = useLocation();
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);

   const isPreview = import.meta.env.DEV && location.pathname.includes('preview');
   const returnTo = (location.state as { returnTo?: string } | null)?.returnTo
      ?? new URLSearchParams(location.search).get('returnTo')
      ?? undefined;

   const [pageState, setPageState] = useState<PageState>('idle');
   const pollCancelRef = useRef(false);
   const veriffInstanceRef = useRef<ReturnType<typeof Veriff> | null>(null);

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
      if (user?.isVeriff === WorldId.ACTIVE) {
         handleVerified();
      }
   }, [user?.isVeriff, handleVerified]);

   const pollUntilVerified = useCallback(async () => {
      pollCancelRef.current = false;
      setPageState('polling');

      for (let attempt = 0; attempt < STATUS_REFRESH_RETRIES; attempt++) {
         if (pollCancelRef.current) return;
         if (attempt > 0) await wait(STATUS_REFRESH_DELAY_MS);
         if (pollCancelRef.current) return;

         try {
            const refreshedUser = await dispatch(fetchUser()).unwrap();
            if (refreshedUser.isVeriff === 'ACTIVE') {
               setPageState('success');
               window.setTimeout(handleVerified, 1200);
               return;
            }
         } catch {
            // continue polling
         }
      }

      // Veriff review can take minutes — show the waiting state
      setPageState('waiting');
   }, [dispatch, handleVerified]);

   const handleFrameEvent = useCallback((msg: MESSAGES) => {
      if (msg === MESSAGES.FINISHED || msg === MESSAGES.SUBMITTED) {
         void pollUntilVerified();
      }
   }, [pollUntilVerified]);

   // Mount the Veriff SDK widget
   useEffect(() => {
      if (isPreview || !VERIFF_API_KEY || pageState !== 'idle') return;

      const veriff = Veriff({
         host: VERIFF_HOST,
         apiKey: VERIFF_API_KEY,
         parentId: CONTAINER_ID,
         onSession: (_err: unknown, response: { verification: { url: string } }) => {
            if (!response?.verification?.url) return;
            createVeriffFrame({
               url: response.verification.url,
               onEvent: handleFrameEvent,
            });
         },
      });

      veriff.setParams({
         vendorData: user?.id ?? '',
      });

      veriff.mount({
         submitBtnText: 'Start Verification',
      });

      veriffInstanceRef.current = veriff;

      return () => {
         pollCancelRef.current = true;
      };
   // Only run once on mount
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isPreview, pageState === 'idle']);

   if (isPreview) {
      return (
         <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f] flex flex-col items-center justify-center max-w-modal mx-auto w-full px-md-4 py-md-5">
            <div className="flex flex-col items-center gap-md-3 text-center w-full">
               <img src="/hippos/hippo-with-id-card.png" alt="" aria-hidden="true" className="w-40" />
               <h1 className="text-md-display text-md-heading">Verify Your Identity</h1>
               <p className="text-md-b1 font-medium text-md-neutral-700">[Preview] Veriff verification flow</p>
               <button
                  type="button"
                  onClick={handleVerified}
                  className="flex items-center justify-center w-full px-md-4 py-md-3 rounded-md-lg bg-md-primary-1200 text-md-b1 font-semibold text-md-neutral-100"
               >
                  Simulate Verified
               </button>
            </div>
         </div>
      );
   }

   if (pageState === 'success') {
      return (
         <StatusPage
            title="Verified!"
            body="Your identity has been confirmed. Taking you to the next step."
         />
      );
   }

   if (pageState === 'polling') {
      return (
         <StatusPage
            title="Checking verification…"
            body="Waiting for Veriff to confirm your identity. Keep this screen open."
         />
      );
   }

   if (pageState === 'waiting') {
      return (
         <StatusPage
            title="Verification Submitted"
            body="Veriff is reviewing your documents. This usually takes a few minutes. You can close this page and come back — you'll be verified once the review is complete."
            action={{ label: 'Check again', onClick: () => void pollUntilVerified() }}
            secondaryAction={{ label: 'Go back', onClick: () => navigate(-1) }}
         />
      );
   }

   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f] flex flex-col items-center justify-center max-w-modal mx-auto w-full px-md-4 py-md-5">
         <div className="flex flex-col items-center gap-md-3 text-center w-full">
            <img src="/hippos/hippo-with-id-card.png" alt="" aria-hidden="true" className="w-40" />
            <div className="flex flex-col gap-md-1">
               <h1 className="text-md-display text-md-heading">Verify Your Identity</h1>
               <p className="text-md-b1 font-medium text-md-neutral-700">
                  Enter your name and complete a quick ID + selfie check. This is a one-time step.
               </p>
            </div>

            {/* Veriff SDK mounts its form here */}
            <div id={CONTAINER_ID} className="w-full" />

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
   secondaryAction,
}: {
   title: string;
   body: string;
   action?: { label: string; onClick: () => void };
   secondaryAction?: { label: string; onClick: () => void };
}) {
   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f] flex flex-col items-center justify-center max-w-modal mx-auto w-full px-md-4 py-md-5">
         <div className="flex flex-col items-center gap-md-3 text-center w-full">
            <img src="/hippos/hippo-with-id-card.png" alt="" aria-hidden="true" className="w-40" />
            <div className="flex flex-col gap-md-1">
               <h1 className="text-md-display text-md-heading">{title}</h1>
               <p className="text-md-b1 font-medium text-md-neutral-700">{body}</p>
            </div>
            {action && (
               <button
                  type="button"
                  onClick={action.onClick}
                  className="flex items-center justify-center w-full px-md-4 py-md-3 rounded-md-lg bg-md-primary-1200 text-md-b1 font-semibold text-md-neutral-100"
               >
                  {action.label}
               </button>
            )}
            {secondaryAction && (
               <button
                  type="button"
                  onClick={secondaryAction.onClick}
                  className="text-md-b2 font-medium text-md-neutral-700 underline underline-offset-2"
               >
                  {secondaryAction.label}
               </button>
            )}
         </div>
      </div>
   );
}
