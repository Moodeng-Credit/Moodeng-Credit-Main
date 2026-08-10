// The face check that stands in front of creating an embedded (Instant) wallet.
//
// It is deliberately its OWN screen rather than a branch of /verify. The KYC flow there is a
// large state machine covering World ID, Didit documents and manual review; folding a wallet
// scan into it would risk regressing identity verification for a feature that only needs one
// question answered: is this a live person who doesn't already have a wallet?
//
// Fires ONLY when minting a wallet. Connecting an external wallet never routes here.
//
// Shape mirrors the liveness step in src/app/verify/page.tsx on purpose — same redirect
// handling, same lost-webhook recovery — because those behaviours were learned the hard way
// on real Philippine mobile networks.

import { useCallback, useEffect, useRef, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { isAndroidDevice, isIOSDevice } from '@/components/worldId/worldIdLaunch';

import {
   hasEmbeddedWallet,
   startWalletFaceScan,
   syncWalletFaceStatus,
   useOpenfort,
   walletFaceStatusCopy,
   WalletGateError
} from '@/lib/web3/openfort';
import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { WalletFaceStatus } from '@/types/authTypes';
import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';

const POLL_ATTEMPTS = 40;
const POLL_DELAY_MS = 3000;
// Pull the truth straight from Didit every Nth attempt (~30s) so a lost webhook can't strand
// someone on a spinner — the same failure the KYC flow already had to solve.
const SYNC_EVERY_N_ATTEMPTS = 10;

const wait = (ms: number) =>
   new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
   });

// On phones the scan runs in THIS tab (Didit redirects back here). The desktop two-tab
// pattern is confusing on mobile, where tabs are hidden away.
const isMobileDevice = () => isIOSDevice() || isAndroidDevice();

type Step = 'intro' | 'starting' | 'ready' | 'polling' | 'waiting' | 'resolved' | 'minting' | 'error';

const SCREEN_CLASS =
   'min-h-screen bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f] flex flex-col max-w-[440px] mx-auto w-full';

const PRIMARY_BUTTON_CLASS =
   'flex min-h-[56px] w-full items-center justify-center gap-md-1 rounded-[16px] bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 shadow-[0_18px_50px_rgba(96,16,210,0.24)] disabled:opacity-60';

const SECONDARY_BUTTON_CLASS =
   'min-h-[48px] w-full rounded-md-lg border border-md-primary-900 bg-transparent px-md-3 py-md-2 text-md-b2 font-semibold text-md-primary-900 disabled:opacity-60';

