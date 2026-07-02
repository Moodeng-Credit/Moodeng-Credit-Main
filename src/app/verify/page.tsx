import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import WorldIDVerification from '@/components/worldId/WorldIDVerification';

import { isUserVerified } from '@/lib/isUserVerified';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
   clearVerifyFlow,
   readVerifyFlow,
   writeVerifyFlow,
   type FlowState,
   type VerifyMethod
} from '@/lib/verifyFlow';
import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

const STATUS_REFRESH_RETRIES = 40;
const STATUS_REFRESH_DELAY_MS = 3000;

const wait = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });

type Step =
   | 'loading'
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
   | 'id-abandoned'
   | 'duplicate'
   | 'declined'
   | 'success'
   | 'error';

// Steps a poll must never overwrite back to a "pending" screen. Guarding the
// initial setStep against these prevents the confirm/success screen from
// flickering back to a button-less waiting screen when a poll (re)starts.
const TERMINAL_STEPS = new Set<Step>(['confirm', 'duplicate', 'declined', 'success', 'id-review', 'id-declined', 'id-abandoned']);

// Flow persistence lives in a shared module so the request board can read the
// same "started verifying but never finished" signal to show its support modal.
const readFlow = readVerifyFlow;
const writeFlow = writeVerifyFlow;
const clearFlow = clearVerifyFlow;

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
   const [livenessUrl, setLivenessUrl] = useState<string | null>(null);
   // Monotonic run token: only the latest poll may mutate step. Bumping it makes
   // any earlier poll bail on its next check, so a superseded loop can't stomp state.
   const pollRunRef = useRef(0);
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
               else if (rawStatus === 'abandoned' || rawStatus === 'expired') setStep('id-abandoned');
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

   // Fetches a Didit liveness URL and shows the "Open face scan" button.
   // Does NOT navigate the current tab away — the user opens Didit in a new tab
   // via handleOpenLiveness so we can keep polling here.
   const startLiveness = useCallback(async (flow: FlowState) => {
      setErrorMessage('');
      setLivenessUrl(null);
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
         setLivenessUrl(url);
      } catch (err) {
         setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
         setStep('error');
      }
   }, []);

   const pollLiveness = useCallback(
      async (flow: FlowState) => {
         const runId = (pollRunRef.current += 1);
         // Don't yank a confirm/terminal screen back to a pending screen if this
         // poll starts after we've already advanced.
         setStep((prev) => (TERMINAL_STEPS.has(prev) ? prev : 'liveness-pending'));

         for (let attempt = 0; attempt < STATUS_REFRESH_RETRIES; attempt++) {
            if (pollRunRef.current !== runId) return;
            if (attempt > 0) await wait(STATUS_REFRESH_DELAY_MS);
            if (pollRunRef.current !== runId) return;

            try {
               const refreshed = await dispatch(fetchUser()).unwrap();
               if (pollRunRef.current !== runId) return;
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

         if (pollRunRef.current === runId) setStep('liveness-waiting');
      },
      [dispatch]
   );

   // Called by the "Open face scan" button — must be a synchronous click handler so
   // window.open is treated as a user gesture and isn't blocked as a popup.
   const handleOpenLiveness = useCallback(() => {
      if (!livenessUrl) return;
      const opened = window.open(livenessUrl, '_blank');
      if (!opened) {
         // Popup blocked — fall back to navigating the current tab (old behaviour).
         window.location.href = livenessUrl;
         return;
      }
      opened.opener = null;
      const currentFlow = readFlow();
      if (currentFlow) void pollLiveness(currentFlow);
   }, [livenessUrl, pollLiveness]);

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

   const pollDidit = useCallback(async (retries: number = STATUS_REFRESH_RETRIES) => {
      const runId = (pollRunRef.current += 1);
      setIsChecking(true);
      // Don't yank a terminal screen back to a pending screen if this poll starts late.
      setStep((prev) => (TERMINAL_STEPS.has(prev) ? prev : 'id-pending'));

      for (let attempt = 0; attempt < retries; attempt++) {
         if (pollRunRef.current !== runId) {
            setIsChecking(false);
            return;
         }
         if (attempt > 0) await wait(STATUS_REFRESH_DELAY_MS);
         if (pollRunRef.current !== runId) {
            setIsChecking(false);
            return;
         }

         try {
            const refreshed = await dispatch(fetchUser()).unwrap();
            if (pollRunRef.current !== runId) {
               setIsChecking(false);
               return;
            }
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
            if (rawStatus === 'abandoned' || rawStatus === 'expired') {
               setIsChecking(false);
               setStep('id-abandoned');
               return;
            }
         } catch {
            // Ignore transient errors and keep polling.
         }
      }

      if (pollRunRef.current !== runId) return;
      setIsChecking(false);
      // After 2 minutes with no Approved/Review/Declined, show the waiting screen.
      // A background slow-poll (useEffect below) keeps checking every 60s from here.
      setStep('id-waiting');
   }, [dispatch]);

   // One-shot status check for parked screens (waiting/review). Used on tab focus so
   // returning from the Didit tab updates instantly without restarting the 2-min poll
   // loop (which would demote the screen back to a button-less spinner).
   const checkStatusOnce = useCallback(async () => {
      try {
         const refreshed = await dispatch(fetchUser()).unwrap();
         if (refreshed.isDidit === 'ACTIVE') {
            setStep('success');
            return;
         }
         const rawStatus = refreshed.diditIdStatus?.toLowerCase() ?? '';
         if (rawStatus === 'duplicate') setStep('duplicate');
         else if (rawStatus.includes('review')) setStep('id-review');
         else if (rawStatus === 'declined') setStep('id-declined');
         else if (rawStatus === 'abandoned' || rawStatus === 'expired') setStep('id-abandoned');
      } catch {
         // Transient network error — the background slow-poll will catch up.
      }
   }, [dispatch]);

   // Instant re-check when the user returns to this tab (e.g. after finishing —
   // or abandoning — the Didit tab), instead of waiting for the next slow poll.
   useEffect(() => {
      const onFocus = () => {
         if (document.visibilityState !== 'visible') return;
         if (step === 'id-waiting' || step === 'id-review') {
            void checkStatusOnce();
            return;
         }
         if (step === 'liveness-waiting') {
            const currentFlow = readFlow();
            if (currentFlow) void pollLiveness(currentFlow);
         }
      };
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onFocus);
      return () => {
         window.removeEventListener('focus', onFocus);
         document.removeEventListener('visibilitychange', onFocus);
      };
   }, [step, checkStatusOnce, pollLiveness]);

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
         // Session already created (status set to PENDING by create-didit-session) — the user
         // returned manually before Didit redirected back. Poll for the result instead of
         // restarting a new session.
         if (user?.livenessStatus === 'PENDING') {
            void pollLiveness(flow);
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

      // Status-aware resume: the user already submitted Didit documents in an earlier
      // session (dashboard "View status" lands here with no flow state, and the
      // localStorage flow expires after 1h). Surface their real status from the DB
      // instead of bouncing to the dashboard or — worse — restarting a new session.
      const rawStatus = user?.diditIdStatus?.toLowerCase() ?? '';
      if (rawStatus === 'duplicate') {
         setStep('duplicate');
         return;
      }
      if (rawStatus.includes('review')) {
         setStep('id-review');
         return;
      }
      if (rawStatus === 'declined') {
         setStep('id-declined');
         return;
      }
      if (rawStatus === 'abandoned' || rawStatus === 'expired') {
         setStep('id-abandoned');
         return;
      }
      if (user?.diditSubmittedAt) {
         // Submitted but no webhook verdict yet — short poll (~15s), then park on the
         // waiting screen. A long blind poll here would strand users who quit Didit
         // mid-session (no verdict exists yet) on a button-less spinner for 2 minutes.
         void pollDidit(5);
         return;
      }

      if (existing) {
         begin(existing);
         return;
      }
      navigate('/dashboard', { replace: true });
   }, [location, navigate, navigateAfterVerified, pollDidit, pollLiveness, startKyc, startLiveness, user]);

   // On unmount, bump the run token so any in-flight poll bails on its next check.
   useEffect(() => () => {
      pollRunRef.current += 1;
   }, []);

   const flow = readFlow();
   // Fallback flow for retry buttons on screens reached via status-resume, where the
   // localStorage flow has expired (it has a 1h TTL — manual reviews take longer).
   const retryFlow: FlowState = flow ?? { method: 'didit' };

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

   if (step === 'liveness-start') {
      if (livenessUrl) {
         const step2Hint = flow?.method === 'worldid'
            ? "Then you'll verify with World ID in this tab."
            : "Then you'll submit your national ID in this tab.";
         return (
            <StatusScreen
               stepLabel="Step 1 of 2"
               visual="orbit"
               title="Ready for face scan"
               body={`Tap the button to open the face scan in a new tab. Keep this page open — it will update automatically when done. ${step2Hint}`}
               action={{ label: 'Open face scan', onClick: handleOpenLiveness }}
            />
         );
      }
      return (
         <StatusScreen
            stepLabel="Step 1 of 2"
            visual="orbit"
            title="Setting up…"
            body="Starting your verification. Keep this screen open."
         />
      );
   }

   if (step === 'id-start') {
      return (
         <StatusScreen
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
         : 'Face scan in progress. Complete it in the tab that just opened — this page will update automatically when done.';
      return (
         <StatusScreen
            stepLabel="Step 1 of 2"
            visual="orbit"
            title="Waiting for face scan…"
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
            body="Your details are with Didit. Most checks finish in a few minutes — we'll update this screen automatically when done. Left before finishing all the steps? Start over below."
            action={{ label: 'Check status', onClick: async () => { setIsChecking(true); await pollDidit(5); setIsChecking(false); }, loading: isChecking }}
            secondaryAction={{ label: 'Start over', onClick: () => void startKyc(retryFlow) }}
            tertiaryAction={{ label: 'Go to dashboard', onClick: () => navigate('/dashboard') }}
            supportLink
         />
      );
   }

   if (step === 'id-review') {
      return (
         <StatusScreen
            visual="orbit"
            title="Manual review in progress"
            body="Your verification needs a quick human review — this usually takes a few hours but can take up to 1 business day. We'll update your status automatically. Want it faster? Message us below and we'll expedite your review."
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
            action={{ label: 'Try again', onClick: () => void startKyc(retryFlow) }}
            secondaryAction={{ label: 'Go to dashboard', onClick: () => navigate('/dashboard') }}
            supportLink
         />
      );
   }

   if (step === 'id-abandoned') {
      return (
         <StatusScreen
            title="Verification wasn't finished"
            body="It looks like the verification was closed before all the steps were completed, so Didit couldn't finish checking your identity. No problem — you can start over any time."
            action={{ label: 'Start over', onClick: () => void startKyc(retryFlow) }}
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
   tertiaryAction,
   supportLink,
}: {
   stepLabel?: string;
   visual?: 'orbit' | 'orbit-success' | 'static';
   title: string;
   body: string;
   tips?: string[];
   action?: { label: string; onClick: () => void; loading?: boolean };
   secondaryAction?: { label: string; onClick: () => void };
   tertiaryAction?: { label: string; onClick: () => void };
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

            {tertiaryAction ? (
               <button
                  type="button"
                  onClick={tertiaryAction.onClick}
                  className="text-md-b2 font-medium text-md-neutral-700 underline underline-offset-2"
               >
                  {tertiaryAction.label}
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
