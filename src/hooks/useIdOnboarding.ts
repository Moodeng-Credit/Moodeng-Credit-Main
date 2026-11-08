import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useSelector } from 'react-redux';

import { parseIdOnboarding, type IdOnboarding } from '@/lib/idTrack';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { RootState } from '@/store/store';

export const ID_ONBOARDING_QUERY_KEY = 'id-onboarding';

export const fetchIdOnboarding = async (): Promise<IdOnboarding> => {
   const { data, error } = await getSupabaseBrowserClient().rpc('my_id_onboarding');
   // Fails closed to "not on the track": an older backend without the RPC keeps the normal flow.
   if (error) return parseIdOnboarding(null);
   return parseIdOnboarding(data);
};

/**
 * Where an Indonesia-track borrower is (see src/lib/idTrack.ts). `isIndo` is false for everyone
 * else, and while loading. Pass `poll` on screens waiting for an outside event (WhatsApp code,
 * Messenger code, Didit result) so the step ticks over without a reload.
 */
export function useIdOnboarding(options: { poll?: boolean } = {}) {
   const userId = useSelector((state: RootState) => state.auth.user?.id);
   const queryClient = useQueryClient();
   const query = useQuery({
      queryKey: [ID_ONBOARDING_QUERY_KEY, userId],
      queryFn: fetchIdOnboarding,
      enabled: Boolean(userId),
      staleTime: 15_000,
      refetchInterval: options.poll ? 5_000 : false
   });
   const refresh = useCallback(
      () => queryClient.invalidateQueries({ queryKey: [ID_ONBOARDING_QUERY_KEY] }),
      [queryClient]
   );
   return {
      data: query.data,
      isIndo: query.data?.market === 'ID',
      isLoading: Boolean(userId) && query.isLoading,
      refresh
   };
}
