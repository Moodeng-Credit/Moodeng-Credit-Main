import { useQuery } from '@tanstack/react-query';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * The signed-in borrower's income ceiling (public.my_limit_ceiling, migration 20261127010000): their limit
 * stops growing here. `source` says what set it: the team, a team-approved income document, or the sign-up
 * answer. Anything unexpected (not deployed, network error, loading) reads as null = no ceiling shown, so
 * this can never hide a real level-up (the server applies the ceiling either way).
 */
export type LimitCeiling = { ceiling: number; source: 'team' | 'income_proof' | 'sign_up' };

export const useLimitCeiling = (enabled: boolean): LimitCeiling | null => {
   const { data } = useQuery({
      queryKey: ['my-limit-ceiling'],
      queryFn: async (): Promise<LimitCeiling | null> => {
         const { data: res, error } = await getSupabaseBrowserClient().rpc('my_limit_ceiling');
         if (error || !res || typeof res !== 'object') return null;
         const value = res as { ceiling?: unknown; source?: unknown };
         const ceiling = Number(value.ceiling);
         if (!Number.isFinite(ceiling) || ceiling <= 0) return null;
         const source = value.source === 'team' || value.source === 'income_proof' ? value.source : 'sign_up';
         return { ceiling, source };
      },
      enabled,
      staleTime: 5 * 60_000
   });
   return data ?? null;
};
