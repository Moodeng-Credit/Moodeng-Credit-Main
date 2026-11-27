import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import LimitSpinWheel from '@/views/dashboard-v2/components/LimitSpinWheel';

// "You earned a spin!" (2026-11-27): shows the borrower's latest Limit Spin they haven't watched yet
// (public.my_unseen_limit_spin) — on the paid screen right after a repayment, or on home if the repayment
// was confirmed somewhere else. Renders nothing when there's no spin waiting.

type UnseenSpin = { id: string; drawn: number; from_limit: number; to_limit: number };

export const UNSEEN_LIMIT_SPIN_KEY = ['my-unseen-limit-spin'] as const;

export default function LimitSpinPrompt({ enabled = true, className = '' }: { enabled?: boolean; className?: string }) {
   const queryClient = useQueryClient();
   const { data: spin } = useQuery({
      queryKey: UNSEEN_LIMIT_SPIN_KEY,
      queryFn: async (): Promise<UnseenSpin | null> => {
         const { data, error } = await getSupabaseBrowserClient().rpc('my_unseen_limit_spin');
         if (error || !data || typeof data !== 'object') return null;
         return data as UnseenSpin;
      },
      enabled,
      // Always fresh: the paid screen mounts seconds after the server drew the spin.
      staleTime: 0,
      refetchOnMount: 'always'
   });
   if (!spin) return null;

   const amount = Math.max(0, Number(spin.to_limit) - Number(spin.from_limit));
   const done = async () => {
      await getSupabaseBrowserClient().rpc('mark_limit_spin_seen', { p_id: spin.id });
      queryClient.setQueryData(UNSEEN_LIMIT_SPIN_KEY, null);
      void queryClient.invalidateQueries({ queryKey: ['my-limit-ceiling'] });
   };

   return (
      <section
         className={`rounded-[20px] bg-white px-4 py-5 shadow-[var(--dv2-shadow)] dark:bg-dv2-card ${className}`}
         aria-label="Limit spin"
      >
         <LimitSpinWheel amount={amount} toLimit={Number(spin.to_limit)} onDone={() => void done()} />
      </section>
   );
}
