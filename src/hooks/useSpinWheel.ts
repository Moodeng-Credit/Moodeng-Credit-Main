import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';

import type { VoucherBrand } from '@/lib/friendReferrals';
import { answerSpinCampaign, claimSpinPrize, getSpinState, spinWheel } from '@/lib/spinWheel';
import { isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import type { RootState } from '@/store/store';

const spinKey = (userId: string) => ['spin-wheel', userId] as const;

/** The /spin page's state for the signed-in person (and the campaign in the link, if any). */
export function useSpinState(campaign: string | null, enabled = true) {
   const userId = useSelector((state: RootState) => state.auth.user?.id) ?? '';
   return useQuery({
      queryKey: [...spinKey(userId), campaign ?? ''],
      queryFn: () => getSpinState(campaign),
      enabled: enabled && Boolean(userId) && isSupabaseBrowserConfigured()
   });
}

export function useAnswerSpinCampaign() {
   const queryClient = useQueryClient();
   const userId = useSelector((state: RootState) => state.auth.user?.id) ?? '';
   return useMutation({
      mutationFn: (input: { code: string; answer: number | null }) => answerSpinCampaign(input.code, input.answer),
      onSuccess: (result) => {
         if (result.ok) void queryClient.invalidateQueries({ queryKey: spinKey(userId) });
      }
   });
}

/** Spins. The page refreshes its state itself once the wheel stops (so the prize list doesn't jump early). */
export function useSpinWheel() {
   return useMutation({ mutationFn: spinWheel });
}

export function useRefreshSpinState() {
   const queryClient = useQueryClient();
   const userId = useSelector((state: RootState) => state.auth.user?.id) ?? '';
   return () => queryClient.invalidateQueries({ queryKey: spinKey(userId) });
}

export function useClaimSpinPrize() {
   const queryClient = useQueryClient();
   const userId = useSelector((state: RootState) => state.auth.user?.id) ?? '';
   return useMutation({
      mutationFn: (input: { spinId: string; fullName: string; mobile: string; email?: string; brand?: VoucherBrand }) =>
         claimSpinPrize(input),
      onSuccess: () => {
         void queryClient.invalidateQueries({ queryKey: spinKey(userId) });
         void queryClient.invalidateQueries({ queryKey: ['friend-referrals', 'rewards', userId] });
      }
   });
}
