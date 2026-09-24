import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';

import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { trustPointMilestoneRuleById } from '@/shared/points';
import type { RootState } from '@/store/store';
import { getMilestoneTitle } from '@/views/dashboard-v2/dashboardV2Model';

export const STREAK_WINDOW_DAYS = 7;
/** How many milestones inside the window count as a streak worth celebrating. */
export const STREAK_MIN_MILESTONES = 2;

export interface StreakMilestone {
   id: string;
   title: string;
   points: number;
   completedAt: string;
}

/**
 * Milestones the signed-in user completed in the last 7 days, oldest first. Read straight from
 * `user_milestone_completions` (users can read their own rows), so it reflects what was actually awarded.
 */
export function useWeeklyMilestoneStreak(enabled: boolean) {
   const userId = useSelector((state: RootState) => state.auth.user?.id) ?? '';
   const isEnabled = enabled && Boolean(userId) && isSupabaseBrowserConfigured();

   const query = useQuery({
      queryKey: ['milestone-streak', userId],
      enabled: isEnabled,
      staleTime: 60_000,
      queryFn: async (): Promise<StreakMilestone[]> => {
         const since = new Date(Date.now() - STREAK_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
         const { data, error } = await getSupabaseBrowserClient()
            .from('user_milestone_completions')
            .select('milestone_id, completed_at')
            .eq('user_id', userId)
            .gte('completed_at', since)
            .order('completed_at', { ascending: true });
         if (error) throw error;
         return (data ?? []).map((row) => ({
            id: row.milestone_id as string,
            title: getMilestoneTitle(row.milestone_id as string),
            points: trustPointMilestoneRuleById[row.milestone_id as string]?.points ?? 0,
            completedAt: row.completed_at as string
         }));
      }
   });

   return { milestones: query.data ?? [], userId };
}
