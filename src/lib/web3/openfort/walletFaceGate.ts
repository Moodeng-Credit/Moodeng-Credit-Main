// The face gate that stands in front of creating an embedded (Instant) wallet.
//
// Why a face scan at all: an embedded wallet is a smart account whose gas Moodeng's paymaster
// policy pays for, so each one is a standing cost. Nothing previously stopped one person
// opening thirty accounts and minting thirty sponsored wallets. A liveness + 1:N face scan
// turns "one wallet per account" into "one wallet per person".
//
// Scope — this is the whole rule: the scan fires ONLY when minting an embedded wallet.
// Connecting an external wallet (Base Account, MetaMask, Phantom, WalletConnect) never reaches
// here, and neither does signing up, funding, repaying or withdrawing.
//
// Enforcement lives server-side in the openfort-shield-session edge function, because wallet
// provisioning runs in the browser and only the Shield session mint requires our server.
// Everything in this file is a fast path to avoid a pointless round trip, plus the copy — it
// is NOT the security boundary, and must never be treated as one.

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { OPENFORT_WALLET_PROVIDER } from '@/lib/web3/openfort/config';
import type { User, WalletFaceStatus } from '@/types/authTypes';

/**
 * Master on/off switch for the whole embedded-wallet face gate. Default OFF, so the feature
 * ships dark: with it off the product behaves exactly as before this project — borrowers
 * create an instant wallet with no scan, lenders don't see the option. Flip it on only after
 * the real 2-face test passes.
 *
 * The server half of the switch is WALLET_FACE_GATE_ENABLED in the openfort-shield-session
 * edge function; BOTH must be on, because the server is the real enforcement point. Turn on
 * with VITE_WALLET_FACE_GATE_ENABLED=true (build) AND WALLET_FACE_GATE_ENABLED=true (function).
 */
export const WALLET_FACE_GATE_ENABLED = import.meta.env.VITE_WALLET_FACE_GATE_ENABLED === 'true';

/** Refusal codes returned by openfort-shield-session (mirrors may_mint_embedded_wallet). */
export const WALLET_GATE_CODE = {
   FACE_REQUIRED: 'FACE_REQUIRED',
   FACE_PENDING: 'FACE_PENDING',
   FACE_DUPLICATE: 'FACE_DUPLICATE',
   FACE_MISMATCH: 'FACE_MISMATCH',
   FACE_DECLINED: 'FACE_DECLINED',
   /**
    * NOT a wallet-creation refusal — the first-cash-out hold (20260820110000). The same endpoint
    * raises it because the Shield mint is the one chokepoint every wallet operation shares, but
    * it needs a DIFFERENT destination: the withdraw face check, not the wallet-creation one.
    */
   CASHOUT_FACE_REQUIRED: 'CASHOUT_FACE_REQUIRED'
} as const;

export type WalletGateCode = (typeof WALLET_GATE_CODE)[keyof typeof WALLET_GATE_CODE];

/** True when the refusal is the cash-out hold rather than anything about creating a wallet. */
export const isCashoutHoldCode = (code?: string | null): boolean => code === WALLET_GATE_CODE.CASHOUT_FACE_REQUIRED;

/** Codes a fresh scan can clear. DUPLICATE/MISMATCH are terminal — retrying only wastes a session. */
const RETRYABLE_CODES: ReadonlySet<string> = new Set<string>([
   WALLET_GATE_CODE.FACE_REQUIRED,
   WALLET_GATE_CODE.FACE_DECLINED,
   WALLET_GATE_CODE.CASHOUT_FACE_REQUIRED
]);

export const isRetryableGateCode = (code?: string | null): boolean => Boolean(code && RETRYABLE_CODES.has(code));

/** Thrown by the Shield-session client when the server refuses the mint. */
export class WalletGateError extends Error {
   readonly code: WalletGateCode | string;

   constructor(message: string, code: WalletGateCode | string) {
      super(message);
      this.name = 'WalletGateError';
      this.code = code;
   }
}

/** True when this account already holds an embedded wallet, so any mint is really a recovery. */
export const hasEmbeddedWallet = (user?: Pick<User, 'walletProvider' | 'walletAddress'> | null): boolean =>
   user?.walletProvider === OPENFORT_WALLET_PROVIDER && Boolean(user?.walletAddress);

