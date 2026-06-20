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
const FLOW_TTL_MS = 60 * 60 * 1000; // 1 hour

const wait = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });

type VerifyMethod = 'worldid' | 'didit';
type FlowState = { method: VerifyMethod; returnTo?: string; livenessSessionId?: string; ts?: number };

type Step =
   | 'loading'
   | 'liveness-redirecting'
   | 'liveness-start'
   | 'liveness-pending'
   | 'liveness-waiting'
   | 'confirm'
   | 'worldid'
   | 'id-redirecting'
   | 'id-start'
   | 'id-pending'
   | 'id-waiting'
   | 'duplicate'
   | 'declined'
   | 'success'
   | 'error';

// localStorage with 1-hour TTL — survives tab kills during Didit redirects unlike sessionStorage
const readFlow = (): FlowState | null => {
   try {
      const raw = window.localStorage.getItem(FLOW_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as FlowState;
      if (parsed.ts && Date.now() - parsed.ts > FLOW_TTL_MS) {
         window.localStorage.removeItem(FLOW_KEY);
         return null;
      }
      return parsed;
   } catch {
      return null;
   }
};
const writeFlow = (flow: FlowState) =>
   window.localStorage.setItem(FLOW_KEY, JSON.stringify({ ...flow, ts: Date.now() }));
const clearFlow = () => window.localStorage.removeItem(FLOW_KEY);

// Tracks seconds since mount — used to show dynamic copy after 30s of polling
function useElapsedSeconds(active: boolean): number {
   const [elapsed, setElapsed] = useState(0);
   useEffect(() => {
      if (!active) { setElapsed(0); return; }
      setElapsed(0);
      const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
      return () => window.clearInterval(id);
   }, [active]);
   return elapsed;
}

export default function VerifyFlow() {
   const navigate = useNavigate();
   const location = useLocation();
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);

   const [step, setStep] = useState<Step>('loading');
   const [errorMessage, setErrorMessage] = useState('');
   const [isChecking, setIsChecking] = useState(false);
   const pollCancelRef = useRef(false);
   const startedRef = useRef(false);

   const isLivenessPoll = step === 'liveness-pending';
   const isIdPoll = step === 'id-pending';
   const elapsed = useElapsedSeconds(isLivenessPoll || isIdPoll);

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
      // Brief redirect-warning screen before handing off to Didit
      setStep('liveness-redirecting');
      await wait(2000);
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
      // Brief redirect-warning screen before handing off to Didit
      setStep('id-redirecting');
      await wait(2000);
      setStep('id-start');
      try {
         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase.functions.invoke('create-didit-session', {
            body: { kind: 'id', ...(flow.returnTo ? { returnTo: flow.returnTo } : {}) }
         });
         const url = (data as { url?: string } | null)?.url;
         if (error || !url) {
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
      setIsChecking(true);
      setStep('id-pending');

      for (let attempt = 0; attempt < STATUS_REFRESH_RETRIES; attempt++) {
         if (pollCancelRef.current) return;
         if (attempt > 0) await wait(STATUS_REFRESH_DELAY_MS);
         if (pollCancelRef.current) return;

         try {
            const refreshed = await dispatch(fetchUser()).unwrap();
            if (refreshed.isDidit === 'ACTIVE') {
               setIsChecking(false);
               setStep('success');
               return;
            }
         } catch {
            // Ignore transient errors and keep polling.
         }
      }

      setIsChecking(false);
      // After 2 minutes with no result, redirect to dashboard — the webhook will confirm
      // asynchronously. A pending banner on the dashboard lets them track status.
      const flow = readFlow();
      clearFlow();
      navigate('/dashboard', { replace: true, state: { verificationPending: true } });
      void flow; // flow is retained in localStorage by navigate; cleared above is intentional
   }, [dispatch, navigate]);

   // --- Mount -------------------------------------------------------------------

   useEffect(() => {
      if (startedRef.current) return;
      startedRef.current = true;

      if (isUserVerified(user)) {
         const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
         navigateAfterVerified(returnTo);
         return;
      }

      const params = new URLSearchParams(location.search);
      const kind = params.get('kind');
      const routeState = location.state as { method?: VerifyMethod; returnTo?: string } | null;
      const existing = readFlow();

      if (kind === 'liveness' && existing) {
         void pollLiveness(existing);
         return;
      }
      if (kind === 'id' && existing) {
         void pollDidit();
         return;
      }

      const resume = (flow: FlowState) => {
         if (user?.livenessStatus === 'APPROVED') {
            setStep('confirm');
            return;
         }
         if (user?.livenessStatus === 'DUPLICATE') {
            setStep('duplicate');
            return;
         }
         void startLiveness(flow);
      };

      if (routeState?.method) {
         const flow: FlowState = { method: routeState.method, returnTo: routeState.returnTo };
         writeFlow(flow);
         resume(flow);
         return;
      }

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

   // Success: brief celebration then navigate
   useEffect(() => {
      if (step !== 'success') return;
      const timeout = window.setTimeout(() => navigateAfterVerified(flow?.returnTo), 2500);
      return () => window.clearTimeout(timeout);
   }, [step, flow?.returnTo, navigateAfterVerified]);

   const handleWorldIdSuccess = useCallback(() => {
      navigateAfterVerified(flow?.returnTo);
   }, [flow?.returnTo, navigateAfterVerified]);

   // --- Render ------------------------------------------------------------------

   if (step === 'liveness-redirecting') {
      return (
         <StatusScreen
            stepLabel="Step 1 of 2"
            visual="orbit"
            title="Taking you to Didit…"
            body="You'll complete a quick face scan to confirm you're a real person. Come back here when you're done."
         />
      );
   }

   if (step === 'liveness-start' || step === 'id-start') {
      return (
         <StatusScreen
            stepLabel={step === 'liveness-start' ? 'Step 1 of 2' : 'Step 2 of 2'}
            visual="orbit"
            title="Setting up…"
            body="Starting your verification. Keep this screen open."
         />
      );
   }

   if (step === 'liveness-pending') {
      const body = elapsed > 90
         ? 'Almost there — hang tight while Didit finishes the check.'
         : elapsed > 30
         ? 'Still checking — liveness checks usually take a minute or two.'
         : 'Waiting for the liveness check to complete. Keep this screen open.';
      return (
         <StatusScreen
            stepLabel="Step 1 of 2"
            visual="orbit"
            title="Checking you're a real person…"
            body={body}
         />
      );
   }

   if (step === 'id-redirecting') {
      return (
         <StatusScreen
            stepLabel="Step 2 of 2"
            visual="orbit"
            title="Taking you to Didit…"
            body="You'll upload your ID and take a selfie. Come back here when you're done."
         />
      );
   }

   if (step === 'id-pending') {
      const body = elapsed > 90
         ? 'Almost there — Didit is finishing the review.'
         : elapsed > 30
         ? 'Still confirming — ID checks usually take a minute or two.'
         : 'Waiting for Didit to confirm your documents. Keep this screen open.';
      return (
         <StatusScreen
            stepLabel="Step 2 of 2"
            visual="orbit"
            title="Confirming your ID…"
            body={body}
         />
      );
   }

   if (step === 'liveness-waiting') {
      return (
         <StatusScreen
            stepLabel="Step 1 of 2"
            title="Almost there"
            body="The liveness check is still finishing up. This usually takes a moment."
            action={{ label: 'Check again', onClick: () => flow && void pollLiveness(flow), loading: isChecking }}
            secondaryAction={{ label: 'Go back', onClick: () => navigate(-1) }}
         />
      );
   }

   if (step === 'id-waiting') {
      return (
         <StatusScreen
            stepLabel="Step 2 of 2"
            title="Documents submitted!"
            body="Your ID was submitted successfully. Didit typically confirms within a few minutes — occasionally it takes a bit longer. You can leave this screen; we'll update your status automatically."
            action={{ label: 'Check again', onClick: async () => { setIsChecking(true); await pollDidit(); setIsChecking(false); }, loading: isChecking }}
            secondaryAction={{ label: 'Go to dashboard', onClick: () => navigate('/dashboard') }}
         />
      );
   }

   if (step === 'success') {
      return (
         <StatusScreen
            visual="orbit-success"
            title="Verified!"
            body="Your identity has been confirmed. Taking you to the next step."
         />
      );
   }

   if (step === 'duplicate') {
      return (
         <StatusScreen
            title="This identity is already registered"
            body="Our checks found an account already verified with this face. Each person can only verify once. If you think this is a mistake, please contact support."
            action={{ label: 'Go back', onClick: () => { clearFlow(); navigate(-1); } }}
            supportLink
         />
      );
   }

   if (step === 'declined') {
      return (
         <StatusScreen
            stepLabel="Step 1 of 2"
            title="Liveness check didn't pass"
            body="We couldn't confirm a live person. A few things that help:"
            tips={[
               'Good, even lighting — avoid bright backlighting',
               'Hold your phone steady and face the camera directly',
               'Remove sunglasses or hats',
               'Make sure your whole face is visible in the frame',
            ]}
            action={{ label: 'Try again', onClick: () => flow && void startLiveness(flow) }}
            secondaryAction={{ label: 'Go back', onClick: () => { clearFlow(); navigate(-1); } }}
            supportLink
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
            supportLink
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

   return <StatusScreen visual="orbit" title="Loading…" body="Preparing verification." />;
}

// --- HippoOrbit ---------------------------------------------------------------
// Purple circular track with Moodeng orbiting around it.
// mode "orbit": hippo spins continuously.
// mode "orbit-success": hippo stops at top with a green checkmark.

function HippoOrbit({ mode }: { mode: 'orbit' | 'orbit-success' }) {
   return (
      <>
         <style>{`
            @keyframes hippoOrbit {
               from { transform: rotate(0deg) translateY(-68px) rotate(0deg); }
               to   { transform: rotate(360deg) translateY(-68px) rotate(-360deg); }
            }
            @keyframes hippoSuccessPop {
               0%   { transform: scale(0.7); opacity: 0; }
               70%  { transform: scale(1.15); opacity: 1; }
               100% { transform: scale(1); opacity: 1; }
            }
            @keyframes arcFill {
               from { stroke-dashoffset: 427; }
               to   { stroke-dashoffset: 0; }
            }
         `}</style>
         <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
            {/* Purple progress arc */}
            <svg width="160" height="160" viewBox="0 0 160 160" className="absolute inset-0" aria-hidden="true">
               <circle cx="80" cy="80" r="68" fill="none" stroke="#f1e9fd" strokeWidth="4" />
               <circle
                  cx="80" cy="80" r="68"
                  fill="none"
                  stroke="#6010d2"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="427"
                  strokeDashoffset={mode === 'orbit-success' ? 0 : 427}
                  transform="rotate(-90 80 80)"
                  style={mode === 'orbit-success' ? { animation: 'arcFill 0.6s ease-out forwards' } : undefined}
               />
            </svg>

            {mode === 'orbit' ? (
               /* Orbiting hippo */
               <div style={{ position: 'absolute', animation: 'hippoOrbit 2.4s linear infinite', transformOrigin: 'center' }}>
                  <img src="/hippos/hippo-with-id-card.png" alt="" aria-hidden="true" className="w-10 h-10 object-contain" />
               </div>
            ) : (
               /* Success: hippo at top with checkmark */
               <div style={{ animation: 'hippoSuccessPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
                  <div className="relative">
                     <img src="/hippos/hippo-with-id-card.png" alt="" aria-hidden="true" className="w-14 h-14 object-contain" />
                     <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-md-green-700 flex items-center justify-center">
                        <svg viewBox="0 0 10 10" className="w-3 h-3" fill="none" aria-hidden="true">
                           <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                     </div>
                  </div>
               </div>
            )}
         </div>
      </>
   );
}

// --- ConfirmScreen ------------------------------------------------------------

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
            <p className="text-md-b3 font-semibold text-md-neutral-700 uppercase tracking-widest">
               {method === 'worldid' ? 'Step 2 of 2' : 'Step 2 of 2'}
            </p>
            <img src="/icons/check-fill.svg" alt="" aria-hidden="true" className="w-16 h-16" />
            <div className="flex flex-col gap-md-1">
               <h1 className="text-md-display text-md-heading">You&rsquo;re a real person!</h1>
               <p className="text-md-b1 font-medium text-md-neutral-700">
                  {method === 'worldid'
                     ? 'Liveness confirmed. Now finish by verifying with World ID.'
                     : 'Liveness confirmed. Now let’s confirm your identity with your ID.'}
               </p>
            </div>

            {method === 'didit' ? (
               <div className="flex flex-col gap-4 w-full">
                  <p className="text-md-b3 font-semibold uppercase tracking-[0.08em] text-md-neutral-700 text-center">
                     Supported countries
                  </p>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-8 px-4 w-full">
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

// --- StatusScreen -------------------------------------------------------------

function StatusScreen({
   stepLabel,
   visual = 'static',
   title,
   body,
   tips,
   action,
   secondaryAction,
   supportLink,
}: {
   stepLabel?: string;
   visual?: 'orbit' | 'orbit-success' | 'static';
   title: string;
   body: string;
   tips?: string[];
   action?: { label: string; onClick: () => void; loading?: boolean };
   secondaryAction?: { label: string; onClick: () => void };
   supportLink?: boolean;
}) {
   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f] flex flex-col items-center justify-center max-w-modal mx-auto w-full px-md-4 py-md-5">
         <div className="flex flex-col items-center gap-md-3 text-center w-full">
            {stepLabel ? (
               <p className="text-md-b3 font-semibold text-md-neutral-700 uppercase tracking-widest">{stepLabel}</p>
            ) : null}

            {visual === 'orbit' || visual === 'orbit-success' ? (
               <HippoOrbit mode={visual === 'orbit-success' ? 'orbit-success' : 'orbit'} />
            ) : (
               <img src="/hippos/hippo-with-id-card.png" alt="" aria-hidden="true" className="w-40" />
            )}

            <div className="flex flex-col gap-md-1">
               <h1 className="text-md-display text-md-heading">{title}</h1>
               <p className="text-md-b1 font-medium text-md-neutral-700">{body}</p>
            </div>

            {tips && tips.length > 0 ? (
               <ul className="text-left w-full flex flex-col gap-2">
                  {tips.map((tip) => (
                     <li key={tip} className="flex items-start gap-2 text-md-b2 text-md-neutral-1200">
                        <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-md-primary-1200" aria-hidden="true" />
                        {tip}
                     </li>
                  ))}
               </ul>
            ) : null}

            {action ? (
               <button
                  type="button"
                  onClick={action.onClick}
                  disabled={action.loading}
                  className="flex items-center justify-center gap-2 w-full px-md-4 py-md-3 rounded-md-lg bg-md-primary-1200 text-md-b1 font-semibold text-md-neutral-100 disabled:opacity-60"
               >
                  {action.loading ? (
                     <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Checking…
                     </>
                  ) : action.label}
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

            {supportLink ? (
               <a
                  href="/support"
                  className="text-md-b3 text-md-neutral-700 underline underline-offset-2"
               >
                  Contact support
               </a>
            ) : null}
         </div>
      </div>
   );
}
