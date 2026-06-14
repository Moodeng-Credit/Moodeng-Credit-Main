import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { SUPPORTED_DIDIT_COUNTRIES } from '@/components/verification/CountryFlags';
import WorldIDVerification from '@/components/worldId/WorldIDVerification';

import { isUserVerified } from '@/lib/isUserVerified';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

const STATUS_REFRESH_RETRIES = 40;
const STATUS_REFRESH_DELAY_MS = 3000;
const FLOW_KEY = 'verify_flow';

const wait = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });

type VerifyMethod = 'worldid' | 'didit';
type FlowState = { method: VerifyMethod; returnTo?: string; livenessSessionId?: string };

/**
 * Steps the shared verification flow moves through. Liveness always runs first (anti-cheat
 * face-search gate); only after it clears does the chosen method (World ID or Didit ID) run.
 */
type Step =
   | 'loading'
   | 'worldid-intro'
   | 'liveness-start'
   | 'liveness-pending'
   | 'liveness-waiting'
   | 'confirm'
   | 'worldid'
   | 'id-start'
   | 'id-pending'
   | 'id-waiting'
   | 'duplicate'
   | 'declined'
   | 'success'
   | 'error';

const readFlow = (): FlowState | null => {
   try {
      const raw = window.sessionStorage.getItem(FLOW_KEY);
      return raw ? (JSON.parse(raw) as FlowState) : null;
   } catch {
      return null;
   }
};
const writeFlow = (flow: FlowState) => window.sessionStorage.setItem(FLOW_KEY, JSON.stringify(flow));
const clearFlow = () => window.sessionStorage.removeItem(FLOW_KEY);

