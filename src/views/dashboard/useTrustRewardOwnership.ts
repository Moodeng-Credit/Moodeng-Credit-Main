import { useEffect, useState } from 'react';

import { isTransientNetworkError } from '@/lib/isTransientNetworkError';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

interface UseTrustRewardOwnershipArgs {
   userId?: string | null;
   fallbackRewardIds: string[];
   enabled: boolean;
}

const isMissingRewardStorageFunction = (error: { code?: string; message?: string }) =>
   error.code === 'PGRST202' || error.message?.includes('sync_user_rewards');

export function useTrustRewardOwnership({ userId, fallbackRewardIds, enabled }: UseTrustRewardOwnershipArgs) {
   const [unlockedRewardIds, setUnlockedRewardIds] = useState(fallbackRewardIds);

   useEffect(() => {
      setUnlockedRewardIds(fallbackRewardIds);
   }, [fallbackRewardIds]);

   useEffect(() => {
      if (!enabled || !userId || !isSupabaseBrowserConfigured()) {
         return;
      }

      let isActive = true;

      const syncRewards = async () => {
         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase.rpc('sync_user_rewards', {
            user_id_input: userId
         });

         if (!isActive) return;

         if (error) {
            if (!isMissingRewardStorageFunction(error) && !isTransientNetworkError(error)) {
               console.error('Failed to sync Trust Point rewards:', error.message);
            }
            setUnlockedRewardIds(fallbackRewardIds);
            return;
         }

         setUnlockedRewardIds((data ?? []).map((reward) => reward.reward_id));
      };

      void syncRewards();

      return () => {
         isActive = false;
      };
   }, [enabled, fallbackRewardIds, userId]);

   return { unlockedRewardIds };
}