/**
 * Whether to send the user through a face scan before attempting to mint.
 *
 * Recovery of an existing wallet never needs one — that path runs on every page reload and
 * before every send, and gating it would lock people out of their own money. Only a first
 * mint, with no live approval on file, needs the camera.
 */
/**
 * The scan-needed decision, IGNORING the master flag. Split out so the logic is unit-testable
 * without depending on a build-time env var. Recovery of an existing wallet never needs a scan;
 * a first mint with no live approval does.
 */
export const walletFaceScanRequiredForUser = (
   user?: Pick<User, 'walletProvider' | 'walletAddress' | 'walletFaceStatus'> | null
): boolean => {
   if (hasEmbeddedWallet(user)) return false;
   return user?.walletFaceStatus !== 'APPROVED';
};

export const needsWalletFaceScan = (user?: Pick<User, 'walletProvider' | 'walletAddress' | 'walletFaceStatus'> | null): boolean =>
   // Gate off → never scan; createInstantWallet falls straight through to openfort.connect(),
   // the pre-project borrower behaviour.
   WALLET_FACE_GATE_ENABLED && walletFaceScanRequiredForUser(user);

/** User-facing copy for a resolved scan. Keep in sync with GATE_MESSAGES in openfort-shield-session. */
export const walletFaceStatusCopy = (
   status?: WalletFaceStatus | null
): { title: string; body: string; canRetry: boolean } => {
   switch (status) {
      case 'DUPLICATE':
         return {
            title: 'This face already has a wallet',
            body: 'Each person can have one Moodeng instant wallet. If you already have a Moodeng account, sign in to that one — or connect a wallet you already own instead.',
            canRetry: false
         };
      case 'MISMATCH':
         return {
            title: "That doesn't match your verified ID",
            body: 'This account was verified with a different face. For your security we can only create the wallet for the verified account holder. Please scan again as the account holder, or contact support.',
            canRetry: false
         };
      case 'DECLINED':
         return {
            title: "We couldn't complete the scan",
            body: 'Find good, even lighting, remove hats or sunglasses, and hold your phone at eye level. Then try again.',
            canRetry: true
         };
      case 'PENDING':
         return { title: 'Checking your scan', body: 'This usually takes a few seconds.', canRetry: false };
      default:
         return {
            title: 'A quick face check',
            body: "It takes about ten seconds and keeps wallets to one per person. We don't store your photo.",
            canRetry: true
         };
   }
};

/**
 * Start a wallet face scan and return Didit's hosted URL.
 * The session id is pinned server-side to users.wallet_face_session_id, which is also how the
 * webhook knows this scan belongs to the wallet gate rather than the KYC liveness gate.
 */
export const startWalletFaceScan = async (): Promise<string> => {
   const supabase = getSupabaseBrowserClient();
   const { data, error } = await supabase.functions.invoke('create-didit-session', { body: { kind: 'wallet' } });

   if (error) {
      const response = (error as { context?: Response }).context;
      if (response) {
         const body = (await response
            .clone()
            .json()
            .catch(() => null)) as { error?: string; code?: string } | null;
         // An account that already holds a wallet doesn't need a scan — treat it as success
         // upstream rather than an error the user has to understand.
         if (body?.code === 'ALREADY_GRANTED') throw new WalletGateError(body.error ?? 'Already have a wallet.', 'ALREADY_GRANTED');
         if (body?.error) throw new Error(body.error);
      }
      throw error;
   }
   if (!data?.url) throw new Error('Could not start the face check. Please try again.');
   return data.url as string;
};

/**
 * Ask the server to re-read this scan's verdict straight from Didit.
 *
 * Needed because webhooks get lost or delayed — without a pull path a user whose webhook never
 * arrived would sit on a spinner forever. Mirrors how the KYC flow recovers.
 */
export const syncWalletFaceStatus = async (): Promise<string | null> => {
   try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.functions.invoke('check-didit-status', { body: { kind: 'wallet' } });
      if (error) return null;
      return (data?.status as string | undefined) ?? null;
   } catch {
      return null;
   }
};