export default function VerifyFlow() {
   const navigate = useNavigate();
   const location = useLocation();
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);

   const [step, setStep] = useState<Step>('loading');
   const [errorMessage, setErrorMessage] = useState('');
   const pollCancelRef = useRef(false);
   const startedRef = useRef(false);

   const navigateAfterVerified = useCallback(
      (returnTo?: string) => {
         clearFlow();
         switch (returnTo) {
            case 'loan-request':
               navigate('/request-board', { replace: true, state: { openLoanRequest: true } });
               return;
            case 'account-settings':
               navigate('/account/settings', { replace: true });
               return;
            case 'repay':
               navigate('/repay', { replace: true });
               return;
            case 'milestones':
               navigate('/milestones', { replace: true });
               return;
            case 'dashboard-credit-level':
               navigate('/dashboard', { replace: true });
               return;
            default:
               // A path-style returnTo (e.g. the caller's current page) sends the user back there.
               if (returnTo && returnTo.startsWith('/')) {
                  navigate(returnTo, { replace: true });
                  return;
               }
               navigate('/onboarding/congratulations', { replace: true });
         }
      },
      [navigate]
   );

   // --- Liveness ----------------------------------------------------------------

   const startLiveness = useCallback(async (flow: FlowState) => {
      setErrorMessage('');
      setStep('liveness-start');
      try {
         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase.functions.invoke('create-didit-session', {
            body: { kind: 'liveness', ...(flow.returnTo ? { returnTo: flow.returnTo } : {}) }
         });
         const url = (data as { url?: string; sessionId?: string } | null)?.url;
         const sessionId = (data as { sessionId?: string } | null)?.sessionId;
         if (error || !url) {
            throw new Error('Could not start the liveness check. Please try again.');
         }
         writeFlow({ ...flow, livenessSessionId: sessionId ?? undefined });
         window.location.href = url;
      } catch (err) {
         setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
         setStep('error');
      }
   }, []);

   const pollLiveness = useCallback(
      async (flow: FlowState) => {
         pollCancelRef.current = false;
         setStep('liveness-pending');

         for (let attempt = 0; attempt < STATUS_REFRESH_RETRIES; attempt++) {
            if (pollCancelRef.current) return;
            if (attempt > 0) await wait(STATUS_REFRESH_DELAY_MS);
            if (pollCancelRef.current) return;

            try {
               const refreshed = await dispatch(fetchUser()).unwrap();
               // Resolve only the attempt we started (guards against a stale prior session).
               const matchesAttempt = !flow.livenessSessionId || refreshed.livenessSessionId === flow.livenessSessionId;
               if (!matchesAttempt) continue;
               if (refreshed.livenessStatus === 'APPROVED') {
                  setStep('confirm');
                  return;
               }
               if (refreshed.livenessStatus === 'DUPLICATE') {
                  setStep('duplicate');
                  return;
               }
               if (refreshed.livenessStatus === 'DECLINED') {
                  setStep('declined');
                  return;
               }
            } catch {
               // Ignore transient errors and keep polling.
            }
         }

         setStep('liveness-waiting');
      },
      [dispatch]
   );

   // --- Didit ID step -----------------------------------------------------------

   const startIdSession = useCallback(async (flow: FlowState) => {
      setErrorMessage('');
      setStep('id-start');
      try {
         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase.functions.invoke('create-didit-session', {
            body: { kind: 'id', ...(flow.returnTo ? { returnTo: flow.returnTo } : {}) }
         });
         const url = (data as { url?: string } | null)?.url;
         if (error || !url) {
            // Most likely the liveness gate expired (409) — send the user back through liveness.
            throw new Error('LIVENESS_REQUIRED');
         }
         window.location.href = url;
      } catch (err) {
         if (err instanceof Error && err.message === 'LIVENESS_REQUIRED') {
            void startLiveness(flow);
            return;
         }
         setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
         setStep('error');
      }
   }, [startLiveness]);

   const pollDidit = useCallback(async () => {
      pollCancelRef.current = false;
      setStep('id-pending');

      for (let attempt = 0; attempt < STATUS_REFRESH_RETRIES; attempt++) {
         if (pollCancelRef.current) return;
         if (attempt > 0) await wait(STATUS_REFRESH_DELAY_MS);
         if (pollCancelRef.current) return;

         try {
            const refreshed = await dispatch(fetchUser()).unwrap();
            if (refreshed.isDidit === 'ACTIVE') {
               setStep('success');
               return;
            }
         } catch {
            // Ignore transient errors and keep polling.
         }
      }

      setStep('id-waiting');
   }, [dispatch]);

   // --- Mount: resolve where we are in the flow ---------------------------------

   useEffect(() => {
      if (startedRef.current) return;
      startedRef.current = true;

      // Already verified by either method — nothing to do.
      if (isUserVerified(user)) {
         const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
         navigateAfterVerified(returnTo);
         return;
      }

      const params = new URLSearchParams(location.search);
      const kind = params.get('kind');
      const routeState = location.state as { method?: VerifyMethod; returnTo?: string } | null;
      const existing = readFlow();

      // Returning from a Didit redirect (route state is gone, query param tells us which step).
      if (kind === 'liveness' && existing) {
         void pollLiveness(existing);
         return;
      }
      if (kind === 'id' && existing) {
         void pollDidit();
         return;
      }

      // Liveness is sticky: once it has passed (or been blocked as a duplicate), don't re-run it.
      // Re-running would 1:N-match the user's own prior approved liveness session and lock them out.
      const resume = (flow: FlowState) => {
         if (user?.livenessStatus === 'APPROVED') {
            setStep('confirm');
            return;
         }
         if (user?.livenessStatus === 'DUPLICATE') {
            setStep('duplicate');
            return;
         }
         if (flow.method === 'worldid') {
            setStep('worldid-intro');
            return;
         }
         void startLiveness(flow);
      };

      // Fresh entry from the chooser modal / onboarding.
      if (routeState?.method) {
         const flow: FlowState = { method: routeState.method, returnTo: routeState.returnTo };
         writeFlow(flow);
         resume(flow);
         return;
      }

      // Resume an in-progress flow with no usable context, else bail out.
      if (existing) {
         resume(existing);
         return;
      }
      navigate('/dashboard', { replace: true });
   }, [location, navigate, navigateAfterVerified, pollDidit, pollLiveness, startLiveness, user]);

   useEffect(() => () => {
      pollCancelRef.current = true;
   }, []);

   const flow = readFlow();

   // After the confirm step for the World ID branch, the modal button opens World ID directly.
   const handleWorldIdSuccess = useCallback(() => {
      navigateAfterVerified(flow?.returnTo);
   }, [flow?.returnTo, navigateAfterVerified]);

   // --- Render ------------------------------------------------------------------

   if (step === 'worldid-intro' && flow) {
      return (
         <StatusScreen
            title="One quick step first"
            body="Before World ID, we run a quick one-time face check to confirm you're a unique person. This only takes a moment, and you won't need to do it again."
            action={{ label: 'Continue', onClick: () => void startLiveness(flow) }}
            secondaryAction={{ label: 'Go back', onClick: () => { clearFlow(); navigate(-1); } }}
         />
      );
   }

   if (step === 'liveness-start' || step === 'id-start') {
      return <StatusScreen title="Starting…" body="Setting up your verification. Keep this screen open." />;
   }

   if (step === 'liveness-pending') {
      return <StatusScreen title="Checking you're a real person…" body="Waiting for the liveness check to complete. Keep this screen open." />;
   }

   if (step === 'id-pending') {
      return <StatusScreen title="Confirming your ID…" body="Waiting for Didit to confirm your documents. Keep this screen open." />;
   }

   if (step === 'liveness-waiting') {
      return (
         <StatusScreen
            title="Almost there"
            body="The liveness check is still finishing. This usually takes a moment — you can check again."
            action={{ label: 'Check again', onClick: () => flow && void pollLiveness(flow) }}
            secondaryAction={{ label: 'Go back', onClick: () => navigate(-1) }}
         />
      );
   }

   if (step === 'id-waiting') {
      return (
         <StatusScreen
            title="Verification Submitted"
            body="Didit is reviewing your documents. This usually takes a few minutes. You'll be verified once the review is complete."
            action={{ label: 'Check again', onClick: () => void pollDidit() }}
            secondaryAction={{ label: 'Go back', onClick: () => navigate(-1) }}
         />
      );
   }

   if (step === 'success') {
      return <StatusScreen title="Verified!" body="Your identity has been confirmed. Taking you to the next step." />;
   }

   if (step === 'duplicate') {
      return (
         <StatusScreen
            title="This identity is already registered"
            body="Our checks found an account already verified with this face. Each person can verify only once. If you think this is a mistake, please contact support."
            action={{ label: 'Go back', onClick: () => { clearFlow(); navigate(-1); } }}
         />
      );
   }

   if (step === 'declined') {
      return (
         <StatusScreen
            title="Liveness check didn't pass"
            body="We couldn't confirm a live person. Please try again in good lighting with your face clearly visible."
            action={{ label: 'Try again', onClick: () => flow && void startLiveness(flow) }}
            secondaryAction={{ label: 'Go back', onClick: () => { clearFlow(); navigate(-1); } }}
         />
      );
   }

   if (step === 'error') {
      return (
         <StatusScreen
            title="Something went wrong"
            body={errorMessage || 'Please try again.'}
            action={{ label: 'Try again', onClick: () => flow && void startLiveness(flow) }}
            secondaryAction={{ label: 'Go back', onClick: () => { clearFlow(); navigate(-1); } }}
         />
      );
   }

   if (step === 'confirm' && flow) {
      return (
         <ConfirmScreen
            method={flow.method}
            worldIdTrigger={
               <WorldIDVerification onSuccess={handleWorldIdSuccess} showSuccessToast={false} className="w-full">
                  {({ open }) => (
                     <button
                        type="button"
                        onClick={open}
                        className="flex items-center justify-center w-full px-md-4 py-md-3 rounded-md-lg bg-md-primary-1200 text-md-b1 font-semibold text-md-neutral-100"
                     >
                        Continue to World ID
                     </button>
                  )}
               </WorldIDVerification>
            }
            onContinueDidit={() => void startIdSession(flow)}
         />
      );
   }

   // 'loading' and any transient state.
   return <StatusScreen title="Loading…" body="Preparing verification." />;
}

