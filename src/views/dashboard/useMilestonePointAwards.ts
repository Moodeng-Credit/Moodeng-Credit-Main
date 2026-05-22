import { useEffect, useMemo, useRef } from 'react';

import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import type { DashboardMilestone } from '@/views/dashboard/dashboardHelpers';

const isMissingMilestoneStorageFunction = (error: { code?: string; message?: string }) =>
   error.code === 'PGRST202' || error.message?.includes('record_milestone_completion');

interface UseMilestonePointAwardsArgs {
   userId?: string | null;
   milestones: DashboardMilestone[];
   enabled: boolean;
}

export function useMilestonePointAwards({ userId, milestones, enabled }: UseMilestonePointAwardsArgs) {
   const lastSyncKeyRef = useRef<string>('');
   const awardableMilestones = useMemo(
      () => milestones.filter((milestone) => milestone.status === 'unlocked' && milestone.points && milestone.points > 0),
      [milestones]
   );

   useEffect(() => {
      if (!enabled || !userId || awardableMilestones.length === 0 || !isSupabaseBrowserConfigured()) {
         return;
      }

      const syncKey = `${userId}:${awardableMilestones
         .map((milestone) => milestone.id)
         .sort()
         .join('|')}`;
      if (lastSyncKeyRef.current === syncKey) {
         return;
      }
      lastSyncKeyRef.current = syncKey;

      const syncMilestoneAwards = async () => {
         const supabase = getSupabaseBrowserClient();

         await Promise.all(
            awardableMilestones.map(async (milestone) => {
               const metadata = {
                  milestone_id: milestone.id,
                  title: milestone.title,
                  outcome: milestone.outcome,
                  benefit: milestone.benefit
               };
               const { error } = await supabase.rpc('record_milestone_completion', {
                  user_id_input: userId,
                  milestone_id_input: milestone.id,
                  metadata_input: metadata
               });

               if (!error) {
                  return;
               }

               if (!isMissingMilestoneStorageFunction(error)) {
                  console.error(`Failed to record milestone completion for ${milestone.id}:`, error.message);
               }
            })
         );
      };

      void syncMilestoneAwards();
   }, [awardableMilestones, enabled, userId]);
}
