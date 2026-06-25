import { useEffect, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type GeoState = { allowed: boolean; loading: boolean };

// Module-level cache — persists for the app session, resets on full page reload
let cachedResult: { allowed: boolean } | null = null;

export function useGeoCheck(skip = false): GeoState {
   const [state, setState] = useState<GeoState>(() => {
      if (skip || cachedResult !== null) return { allowed: cachedResult?.allowed ?? true, loading: false };
      return { allowed: false, loading: true };
   });

   useEffect(() => {
      if (skip || cachedResult !== null) return;

      let cancelled = false;
      const supabase = getSupabaseBrowserClient();

      supabase.functions.invoke('check-geo').then(({ data, error }) => {
         if (cancelled) return;
         // Fail open: if the function errors, don't block the user
         const allowed = error ? true : Boolean(data?.allowed);
         cachedResult = { allowed };
         setState({ allowed, loading: false });
      });

      return () => {
         cancelled = true;
      };
   }, [skip]);

   return state;
}
