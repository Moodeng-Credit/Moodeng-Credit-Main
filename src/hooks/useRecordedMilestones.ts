import { useQuery } from '@tanstack/react-query';

import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

const EMPTY: ReadonlySet<string> = new Set();

/**
 * Milestone ids the database has recorded as completed for this user (user_milestone_completions;
 * users can read their own rows). A milestone, once earned, stays earned: the loan that earned it
 * may since have been deleted or expired, and the dashboard must not show it as "Get" again.
 */
export function useRecordedMilestones(userId: string | undefined, enabled = true): ReadonlySet<string> {
   const query = useQuery({
      queryKey: ['recorded-milestones', userId],
      enabled: enabled && Boolean(userId) && isSupabaseBrowserConfigured(),
      staleTime: 60_000,
      queryFn: async () => {
         const { data, error } = await getSupabaseBrowserClient()
            .from('user_milestone_completions')
            .select('milestone_id')
            .eq('user_id', userId as string);
         if (error) throw error;
         return new Set((data ?? []).map((row) => row.milestone_id as string));
      }
   });
   return query.data ?? EMPTY;
}
