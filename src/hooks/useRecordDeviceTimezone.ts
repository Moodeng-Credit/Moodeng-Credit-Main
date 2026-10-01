import { useEffect } from 'react';

import { getDeviceTimezone } from '@/lib/loanDeadline';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const SESSION_KEY = 'md_reported_timezone';

/**
 * Reports this device's time zone for the signed-in user, once per session (and again if it changes).
 * A new loan's deadline is measured in this zone: its due day ends at midnight where the borrower is.
 * UTC-like zones are skipped (they mean "never set"), and the server ignores them too.
 */
export function useRecordDeviceTimezone(userId: string | null | undefined) {
   useEffect(() => {
      if (!userId) return;
      const zone = getDeviceTimezone();
      if (!zone) return;
      const key = `${userId}:${zone}`;
      try {
         if (sessionStorage.getItem(SESSION_KEY) === key) return;
      } catch {
         // Storage blocked: just report it.
      }
      void getSupabaseBrowserClient()
         .rpc('set_my_timezone', { p_zone: zone })
         .then(({ error }) => {
            if (error) return;
            try {
               sessionStorage.setItem(SESSION_KEY, key);
            } catch {
               // Storage blocked: we'll report it again next load.
            }
         });
   }, [userId]);
}
