import { useEffect, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// `countryCode` is the ISO-3166 alpha-2 code of the request IP (e.g. 'PH', 'ID'), or null
// while loading / when the lookup failed. It's an IP guess, not the user's nationality —
// use it to ADD country-specific options, never to hide ones the user may still rely on.
type GeoState = { allowed: boolean; loading: boolean; countryCode: string | null };

// Module-level cache — persists for the app session, resets on full page reload
let cachedResult: { allowed: boolean; countryCode: string | null } | null = null;

export function useGeoCheck(skip = false): GeoState {
   const [state, setState] = useState<GeoState>(() => {
      if (skip || cachedResult !== null)
         return { allowed: cachedResult?.allowed ?? true, loading: false, countryCode: cachedResult?.countryCode ?? null };
      return { allowed: false, loading: true, countryCode: null };
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
         setState({ allowed, loading: false, countryCode });
      });

      return () => {
         cancelled = true;
      };
   }, [skip]);

   return state;
}