function ConfirmScreen({
   method,
   worldIdTrigger,
   onContinueDidit
}: {
   method: VerifyMethod;
   worldIdTrigger: ReactNode;
   onContinueDidit: () => void;
}) {
   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f] flex flex-col items-center justify-center max-w-modal mx-auto w-full px-md-4 py-md-5">
         <div className="flex flex-col items-center gap-md-3 text-center w-full">
            <img src="/icons/check-fill.svg" alt="" aria-hidden="true" className="w-16 h-16" />
            <div className="flex flex-col gap-md-1">
               <h1 className="text-md-display text-md-heading">You&rsquo;re a real person!</h1>
               <p className="text-md-b1 font-medium text-md-neutral-700">
                  {method === 'worldid'
                     ? 'Liveness confirmed. Now finish by verifying with World ID.'
                     : 'Liveness confirmed. Now let&rsquo;s confirm the rest of your identity with your ID.'}
               </p>
            </div>

            {method === 'didit' ? (
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
            ) : null}

            {method === 'worldid' ? (
               worldIdTrigger
            ) : (
               <button
                  type="button"
                  onClick={onContinueDidit}
                  className="flex items-center justify-center w-full px-md-4 py-md-3 rounded-md-lg bg-md-primary-1200 text-md-b1 font-semibold text-md-neutral-100"
               >
                  Continue to ID check
               </button>
            )}
         </div>
      </div>
   );
}

function StatusScreen({
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
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f] flex flex-col items-center justify-center max-w-modal mx-auto w-full px-md-4 py-md-5">
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
