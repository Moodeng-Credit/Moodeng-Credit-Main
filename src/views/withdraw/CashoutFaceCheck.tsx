// The face check that stands in front of a borrower's FIRST cash-out from an embedded (Instant)
// wallet, Philippines only. See src/lib/withdraw/cashoutFaceGate.ts for why.
//
// Deliberately its OWN screen, same reasoning as onboarding/WalletFaceCheck.tsx: folding this
// into the withdraw flow's own step machine would risk regressing a flow that already has to
// handle Base Pay, wagmi and Openfort sends. Shape (redirect handling, lost-webhook recovery via
// polling + an on-demand sync) is copied from that screen on purpose — those behaviours were
// learned the hard way on real Philippine mobile networks.
//
// Reached from Withdraw.tsx's send() with router state {url, returnTo}. Also re-entered directly
// by Didit's own redirect (?kind=cashout), which does NOT carry that state — so every lookup
// here is keyed off the caller's OWN most recent check row, not off state that a hard navigation
// away and back would have dropped.

import { useCallback, useEffect, useRef, useState } from 'react';

import { useSelector } from 'react-redux';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { isAndroidDevice, isIOSDevice } from '@/components/worldId/worldIdLaunch';

import {
   type CashoutFaceStatus,
   cashoutFaceStatusCopy,
   getLatestCashoutFaceCheck,
   syncCashoutFaceStatus
} from '@/lib/withdraw/cashoutFaceGate';
import type { RootState } from '@/store/store';

import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';

const POLL_ATTEMPTS = 40;
const POLL_DELAY_MS = 3000;
const SYNC_EVERY_N_ATTEMPTS = 10;

const wait = (ms: number) =>
   new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
   });

const isMobileDevice = () => isIOSDevice() || isAndroidDevice();

type Step = 'intro' | 'polling' | 'waiting' | 'resolved';

const SCREEN_CLASS =
   'min-h-screen bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f] flex flex-col max-w-[440px] mx-auto w-full';

const PRIMARY_BUTTON_CLASS =
   'flex min-h-[56px] w-full items-center justify-center gap-md-1 rounded-[16px] bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 shadow-[0_18px_50px_rgba(96,16,210,0.24)] disabled:opacity-60';

const SECONDARY_BUTTON_CLASS =
   'min-h-[48px] w-full rounded-md-lg border border-md-primary-900 bg-transparent px-md-3 py-md-2 text-md-b2 font-semibold text-md-primary-900 disabled:opacity-60';

type LocationState = { url?: string; returnTo?: string } | null;

