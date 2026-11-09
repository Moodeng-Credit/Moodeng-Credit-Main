import { useEffect, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type StatusReply = { enabled?: boolean; code?: string; error?: string; kyc?: unknown; bankUp?: boolean; qrCashout?: boolean };

// Stableyard's KYC body isn't documented to us (the edge function reads it the same loose way):
// the first `status` string at any depth.
const findStatus = (data: unknown, depth = 0): string | undefined => {
   if (!data || typeof data !== 'object' || depth > 4) return undefined;
   const own = (data as Record<string, unknown>).status;
   if (typeof own === 'string') return own;
   for (const value of Object.values(data as Record<string, unknown>)) {
      const found = findStatus(value, depth + 1);
      if (found) return found;
   }
   return undefined;
};
const KYC_DONE = new Set(['verified', 'approved', 'completed', 'complete', 'passed', 'active']);

/**
 * Whether this person may use the Stableyard payout (everyone since 2026-11-07, unless the
 * bank_payout_public kill switch is off; false on any doubt, null while checking), and whether their
 * Stableyard ID check is already approved (so the one-time setup is behind them). `bankUp`: Stableyard's
 * bank payout works right now; `qrCashout`: the cash-out to your own bank QR is on (it can work while
 * the bank payout is down).
 */
export function useBankPayoutStatus(isPreview: boolean) {
   const [state, setState] = useState<{ available: boolean | null; kycApproved: boolean; bankUp: boolean; qrCashout: boolean }>(() => {
      // /withdraw-preview?sim=bankdown shows the picker while Stableyard's bank payout is down.
      const bankDown = isPreview && new URLSearchParams(window.location.search).get('sim') === 'bankdown';
      return { available: isPreview ? true : null, kycApproved: false, bankUp: isPreview && !bankDown, qrCashout: isPreview };
   });
   useEffect(() => {
      if (isPreview) return;
      let cancelled = false;
      // 'status' answers 403 not_tester when the kill switch limits it to testers, 401 when signed out, and
      // enabled:false when Stableyard is switched off or its payout provider is down (bank list failing).
      // Anything else (e.g. no Stableyard account yet) is allowed.
      getSupabaseBrowserClient()
         .functions.invoke('stableyard-deposit-address', { body: { qr: 'status', qrCashout: true } })
         .then(async ({ data, error }) => {
            if (!error) return data as StatusReply;
            const context = (error as { context?: { json?: () => Promise<StatusReply> } }).context;
            return (await context?.json?.().catch(() => null)) ?? { code: 'not_tester' };
         })
         .then((res) => {
            if (cancelled) return;
            const available = res.code !== 'not_tester' && res.enabled !== false && !/authoriz|authentic/i.test(res.error ?? '');
            setState({
               available,
               kycApproved: KYC_DONE.has(String(findStatus(res.kyc) ?? '').toLowerCase()),
               // Replies without the flags (e.g. no Stableyard account yet → 409) mean the bank payout is up and the QR is off.
               bankUp: available && res.bankUp !== false,
               qrCashout: available && res.qrCashout === true
            });
         });
      return () => {
         cancelled = true;
      };
   }, [isPreview]);
   return state;
}

/** True when this person may use the Stableyard payout, false on any doubt, null while checking. */
export default function useBankPayoutAvailable(isPreview: boolean) {
   return useBankPayoutStatus(isPreview).available;
}
