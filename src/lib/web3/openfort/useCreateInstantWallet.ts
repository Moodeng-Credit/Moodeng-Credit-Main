// One place that knows how to create an embedded (Instant) wallet from a tap.
//
// Two surfaces start this flow — onboarding (ConnectWallet) and Account Settings — and they
// must behave identically, because the differences are exactly the kind that produce a
// wallet on one screen and a dead end on the other. Notably: dropping the live wagmi session
// first, and choosing between "needs a face check" and "this is just a recovery".

import { useCallback } from 'react';

import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useDisconnect } from 'wagmi';

import { isCashoutHoldCode, needsWalletFaceScan } from '@/lib/web3/openfort/walletFaceGate';
import { useOpenfort } from '@/lib/web3/openfort/OpenfortContext';
import type { RootState } from '@/store/store';

/**
 * Where to send the user once the wallet exists — the same short enum the onboarding flow
 * uses. Typed as a plain string because callers read it out of route state or the query
 * string; the values are only ever echoed back into in-app navigation, never into a URL the
 * server redirects to (create-didit-session keeps its own allowlist for that).
 */
export type InstantWalletReturnTo = string;

export const useCreateInstantWallet = (returnTo?: InstantWalletReturnTo) => {
   const navigate = useNavigate();
   const openfort = useOpenfort();
   const { disconnectAsync } = useDisconnect();
   const user = useSelector((state: RootState) => state.auth.user);

   const createInstantWallet = useCallback(async () => {
      // Drop any live wagmi session first. useWalletSync re-saves a connected wallet whenever
      // the stored address is empty, so leaving one live here would silently re-lock the user
      // onto the wallet they just disconnected instead of giving them the instant wallet.
      await disconnectAsync().catch(() => undefined);

      // A first mint needs the face check; recovering an existing wallet never does — that
      // path runs on every page reload and before every send.
      if (needsWalletFaceScan(user)) {
         navigate('/onboarding/wallet/face-check', { state: returnTo ? { returnTo } : undefined });
         return;
      }

      const address = await openfort.connect();
      if (address) {
         navigate('/onboarding/wallet/connected', { replace: true, state: returnTo ? { returnTo } : undefined });
         return;
      }

      // The server is the authority, so it can still refuse after the local check passed —
      // a stale approval, or another tab that already spent it. Send them to the scan, which
      // explains a terminal refusal rather than looping them through a retry.
      if (openfort.gateCode) {
         // The cash-out hold is a different refusal arriving through the same endpoint: the
         // wallet already exists and is fine, it's the undrawn first loan that needs a face
         // check. Routing that to the wallet-creation scan would tell someone to create a
         // wallet they already have.
         navigate(isCashoutHoldCode(openfort.gateCode) ? '/withdraw/face-check' : '/onboarding/wallet/face-check', {
            state: returnTo ? { returnTo } : undefined
         });
      }
   }, [disconnectAsync, navigate, openfort, returnTo, user]);

   return {
      createInstantWallet,
      isCreating: openfort.isConnecting,
      isConfigured: openfort.isConfigured,
      error: openfort.error
   };
};
