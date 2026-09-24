import { useEffect, useRef } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';

import {
   clearPendingInvite,
   EMPTY_REWARDS,
   getMyInviteCode,
   getMyRewards,
   readPendingInvite,
   redeemFriendInvite,
   submitVoucherClaim,
   type VoucherReward
} from '@/lib/friendReferrals';
import { isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import type { RootState } from '@/store/store';

const rewardsKey = (userId: string) => ['friend-referrals', 'rewards', userId] as const;
const inviteCodeKey = (userId: string) => ['friend-referrals', 'invite-code', userId] as const;

/** The signed-in borrower's invite code (created on first request) and voucher rewards. */
export function useFriendReferrals(enabled = true) {
   const userId = useSelector((state: RootState) => state.auth.user?.id) ?? '';
   const isEnabled = enabled && Boolean(userId) && isSupabaseBrowserConfigured();

   const inviteCode = useQuery({
      queryKey: inviteCodeKey(userId),
      queryFn: getMyInviteCode,
      enabled: isEnabled,
      staleTime: Infinity
   });

   const rewards = useQuery({
      queryKey: rewardsKey(userId),
      queryFn: getMyRewards,
      enabled: isEnabled,
      staleTime: 60_000
   });

   return {
      inviteCode: inviteCode.data ?? null,
      rewards: rewards.data ?? EMPTY_REWARDS,
      isLoading: isEnabled && (inviteCode.isLoading || rewards.isLoading),
      error: inviteCode.error ?? rewards.error ?? null
   };
}

export function useSubmitVoucherClaim() {
   const queryClient = useQueryClient();
   const userId = useSelector((state: RootState) => state.auth.user?.id) ?? '';

   return useMutation({
      mutationFn: (input: { reward: VoucherReward; friendReferralId: string | null; fullName: string; mobile: string; email?: string }) =>
         submitVoucherClaim(input),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: rewardsKey(userId) })
   });
}

/**
 * Credits a parked invite (from /invite/:code) once the visitor has an account. The code is cleared
 * on any definite answer from the server; network errors leave it for the next page load.
 */
export function usePendingInviteRedemption() {
   const userId = useSelector((state: RootState) => state.auth.user?.id);
   const attemptedFor = useRef<string | null>(null);

   useEffect(() => {
      if (!userId || attemptedFor.current === userId || !isSupabaseBrowserConfigured()) return;
      const code = readPendingInvite();
      if (!code) return;

      attemptedFor.current = userId;
      redeemFriendInvite(code)
         .then(() => clearPendingInvite())
         .catch(() => {
            attemptedFor.current = null;
         });
   }, [userId]);
}