export default function CashoutFaceCheck() {
   const navigate = useNavigate();
   const location = useLocation();
   const [searchParams] = useSearchParams();
   const user = useSelector((state: RootState) => state.auth.user);

   const state = location.state as LocationState;
   const returnTo = state?.returnTo || '/withdraw';
   const scanUrl = state?.url;

   const [step, setStep] = useState<Step>(scanUrl ? 'intro' : 'polling');
   const [resolvedStatus, setResolvedStatus] = useState<CashoutFaceStatus | null>(null);
   const pollRunRef = useRef(0);
   const resumedRef = useRef(false);

   const poll = useCallback(
      async (options: { syncFirst?: boolean } = {}) => {
         const runId = (pollRunRef.current += 1);
         setStep('polling');

         for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
            if (pollRunRef.current !== runId) return;
            if (attempt > 0) await wait(POLL_DELAY_MS);
            if (pollRunRef.current !== runId) return;

            try {
               if (attempt % SYNC_EVERY_N_ATTEMPTS === 0 || (options.syncFirst && attempt === 0)) {
                  await syncCashoutFaceStatus();
                  if (pollRunRef.current !== runId) return;
               }

               const latest = user?.id ? await getLatestCashoutFaceCheck(user.id) : null;
               if (pollRunRef.current !== runId) return;

               const status = latest?.status;
               if (status === 'APPROVED') {
                  navigate(returnTo, { replace: true });
                  return;
               }
               if (status === 'MISMATCH' || status === 'DECLINED' || status === 'BLOCKED' || status === 'CONSUMED') {
                  setResolvedStatus(status);
                  setStep('resolved');
                  return;
               }
               // PENDING or no row yet — keep polling.
            } catch {
               // Transient network errors are expected on mobile — keep polling.
            }
         }

         if (pollRunRef.current === runId) setStep('waiting');
      },
      [navigate, returnTo, user?.id]
   );

   // Must stay a synchronous click handler so window.open counts as a user gesture.
   const openScan = useCallback(() => {
      if (!scanUrl) return;
      if (isMobileDevice()) {
         window.location.href = scanUrl;
         return;
      }
      const opened = window.open(scanUrl, '_blank');
      if (!opened) {
         window.location.href = scanUrl;
         return;
      }
      opened.opener = null;
      void poll();
   }, [poll, scanUrl]);

   // Returning from Didit: ?kind=cashout means the scan just finished (or was abandoned). No
   // router state survives that redirect, so sync + look up the caller's own latest row instead.
   useEffect(() => {
      if (resumedRef.current) return;
      if (searchParams.get('kind') !== 'cashout') return;
      resumedRef.current = true;
      void poll({ syncFirst: true });
   }, [poll, searchParams]);

   useEffect(
      () => () => {
         pollRunRef.current += 1;
      },
      []
   );

   if (!scanUrl && searchParams.get('kind') !== 'cashout') {
      // Reached with nothing to check (e.g. a stale bookmark) — nothing to do here.
      return <Navigate to={returnTo} replace />;
   }

   const copy = cashoutFaceStatusCopy(resolvedStatus);

   return (
      <div className={SCREEN_CLASS}>
         <OnboardingHeader
            title="Quick face check"
            tooltip="Since this is your first cash-out, we ask for a ten-second face check to confirm it's really you. We never store your photo."
         />

         <div className="flex flex-1 flex-col items-center justify-center gap-md-3 px-md-4 text-center">
            {step === 'resolved' ? (
               <>
                  <h2 className="text-[28px] font-semibold leading-[1.14] text-md-heading dark:text-md-neutral-100">{copy.title}</h2>
                  <p className="max-w-[320px] text-md-b1 font-medium leading-7 text-md-neutral-700">{copy.body}</p>
                  <div className="mt-md-2 flex w-full flex-col gap-md-2">
                     {copy.canRetry && scanUrl ? (
                        <button type="button" onClick={openScan} className={PRIMARY_BUTTON_CLASS}>
                           Try the scan again
                        </button>
                     ) : null}
                     <button
                        type="button"
                        onClick={() => navigate(returnTo, { replace: true })}
                        className={copy.canRetry ? SECONDARY_BUTTON_CLASS : PRIMARY_BUTTON_CLASS}
                     >
                        Back to withdraw
                     </button>
                  </div>
               </>
            ) : step === 'polling' ? (
               <>
                  <div className="size-12 animate-spin rounded-full border-4 border-md-primary-900 border-t-transparent" />
                  <h2 className="text-[28px] font-semibold leading-[1.14] text-md-heading dark:text-md-neutral-100">
                     Checking your scan
                  </h2>
                  <p className="max-w-[320px] text-md-b1 font-medium leading-7 text-md-neutral-700">
                     This usually takes a few seconds. Keep this screen open.
                  </p>
               </>
            ) : step === 'waiting' ? (
               <>
                  <h2 className="text-[28px] font-semibold leading-[1.14] text-md-heading dark:text-md-neutral-100">
                     Still checking
                  </h2>
                  <p className="max-w-[320px] text-md-b1 font-medium leading-7 text-md-neutral-700">
                     This is taking longer than usual. Your scan is safe — check again in a moment.
                  </p>
                  <div className="mt-md-2 flex w-full flex-col gap-md-2">
                     <button type="button" onClick={() => void poll({ syncFirst: true })} className={PRIMARY_BUTTON_CLASS}>
                        Check again
                     </button>
                  </div>
               </>
            ) : (
               <>
                  <h2 className="text-[28px] font-semibold leading-[1.14] text-md-heading dark:text-md-neutral-100">
                     One quick face check
                  </h2>
                  <p className="max-w-[320px] text-md-b1 font-medium leading-7 text-md-neutral-700">
                     Since this is your first cash-out, we ask for a ten-second scan to confirm it's really you before sending
                     any money out.
                  </p>
                  <div className="mt-md-2 flex w-full flex-col gap-md-2">
                     <button type="button" onClick={openScan} className={PRIMARY_BUTTON_CLASS}>
                        Open face scan
                     </button>
                     <button type="button" onClick={() => navigate(returnTo, { replace: true })} className={SECONDARY_BUTTON_CLASS}>
                        Cancel
                     </button>
                  </div>
               </>
            )}
         </div>
      </div>
   );
}
