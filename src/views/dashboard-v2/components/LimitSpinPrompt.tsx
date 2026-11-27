import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import LimitSpinWheel from '@/views/dashboard-v2/components/LimitSpinWheel';

// "You earned a spin!" (2026-11-27): shows the borrower's latest Limit Spin they haven't watched yet
// (public.my_unseen_limit_spin) — on the paid screen right after a repayment, or on home if the repayment
// was confirmed somewhere else. Paid before day 3 (2026-11-28), the spin waits: then it's a countdown
// ("Your spin unlocks Thu, Dec 4", public.my_next_limit_spin). Renders nothing when there's no spin.

type UnseenSpin = { id: string; drawn: number; from_limit: number; to_limit: number; bonus?: number };

export const UNSEEN_LIMIT_SPIN_KEY = ['my-unseen-limit-spin'] as const;
export const NEXT_LIMIT_SPIN_KEY = ['my-next-limit-spin'] as const;

const unlockLabel = (iso: string) => {
   try {
      return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
   } catch {
      return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
   }
};

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
   const { data: next } = useQuery({
      queryKey: NEXT_LIMIT_SPIN_KEY,
      queryFn: async (): Promise<{ unlocks_at: string } | null> => {
         const { data, error } = await getSupabaseBrowserClient().rpc('my_next_limit_spin');
         if (error || !data || typeof data !== 'object' || !(data as { unlocks_at?: string }).unlocks_at) return null;
         return data as { unlocks_at: string };
      },
      enabled: enabled && spin === null,
      staleTime: 0,
      refetchOnMount: 'always'
   });
   if (!spin) {
      if (!next) return null;
      // Unlocked but not applied yet (spins unlock 8 AM to 9 PM Manila): "almost ready".
      const ready = Date.parse(next.unlocks_at) <= Date.now();
      return (
         <section
            className={`flex items-center gap-3 rounded-[20px] bg-white px-4 py-4 shadow-[var(--dv2-shadow)] dark:bg-dv2-card ${className}`}
            aria-label="Limit spin"
            data-testid="limit-spin-countdown"
         >
            <span className="text-[30px] leading-none" aria-hidden="true">
               🎡
            </span>
            <div className="flex flex-col items-start gap-1 text-left">
               <p className="text-[15px] font-semibold leading-5 text-[#040033] dark:text-[#F0EAFF]">
                  {ready ? (
                     <span>Your spin is almost ready</span>
                  ) : (
                     <>
                        <span>Your spin unlocks</span> <span className="text-[#6010D2] dark:text-[#C4B8FF]">{unlockLabel(next.unlocks_at)}</span>
                     </>
                  )}
               </p>
               {/* The days they wait: something fun to do (2026-11-28). */}
               <a href="/game" className="text-[14px] font-semibold text-[#6010D2] dark:text-[#C4B8FF]">
                  Beat level 3 of Shark Chomp: +$1 on your spin 🦈
               </a>
            </div>
         </section>
      );
   }

   const raise = Math.max(0, Number(spin.to_limit) - Number(spin.from_limit));
   // The wheel lands on the spin; Shark Chomp's bonus shows on top (both already in to_limit).
   const bonus = Math.min(Number(spin.bonus ?? 0) || 0, raise);
   const amount = raise - bonus;
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
         <LimitSpinWheel amount={amount} bonus={bonus} toLimit={Number(spin.to_limit)} onDone={() => void done()} />
      </section>
   );
}
