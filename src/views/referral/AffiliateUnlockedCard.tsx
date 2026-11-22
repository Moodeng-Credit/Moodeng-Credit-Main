import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { useFriendReferrals } from '@/hooks/useFriendReferrals';

import { EMPTY_INTEREST_REFUNDS, getMyInterestRefunds } from '@/lib/friendReferrals';
import { isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import type { RootState } from '@/store/store';
import { buildInviteLink } from '@/views/dashboard-v2/dashboardV2Model';
import { inviteMessage } from '@/views/referral/sharkFighter/inviteMessage';
import ShareFightSheet from '@/views/referral/sharkFighter/ShareFightSheet';
import { StampGrid } from '@/views/referral/sharkFighter/SharkFighterStamps';
import { cardProgress } from '@/views/referral/sharkFighter/stampMath';

// "Spread the word" (George, 2026-11-22; Figma "Spread the word – after voucher"), on the Loan repaid screen
// under the streak/voucher card. A preview of the Ride the Hippo share card, the Shark Fighter stamps, and one
// "Share my fight" button: selfie + fighter Moodeng + streak, with the invite link in the caption.
// (Kept the old export name: Repay renders it in two places.)

const PRIMARY_GRADIENT = 'linear-gradient(77.66deg, #9584ff 0.5%, #6b55f7 98.16%)';
const SAMPLE_CODE = 'MARIAC12345';

export function AffiliateUnlockedCard({ isPreview = false }: { isPreview?: boolean }) {
   const navigate = useNavigate();
   const userId = useSelector((state: RootState) => state.auth.user?.id) ?? '';
   const live = !isPreview && Boolean(userId) && isSupabaseBrowserConfigured();
   const refunds = useQuery({
      queryKey: ['friend-referrals', 'interest-refunds', userId],
      queryFn: getMyInterestRefunds,
      enabled: live,
      staleTime: 0
   });
   const { inviteCode, rewards } = useFriendReferrals(live);
   const [sharing, setSharing] = useState(false);

   const data = isPreview ? { ...EMPTY_INTEREST_REFUNDS, stamps: 3, isAffiliate: true } : (refunds.data ?? EMPTY_INTEREST_REFUNDS);
   const code = isPreview ? SAMPLE_CODE : inviteCode;
   const streak = isPreview ? 3 : rewards.streak.current;
   const link = code ? buildInviteLink(code) : '';

   return (
      <section
         className="flex w-full flex-col items-center gap-3 overflow-hidden rounded-[20px] bg-gradient-to-b from-[#f3ecff] via-white via-40% to-white px-5 pb-5 pt-4 text-center shadow-[0_2px_8px_rgba(28,5,61,0.08)] dark:from-dv2-tab dark:via-dv2-card dark:to-dv2-card"
         aria-label="Spread the word"
      >
         <p className="text-[22px] font-black italic leading-7 text-[#4c239f] dark:text-[#c4b8ff]">Spread the word! 🦈</p>
         <img src="/shark-fighter/fighter-moodeng.webp" alt="" className="h-[150px] object-contain" draggable={false} />
         <div className="text-[#594d65] dark:text-[#d9cfe6]">
            <p className="text-[20px] font-bold leading-6">You&apos;re a shark fighter 🥊</p>
            <p className="mt-1 text-[15px]">Friend repays on time = ${data.rewardUsd} for you</p>
         </div>
         <button type="button" onClick={() => navigate('/affiliate')} className="w-full" aria-label="Open your Shark Fighter Card">
            <StampGrid stamps={data.stamps} every={data.bonusEvery} bonusUsd={data.bonusUsd} size={46} />
         </button>
         <p className="text-[13px] font-semibold text-[#7a6fa3] dark:text-[#b3a9d9]">
            {cardProgress(data.stamps, data.bonusEvery).filled} of {data.bonusEvery} · {data.bonusEvery}th stamp = +${data.bonusUsd} bonus
         </p>
         <button
            type="button"
            disabled={!code}
            onClick={() => setSharing(true)}
            className="flex h-[52px] w-full max-w-[346px] items-center justify-center rounded-[35px] text-[20px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
            style={{ backgroundImage: PRIMARY_GRADIENT }}
         >
            Share my fight 🥊
         </button>
         {sharing && code ? (
            <ShareFightSheet streak={streak} caption={inviteMessage(code, link)} onClose={() => setSharing(false)} />
         ) : null}
      </section>
   );
}
