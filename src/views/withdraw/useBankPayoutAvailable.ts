import { useEffect, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type StatusReply = { enabled?: boolean; code?: string; error?: string; kyc?: unknown };

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
 * Whether this person may use the Stableyard payout (admins + testers; false on any doubt, null while
 * checking), and whether their Stableyard ID check is already approved (so the one-time setup is behind them).
 */
export function useBankPayoutStatus(isPreview: boolean) {
   const [state, setState] = useState<{ available: boolean | null; kycApproved: boolean }>({
      available: isPreview ? true : null,
      kycApproved: false
   });
   useEffect(() => {
      if (isPreview) return;
      let cancelled = false;
      // 'status' answers 403 not_tester for everyone who isn't a tester, 401 when signed out, and
      // enabled:false when Stableyard is switched off. Anything else (even a Stableyard hiccup) is a tester.
      getSupabaseBrowserClient()
         .functions.invoke('stableyard-deposit-address', { body: { qr: 'status' } })
         .then(async ({ data, error }) => {
            if (!error) return data as StatusReply;
            const context = (error as { context?: { json?: () => Promise<StatusReply> } }).context;
            return (await context?.json?.().catch(() => null)) ?? { code: 'not_tester' };
         })
         .then((res) => {
            if (cancelled) return;
            setState({
               available: res.code !== 'not_tester' && res.enabled !== false && !/authoriz|authentic/i.test(res.error ?? ''),
               kycApproved: KYC_DONE.has(String(findStatus(res.kyc) ?? '').toLowerCase())
            });
         });
      return () => {
         cancelled = true;
      };
   }, [isPreview]);
   return state;
}

/** True when this person may use the Stableyard payout (admins + testers), false on any doubt, null while checking. */
export default function useBankPayoutAvailable(isPreview: boolean) {
   return useBankPayoutStatus(isPreview).available;
}
