import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

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
   | 'id-review'
   | 'id-declined'
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

   // Background slow-poll while on id-waiting or id-review: check every 60s for a
   // status change (Approved → success, In Review → id-review, Declined → id-declined).
   useEffect(() => {
      if (step !== 'id-waiting' && step !== 'id-review') return;
      const id = window.setInterval(async () => {
         try {
            const refreshed = await dispatch(fetchUser()).unwrap();
            if (refreshed.isDidit === 'ACTIVE') {
               setStep('success');
            } else {
               const rawStatus = refreshed.diditIdStatus?.toLowerCase() ?? '';
               if (rawStatus === 'duplicate') setStep('duplicate');
               else if (rawStatus.includes('review')) setStep('id-review');
               else if (rawStatus === 'declined') setStep('id-declined');
            }
         } catch {
            // Keep polling silently on network errors.
         }
      }, 60_000);
      return () => window.clearInterval(id);
   }, [step, dispatch]);

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

   // --- Traditional KYC (combined Didit workflow) -------------------------------

   // A single hosted Didit session runs liveness + ID + face match end-to-end, so the
   // user never sees an intermediate "you've been verified" screen between steps — the
   // only completion screen is at the true end. We redirect out and poll for
   // is_didit = ACTIVE (or a duplicate/declined/review status) on return.
   const startKyc = useCallback(async (flow: FlowState) => {
      setErrorMessage('');
      // Brief redirect-warning screen before handing off to Didit
      setStep('id-redirecting');
      await wait(2000);
      setStep('id-start');
      try {
         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase.functions.invoke('create-didit-session', {
            body: { kind: 'combined', ...(flow.returnTo ? { returnTo: flow.returnTo } : {}) }
         });
         const url = (data as { url?: string } | null)?.url;
         if (error || !url) {
            throw new Error('Could not start verification. Please try again.');
         }
         window.location.href = url;
      } catch (err) {
         setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
         setStep('error');
      }
   }, []);

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
            const rawStatus = refreshed.diditIdStatus?.toLowerCase() ?? '';
            if (rawStatus === 'duplicate') {
               setIsChecking(false);
               setStep('duplicate');
               return;
            }
            if (rawStatus.includes('review')) {
               setIsChecking(false);
               setStep('id-review');
               return;
            }
            if (rawStatus === 'declined') {
               setIsChecking(false);
               setStep('id-declined');
               return;
            }
         } catch {
            // Ignore transient errors and keep polling.
         }
      }

      setIsChecking(false);
      // After 2 minutes with no Approved/Review/Declined, show the waiting screen.
      // A background slow-poll (useEffect below) keeps checking every 60s from here.
      setStep('id-waiting');
   }, [dispatch]);

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

      // Returning from a Didit redirect — poll for the result.
      // 'combined' = Traditional KYC single session; 'id' = legacy callback (still polled
      // the same way); 'liveness' = World ID's liveness pre-gate.
      if ((kind === 'combined' || kind === 'id') && existing) {
         void pollDidit();
         return;
      }
      if (kind === 'liveness' && existing) {
         void pollLiveness(existing);
         return;
      }

      // World ID path: liveness pre-gate first, then the World ID confirm screen.
      const resumeWorldId = (flow: FlowState) => {
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

      // Traditional KYC runs as one combined Didit session; World ID keeps the
      // liveness pre-gate (it can't be merged into a Didit workflow).
      const begin = (flow: FlowState) => {
         if (flow.method === 'didit') void startKyc(flow);
         else resumeWorldId(flow);
      };

      if (routeState?.method) {
         const flow: FlowState = { method: routeState.method, returnTo: routeState.returnTo };
         writeFlow(flow);
         begin(flow);
         return;
      }

      if (existing) {
         begin(existing);
         return;
      }
      navigate('/dashboard', { replace: true });
   }, [location, navigate, navigateAfterVerified, pollDidit, pollLiveness, startKyc, startLiveness, user]);

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
      const step2Hint = flow?.method === 'worldid'
         ? 'Step 2 will ask you to verify with World ID.'
         : 'Step 2 will ask for your national ID.';
      return (
         <StatusScreen
            stepLabel="Step 1 of 2"
            visual="orbit"
            title="Taking you to Didit…"
            body={`Step 1: a quick face scan to confirm you're real. ${step2Hint} Come back here when the face scan is done.`}
         />
      );
   }

   if (step === 'liveness-start' || step === 'id-start') {
      return (
         <StatusScreen
            stepLabel={step === 'liveness-start' ? 'Step 1 of 2' : undefined}
            visual="orbit"
            title="Setting up…"
            body="Starting your verification. Keep this screen open."
         />
      );
   }

   if (step === 'liveness-pending') {
      const step2Hint = flow?.method === 'worldid'
         ? 'Then you\'ll verify with World ID.'
         : 'Then you\'ll submit your national ID.';
      const body = elapsed > 90
         ? 'Almost there — hang tight while Didit finishes the check.'
         : elapsed > 30
         ? 'Still checking — liveness checks usually take a minute or two.'
         : `Confirming you're a real person. ${step2Hint} Keep this screen open.`;
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
            visual="orbit"
            title="Taking you to Didit…"
            body="You'll take a quick face scan and photograph your ID — all in one go. Come back here when you're done."
         />
      );
   }

   if (step === 'id-pending') {
      const body = elapsed > 90
         ? 'Almost there — Didit is finishing the review.'
         : elapsed > 30
         ? 'Still confirming — verification usually takes a minute or two.'
         : 'Waiting for Didit to confirm your verification. Keep this screen open.';
      return (
         <StatusScreen
            visual="orbit"
            title="Confirming your verification…"
            body={body}
         />
      );
   }

   if (step === 'liveness-waiting') {
      return (
         <StatusScreen
            stepLabel="Step 1 of 2"
            visual="orbit"
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
            visual="orbit"
            title="Reviewing your verification…"
            body="Your details are with Didit. Most checks finish in a few minutes — we'll update this screen automatically when done."
            action={{ label: 'Check status', onClick: async () => { setIsChecking(true); await pollDidit(); setIsChecking(false); }, loading: isChecking }}
            secondaryAction={{ label: 'Go to dashboard', onClick: () => navigate('/dashboard') }}
            supportLink
         />
      );
   }

   if (step === 'id-review') {
      return (
         <StatusScreen
            visual="orbit"
            title="Manual review in progress"
            body="Didit flagged your verification for a manual review — a human is checking it now. This usually takes a few hours but can take up to 1 business day. We'll update your status automatically."
            action={{ label: 'Check status', onClick: async () => { setIsChecking(true); await pollDidit(); setIsChecking(false); }, loading: isChecking }}
            secondaryAction={{ label: 'Go to dashboard', onClick: () => navigate('/dashboard') }}
            supportLink
         />
      );
   }

   if (step === 'id-declined') {
      return (
         <StatusScreen
            title="Verification didn't pass"
            body="Didit was unable to verify your identity. This can happen if the document image was unclear, expired, or didn't match your face. Contact our team — we can help check manually."
            action={{ label: 'Try again', onClick: () => flow && void startKyc(flow) }}
            secondaryAction={{ label: 'Go to dashboard', onClick: () => navigate('/dashboard') }}
            supportLink
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
            action={{ label: 'Continue to app', onClick: () => { clearFlow(); navigate('/dashboard'); } }}
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
            secondaryAction={{ label: 'Continue to app', onClick: () => { clearFlow(); navigate('/dashboard'); } }}
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
            secondaryAction={{ label: 'Continue to app', onClick: () => { clearFlow(); navigate('/dashboard'); } }}
            supportLink
         />
      );
   }

   if (step === 'confirm' && flow) {
      return (
         <ConfirmScreen
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
            onUseTraditionalKyc={() => void startKyc(flow)}
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
// Shown only on the World ID path, after the liveness pre-gate passes. (Traditional
// KYC now runs as one combined Didit session, so it has no intermediate confirm step.)

function ConfirmScreen({
   worldIdTrigger,
   onUseTraditionalKyc
}: {
   worldIdTrigger: ReactNode;
   onUseTraditionalKyc: () => void;
}) {
   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f] flex flex-col items-center justify-center max-w-modal mx-auto w-full px-md-4 py-md-5">
         <div className="flex flex-col items-center gap-md-3 text-center w-full">
            <p className="text-md-b3 font-semibold text-md-neutral-700 uppercase tracking-widest">
               Step 1 of 2 done
            </p>
            <img src="/icons/check-fill.svg" alt="" aria-hidden="true" className="w-16 h-16" />
            <div className="flex flex-col gap-md-1">
               <h1 className="text-md-display text-md-heading">You&rsquo;re a real person!</h1>
               <p className="text-md-b1 font-medium text-md-neutral-700">
                  You&rsquo;re not done yet — one last step. Verify with World ID below to finish and unlock your account.
               </p>
            </div>

            {worldIdTrigger}
            <p className="text-md-b3 font-medium text-md-neutral-700">
               Requires an Orb-verified World ID.
            </p>
            <button
               type="button"
               onClick={onUseTraditionalKyc}
               className="text-md-b2 font-medium text-md-neutral-700 underline underline-offset-2"
            >
               Use traditional KYC instead
            </button>
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
               <div className="flex flex-col gap-2 w-full pt-md-1">
                  <p className="text-md-b3 font-semibold text-md-neutral-700 text-center">Need help from our team?</p>
                  <a
                     href="https://t.me/jimmymoodengcredit"
                     target="_blank"
                     rel="noopener noreferrer"
                     className="flex items-center justify-center gap-2 w-full px-md-4 py-md-3 rounded-md-lg border-2 text-md-b2 font-semibold"
                     style={{ borderColor: '#229ED9', color: '#229ED9' }}
                  >
                     <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0" aria-hidden="true">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.48 14.697l-2.95-.924c-.642-.204-.654-.642.136-.953l11.527-4.445c.535-.194 1.003.131.37.873z"/>
                     </svg>
                     Message us on Telegram
                  </a>
                  <a
                     href="https://www.facebook.com/profile.php?id=61589106561061"
                     target="_blank"
                     rel="noopener noreferrer"
                     className="flex items-center justify-center gap-2 w-full px-md-4 py-md-3 rounded-md-lg border-2 text-md-b2 font-semibold"
                     style={{ borderColor: '#1877F2', color: '#1877F2' }}
                  >
                     <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0" aria-hidden="true">
                        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                     </svg>
                     Message us on Facebook
                  </a>
               </div>
            ) : null}
         </div>
      </div>
   );
}
