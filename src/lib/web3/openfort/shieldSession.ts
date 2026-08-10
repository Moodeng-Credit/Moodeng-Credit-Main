// Client half of AUTOMATIC (self-custodial, no-password) recovery.
//
// Openfort's Shield splits the wallet key into shares. For AUTOMATIC recovery the SDK
// needs a short-lived "encryption session" minted with the Shield SECRET (project-level,
// never allowed in the browser). So we mint it server-side in the openfort-shield-session
// edge function — which authenticates the caller by their Supabase JWT — and hand the
// returned session id to `embeddedWallet.configure({ recoveryParams: { AUTOMATIC, encryptionSession } })`.
//
// This keeps the promise in the borrower onboarding copy true: Moodeng never sees or
// holds the key, and the user can still `exportPrivateKey()` to leave for MetaMask.

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

import { OPENFORT_SHIELD_SESSION_URL } from '@/lib/web3/openfort/config';
import { WalletGateError } from '@/lib/web3/openfort/walletFaceGate';

/**
 * Mint a one-time Shield encryption session id via the edge function.
 * Authenticated with the caller's Supabase session so an anonymous request can't
 * spend the project's Shield quota.
 */
export const createShieldEncryptionSession = async (): Promise<string> => {
   if (!OPENFORT_SHIELD_SESSION_URL) {
      throw new Error('Openfort Shield session endpoint is not configured.');
   }

   const {
      data: { session }
   } = await getSupabaseBrowserClient().auth.getSession();

   if (!session?.access_token) {
      throw new Error('You need to be signed in to create your instant wallet.');
   }

   const response = await fetch(OPENFORT_SHIELD_SESSION_URL, {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json',
         Authorization: `Bearer ${session.access_token}`
      }
   });

   if (!response.ok) {
      const detail = await response.text().catch(() => '');

      // A 403 here is the abuse gate, not a fault: the caller has no approved face scan on
      // file, or the face already holds a wallet. Surface it as a typed error so the UI can
      // route to the scan (or explain a terminal refusal) rather than show "something went wrong".
      if (response.status === 403) {
         const body = (() => {
            try {
               return JSON.parse(detail) as { error?: string; code?: string };
            } catch {
               return null;
            }
         })();
         throw new WalletGateError(
            body?.error ?? 'A quick face check is needed before we can create your instant wallet.',
            body?.code ?? 'FACE_REQUIRED'
         );
      }

      throw new Error(`Could not start wallet recovery session (${response.status}). ${detail}`.trim());
   }

   const body = (await response.json()) as { session_id?: string; sessionId?: string };
   const sessionId = body.session_id ?? body.sessionId;
   if (!sessionId) {
      throw new Error('Wallet recovery session response was missing a session id.');
   }
   return sessionId;
};
