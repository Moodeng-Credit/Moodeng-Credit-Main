// One place that knows how to create an embedded (Instant) wallet from a tap.
//
// Two surfaces start this flow — onboarding (ConnectWallet) and Account Settings — and they
// must behave identically, because the differences are exactly the kind that produce a
// wallet on one screen and a dead end on the other. Notably: dropping the live wagmi session
// first, and choosing between "needs a face check" and "this is just a recovery".
import { useCallback, useState } from 'react';

import { useNavigate } from 'react-router-dom';
import { useDisconnect } from 'wagmi';

import type { WalletSetupPhase } from '@/lib/web3/openfort/embeddedWallet';
import { useOpenfort } from '@/lib/web3/openfort/OpenfortContext';
import { isCashoutHoldCode } from '@/lib/web3/openfort/walletFaceGate';

/**
 * Where to send the user once the wallet exists — the same short enum the onboarding flow
 * uses. Typed as a plain string because callers read it out of route state or the query
 * string; the values are only ever echoed back into in-app navigation, never into a URL the
 * server redirects to (create-didit-session keeps its own allowlist for that).
 */
export type InstantWalletReturnTo = string;

const DONE_PAUSE_MS = 700;

export const useCreateInstantWallet = (returnTo?: InstantWalletReturnTo) => {
   const navigate = useNavigate();
   const openfort = useOpenfort();
   const { disconnectAsync } = useDisconnect();
   // Which stage the wallet setup is in, for the progress shown inside the button. Local to the
   // screen that started it, so it's gone the next time anyone lands on a wallet screen.
   const [phase, setPhase] = useState<WalletSetupPhase | null>(null);

   const createInstantWallet = useCallback(async () => {
      // Drop any live wagmi session first. useWalletSync re-saves a connected wallet whenever
      // the stored address is empty, so leaving one live here would silently re-lock the user
      // onto the wallet they just disconnected instead of giving them the instant wallet.
      await disconnectAsync().catch(() => undefined);

      // No face check before creating an Instant Wallet (removed 2026-09-26, see migration
      // 20260926110000_instant_wallet_no_face_scan): Didit's biometric workflow needed a face already
      // on file, so most people could never pass it.
      const address = await openfort.connect(setPhase);
      if (address) {
         // Let "Done" show for a beat so the last step lands before the screen changes.
         await new Promise((resolve) => setTimeout(resolve, DONE_PAUSE_MS));
         navigate('/onboarding/wallet/connected', { replace: true, state: returnTo ? { returnTo } : undefined });
         return;
      }

      // The server is the authority, so it can still refuse after the local check passed —
      // a stale approval, or another tab that already spent it. Send them to the scan, which
      // explains a terminal refusal rather than looping them through a retry.
      setPhase(null);
      if (openfort.gateCode) {
         // The cash-out hold is a different refusal arriving through the same endpoint: the
         // wallet already exists and is fine, it's the undrawn first loan that needs a face
         // check. Routing that to the wallet-creation scan would tell someone to create a
         // wallet they already have.
         navigate(isCashoutHoldCode(openfort.gateCode) ? '/withdraw/face-check' : '/onboarding/wallet/face-check', {
            state: returnTo ? { returnTo } : undefined
         });
      }
   }, [disconnectAsync, navigate, openfort, returnTo]);

   return {
      createInstantWallet,
      isCreating: openfort.isConnecting || phase !== null,
      phase,
      isConfigured: openfort.isConfigured,
      error: openfort.error
   };
};
