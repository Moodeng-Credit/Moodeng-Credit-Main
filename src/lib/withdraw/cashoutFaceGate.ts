// The face gate that stands in front of a borrower's FIRST cash-out from an embedded (Instant)
// wallet, Philippines only.
//
// Why: a borrower's partner learned she had just been funded, took her unlocked phone, and
// cashed the loan out to his own account. Device, session and wallet were all legitimate, so
// nothing that checks "is this the right device/session" can ever catch this. The decision this
// gate makes is a 1:1 face match against the portrait from the account's ORIGINAL KYC session —
// not just "is a live human present" (he is also a live human). See
// supabase/functions/_shared/diditFaceSearch.ts (resolveCashoutFaceOutcome) for the server logic.
//
// Enforcement lives server-side: create-didit-session decides (via cashout_face_gate_required)
// whether a scan is even needed before spending a Didit credit, and didit-webhook/
// check-didit-status are the only writers of a check's status. Everything in this file is a
// convenience wrapper around those calls plus the copy — it is NOT the security boundary.
//
// Scope note: this gates the withdraw-flow UI only (layer (a) in the design). It does NOT yet
// gate Openfort Shield-session minting (layer (b)) or the private-key export screen — both are
// known, deliberate gaps for a later pass; see the plan doc.

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Master on/off switch, mirroring VITE_WALLET_FACE_GATE_ENABLED's pattern. Default OFF so the
 * feature ships dark. The server half is CASHOUT_FACE_GATE_ENABLED — both must be on, because
 * cashout_face_gate_required (server) is the actual authority on whether a scan is required.
 */
export const CASHOUT_FACE_GATE_ENABLED = import.meta.env.VITE_CASHOUT_FACE_GATE_ENABLED === 'true';

export type CashoutFaceStatus = 'PENDING' | 'APPROVED' | 'MISMATCH' | 'DECLINED' | 'BLOCKED' | 'CONSUMED';

export class CashoutGateError extends Error {
   readonly code: string;
   constructor(message: string, code: string) {
      super(message);
      this.name = 'CashoutGateError';
      this.code = code;
   }
}

/** User-facing copy for a resolved (or in-flight) cash-out face check. */
export const cashoutFaceStatusCopy = (
   status?: CashoutFaceStatus | null
): { title: string; body: string; canRetry: boolean } => {
   switch (status) {
      case 'MISMATCH':
         return {
            title: "This doesn't match the account holder",
            body: 'For your protection we could not confirm this is the person who verified this account. This cash-out has been held and our team has been notified. Please contact support.',
            canRetry: false
         };
      case 'BLOCKED':
         return {
            title: 'We need to verify you manually',
            body: "We couldn't find a reference photo on file to check against. Please contact support to complete this cash-out.",
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
            title: 'Quick check before you cash out',
            body: "Since this is your first cash-out, we need a quick face check to confirm it's really you. It takes about ten seconds.",
            canRetry: true
         };
   }
};

type StartCashoutFaceCheckResult =
   | { required: false }
   | { required: true; url: string; checkId: string | null };

/**
 * Start an "unlock" face check — one with no transfer to bind to.
 *
 * Needed because the wallet-level hold (cashout_gate_holds_wallet) can refuse someone who isn't
 * in the withdraw flow at all: the private-key export screen, or a plain connect. Without this
 * they'd be told a face check is required with no way to take one, which is a dead end.
 *
 * Passing it clears the 24h wallet hold and authorises NO specific send — the withdraw step still
 * asks for its own destination-bound check before money moves.
 */
export const startCashoutUnlockCheck = async (): Promise<StartCashoutFaceCheckResult> => {
   const supabase = getSupabaseBrowserClient();
   const { data, error } = await supabase.functions.invoke('create-didit-session', { body: { kind: 'cashout' } });

   if (error) {
      const response = (error as { context?: Response }).context;
      if (response) {
         const body = (await response
            .clone()
            .json()
            .catch(() => null)) as { error?: string; code?: string } | null;
         if (body?.error) throw new CashoutGateError(body.error, body.code ?? 'ERROR');
      }
      throw error;
   }

   if (data?.required === false) return { required: false };
   if (!data?.url) throw new Error('Could not start the face check. Please try again.');
   return { required: true, url: data.url as string, checkId: (data.checkId as string | undefined) ?? null };
};

/**
 * Ask the server whether this cash-out needs a scan, and — if so — start it.
 *
 * `destinationAddress`/`amount` bind the resulting approval to this exact transfer (see
 * cashout_face_gate_required / consume_cashout_face_check): change either and the caller will be
 * asked to scan again. Returns `{required:false}` immediately, with no Didit session created, for
 * every case out of scope (external wallet, non-PH, repeat borrower, or an already-valid
 * same-transfer approval).
 */
export const startCashoutFaceCheck = async (args: {
   destinationAddress: string;
   amount: number;
   loanId?: string | null;
}): Promise<StartCashoutFaceCheckResult> => {
   if (!CASHOUT_FACE_GATE_ENABLED) return { required: false };

   const supabase = getSupabaseBrowserClient();
   const { data, error } = await supabase.functions.invoke('create-didit-session', {
      body: {
         kind: 'cashout',
         destinationAddress: args.destinationAddress,
         amount: args.amount,
         ...(args.loanId ? { loanId: args.loanId } : {})
      }
   });

   if (error) {
      const response = (error as { context?: Response }).context;
      if (response) {
         const body = (await response
            .clone()
            .json()
            .catch(() => null)) as { error?: string; code?: string } | null;
         if (body?.error) throw new CashoutGateError(body.error, body.code ?? 'ERROR');
      }
      throw error;
   }

   if (data?.required === false) return { required: false };
   if (!data?.url) throw new Error('Could not start the face check. Please try again.');
   return { required: true, url: data.url as string, checkId: (data.checkId as string | undefined) ?? null };
};

/**
 * Ask the server to re-read the pending scan's verdict straight from Didit.
 * Needed because webhooks get lost or delayed — mirrors syncWalletFaceStatus.
 */
export const syncCashoutFaceStatus = async (): Promise<string | null> => {
   try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.functions.invoke('check-didit-status', { body: { kind: 'cashout' } });
      if (error) return null;
      return (data?.status as string | undefined) ?? null;
   } catch {
      return null;
   }
};

/** The caller's own most recent cash-out face check, for rendering the resolved verdict. */
export const getLatestCashoutFaceCheck = async (
   userId: string
): Promise<{ id: string; status: CashoutFaceStatus } | null> => {
   const supabase = getSupabaseBrowserClient();
   const { data, error } = await supabase
      .from('cashout_face_checks')
      .select('id, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
   if (error || !data) return null;
   return data as { id: string; status: CashoutFaceStatus };
};
