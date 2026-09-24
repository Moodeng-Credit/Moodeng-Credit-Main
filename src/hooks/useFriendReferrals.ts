import { useEffect, useRef } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';

import {
   clearPendingInvite,
   EMPTY_REWARDS,
   getMyInviteCode,
   getMyRewards,
   isAccountNewerThanInvite,
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
   const queryClient = useQueryClient();
   const userId = useSelector((state: RootState) => state.auth.user?.id);
   const createdAt = useSelector((state: RootState) => state.auth.user?.createdAt);
   const attemptedFor = useRef<string | null>(null);

   useEffect(() => {
      if (!userId || !createdAt || attemptedFor.current === userId || !isSupabaseBrowserConfigured()) return;
      const invite = readPendingInvite();
      if (!invite) return;

      attemptedFor.current = userId;
      if (!isAccountNewerThanInvite(createdAt, invite)) {
         clearPendingInvite();
         return;
      }
      redeemFriendInvite(invite.code)
         .then(() => {
            clearPendingInvite();
            return queryClient.invalidateQueries({ queryKey: ['friend-referrals', 'rewards', userId] });
         })
         .catch(() => {
            attemptedFor.current = null;
         });
   }, [createdAt, queryClient, userId]);
}
