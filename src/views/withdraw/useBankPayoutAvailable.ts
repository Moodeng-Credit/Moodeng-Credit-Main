import { useEffect, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/** True when this person may use the Stableyard payout (admins + testers), false on any doubt, null while checking. */
export default function useBankPayoutAvailable(isPreview: boolean) {
   const [available, setAvailable] = useState<boolean | null>(isPreview ? true : null);
   useEffect(() => {
      if (isPreview) return;
      let cancelled = false;
      // 'status' answers 403 not_tester for everyone who isn't a tester, 401 when signed out, and
      // enabled:false when Stableyard is switched off. Anything else (even a Stableyard hiccup) is a tester.
      getSupabaseBrowserClient()
         .functions.invoke('stableyard-deposit-address', { body: { qr: 'status' } })
         .then(async ({ data, error }) => {
            if (!error) return data as { enabled?: boolean; code?: string; error?: string };
            const context = (error as { context?: { json?: () => Promise<{ enabled?: boolean; code?: string; error?: string }> } }).context;
            return (await context?.json?.().catch(() => null)) ?? { code: 'not_tester' };
         })
         .then((res) => {
            if (!cancelled)
               setAvailable(res.code !== 'not_tester' && res.enabled !== false && !/authoriz|authentic/i.test(res.error ?? ''));
         });
      return () => {
         cancelled = true;
      };
   }, [isPreview]);
   return available;
}