export default function WalletFaceCheck() {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const location = useLocation();
   const [searchParams] = useSearchParams();
   const user = useSelector((state: RootState) => state.auth.user);
   const openfort = useOpenfort();

   const returnTo =
      (location.state as { returnTo?: string } | null)?.returnTo || searchParams.get('returnTo') || undefined;

   const [step, setStep] = useState<Step>('intro');
   const [scanUrl, setScanUrl] = useState<string | null>(null);
   const [errorMessage, setErrorMessage] = useState('');
   const [resolvedStatus, setResolvedStatus] = useState<WalletFaceStatus | null>(null);
   const pollRunRef = useRef(0);
   // Didit sends the user back with ?kind=wallet; resume exactly once per arrival.
   const resumedRef = useRef(false);

   // Mint the wallet now that the scan passed. The server re-checks the gate — this is a
   // convenience path, not the authority — so a tampered client just gets a 403 here.
   const mintWallet = useCallback(async () => {
      setStep('minting');
      setErrorMessage('');
      const address = await openfort.connect();
      if (address) {
         navigate('/onboarding/wallet/connected', { replace: true, state: { returnTo } });
         return;
      }
      // connect() surfaces its own message; show it inline rather than a bare failure.
      setErrorMessage(openfort.error ?? "We couldn't finish creating your wallet. Please try again.");
      setStep('error');
   }, [navigate, openfort, returnTo]);

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
                  await syncWalletFaceStatus();
                  if (pollRunRef.current !== runId) return;
               }

               const refreshed = await dispatch(fetchUser()).unwrap();
               if (pollRunRef.current !== runId) return;

               const status = refreshed.walletFaceStatus;
               // CONSUMED means the approval was already spent on a mint — treat it as done
               // rather than looping, otherwise a double-tap strands the user on a spinner.
               if (status === 'APPROVED' || status === 'CONSUMED') {
                  void mintWallet();
                  return;
               }
               if (status === 'DUPLICATE' || status === 'MISMATCH' || status === 'DECLINED') {
                  setResolvedStatus(status);
                  setStep('resolved');
                  return;
               }
            } catch {
               // Transient network errors are expected on mobile — keep polling.
            }
         }

         if (pollRunRef.current === runId) setStep('waiting');
      },
      [dispatch, mintWallet]
   );

   const startScan = useCallback(async () => {
      setErrorMessage('');
      setScanUrl(null);
      setStep('starting');
      try {
         const url = await startWalletFaceScan();
         setScanUrl(url);
         setStep('ready');
      } catch (err) {
         // Someone who already holds a wallet doesn't need a scan at all — send them straight
         // to the mint (which will take the recovery path server-side).
         if (err instanceof WalletGateError && err.code === 'ALREADY_GRANTED') {
            void mintWallet();
            return;
         }
         setErrorMessage(err instanceof Error ? err.message : 'Could not start the face check. Please try again.');
         setStep('error');
      }
   }, [mintWallet]);

   // Must stay a synchronous click handler so window.open counts as a user gesture and isn't
   // swallowed by the popup blocker.
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

   // Returning from Didit: ?kind=wallet means the scan just finished (or was abandoned).
   // Sync first so an abandoned session resolves immediately instead of polling for two minutes.
   useEffect(() => {
      if (resumedRef.current) return;
      if (searchParams.get('kind') !== 'wallet') return;
      resumedRef.current = true;
      void poll({ syncFirst: true });
   }, [poll, searchParams]);

   // A scan already in flight (e.g. the user reloaded mid-check) should resume, not restart.
   useEffect(() => {
      if (resumedRef.current) return;
      if (user?.walletFaceStatus !== 'PENDING') return;
      resumedRef.current = true;
      void poll({ syncFirst: true });
   }, [poll, user?.walletFaceStatus]);

   useEffect(
      () => () => {
         // Cancel any in-flight poll when the screen unmounts.
         pollRunRef.current += 1;
      },
      []
   );

   if (!user?.userRole) {
      return <Navigate to="/onboarding/role" replace />;
   }

   // Already holds an embedded wallet — there is nothing to gate.
   if (hasEmbeddedWallet(user)) {
      return <Navigate to="/onboarding/wallet/connected" replace state={{ returnTo }} />;
   }

   if (!openfort.isConfigured) {
      return <Navigate to="/onboarding/wallet" replace state={{ returnTo }} />;
   }

   const copy = walletFaceStatusCopy(resolvedStatus);

   return (
      <div className={SCREEN_CLASS}>
         <OnboardingHeader
            title="Quick face check"
            tooltip="A short liveness scan keeps instant wallets to one per person, which is what lets us cover the network fees. We never store your photo, and it is only needed to create the wallet — not to sign in, send or repay."
         />

         <div className="flex flex-1 flex-col items-center justify-center gap-md-3 px-md-4 text-center">
            {step === 'resolved' ? (
               <>
                  <img src="/hippos/hippo-wallet.png" alt="" className="mb-md-2 h-24 w-auto max-w-[180px] object-contain" />
                  <h2 className="text-[28px] font-semibold leading-[1.14] text-md-heading dark:text-md-neutral-100">{copy.title}</h2>
                  <p className="max-w-[320px] text-md-b1 font-medium leading-7 text-md-neutral-700">{copy.body}</p>
                  <div className="mt-md-2 flex w-full flex-col gap-md-2">
                     {copy.canRetry ? (
                        <button type="button" onClick={() => void startScan()} className={PRIMARY_BUTTON_CLASS}>
                           Try the scan again
                        </button>
                     ) : null}
                     <button
                        type="button"
                        onClick={() => navigate('/onboarding/wallet', { replace: true, state: { returnTo } })}
                        className={copy.canRetry ? SECONDARY_BUTTON_CLASS : PRIMARY_BUTTON_CLASS}
                     >
                        Connect a wallet instead
                     </button>
                  </div>
               </>
            ) : step === 'polling' || step === 'minting' ? (
               <>
                  <div className="size-12 animate-spin rounded-full border-4 border-md-primary-900 border-t-transparent" />
                  <h2 className="text-[28px] font-semibold leading-[1.14] text-md-heading dark:text-md-neutral-100">
                     {step === 'minting' ? 'Creating your wallet' : 'Checking your scan'}
                  </h2>
                  <p className="max-w-[320px] text-md-b1 font-medium leading-7 text-md-neutral-700">
                     {step === 'minting'
                        ? 'This takes a few seconds. Keep this screen open.'
                        : 'This usually takes a few seconds. Keep this screen open.'}
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
                     <button type="button" onClick={() => void startScan()} className={SECONDARY_BUTTON_CLASS}>
                        Start a new scan
                     </button>
                  </div>
               </>
            ) : (
               <>
                  <img src="/hippos/hippo-wallet.png" alt="" className="mb-md-2 h-28 w-auto max-w-[200px] object-contain" />
                  <h2 className="text-[28px] font-semibold leading-[1.14] text-md-heading dark:text-md-neutral-100">
                     One quick face check
                  </h2>
                  <p className="max-w-[320px] text-md-b1 font-medium leading-7 text-md-neutral-700">
                     Instant wallets are one per person, so we ask for a ten-second scan before creating yours. You will not
                     need it again.
                  </p>

                  {errorMessage ? (
                     <p className="max-w-[340px] text-md-b3 font-medium text-md-red-500">{errorMessage}</p>
                  ) : null}

                  <div className="mt-md-2 flex w-full flex-col gap-md-2">
                     {step === 'ready' && scanUrl ? (
                        <button type="button" onClick={openScan} className={PRIMARY_BUTTON_CLASS}>
                           Open face scan
                        </button>
                     ) : (
                        <button
                           type="button"
                           onClick={() => void startScan()}
                           disabled={step === 'starting'}
                           className={PRIMARY_BUTTON_CLASS}
                        >
                           {step === 'starting' ? 'Starting…' : 'Start face check'}
                        </button>
                     )}
                     <button
                        type="button"
                        onClick={() => navigate('/onboarding/wallet', { replace: true, state: { returnTo } })}
                        className={SECONDARY_BUTTON_CLASS}
                     >
                        Connect a wallet I already own
                     </button>
                  </div>
               </>
            )}
         </div>
      </div>
   );
}
