import { useEffect, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// `countryCode` is the ISO code check-geo resolved from the IP (e.g. 'PH', 'ID'), or null when
// the lookup failed or was skipped.
type GeoState = { allowed: boolean; countryCode: string | null; loading: boolean };

// Module-level cache — persists for the app session, resets on full page reload
let cachedResult: { allowed: boolean; countryCode: string | null } | null = null;

export function useGeoCheck(skip = false): GeoState {
   const [state, setState] = useState<GeoState>(() => {
      if (skip || cachedResult !== null)
         return { allowed: cachedResult?.allowed ?? true, countryCode: cachedResult?.countryCode ?? null, loading: false };
      return { allowed: false, countryCode: null, loading: true };
   });

   useEffect(() => {
      if (skip || cachedResult !== null) return;

      let cancelled = false;
      const supabase = getSupabaseBrowserClient();

      supabase.functions.invoke('check-geo').then(({ data, error }) => {
         if (cancelled) return;
         // Fail open: if the function errors, don't block the user
         const allowed = error ? true : Boolean(data?.allowed);
         const countryCode = !error && typeof data?.countryCode === 'string' && data.countryCode ? data.countryCode : null;
         cachedResult = { allowed, countryCode };
         setState({ allowed, countryCode, loading: false });
      });

      return () => {
         cancelled = true;
      };
   }, [skip]);

   return state;
}
