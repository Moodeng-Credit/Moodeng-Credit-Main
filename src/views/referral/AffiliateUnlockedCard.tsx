import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { AFFILIATE_REWARD_USD, getMyInterestRefunds } from '@/lib/friendReferrals';
import { isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import type { RootState } from '@/store/store';

/**
 * "You're paid" screen: tells the borrower they can now earn $5 per friend (affiliate program,
 * migration 20261115120000_affiliate_cash_per_friend). Shown on every repay as a reminder; the
 * title says "affiliate now" once the database counts them (first repaid loan held 24h+).
 */
export function AffiliateUnlockedCard({ isPreview = false }: { isPreview?: boolean }) {
   const navigate = useNavigate();
   const userId = useSelector((state: RootState) => state.auth.user?.id) ?? '';
   const query = useQuery({
      queryKey: ['friend-referrals', 'interest-refunds', userId],
      queryFn: getMyInterestRefunds,
      enabled: !isPreview && Boolean(userId) && isSupabaseBrowserConfigured(),
      staleTime: 0
   });
   const reward = query.data?.rewardUsd ?? AFFILIATE_REWARD_USD;
   const isAffiliate = isPreview || query.data?.isAffiliate === true;

   return (
      <section
         className="relative flex w-full items-center gap-3 overflow-hidden rounded-[16px] border border-[#ece4ff] bg-white px-4 py-4 text-left dark:border-[#2a2340] dark:bg-[#1b1626]"
         aria-label="Affiliate program"
      >
         <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-1 pr-16">
            <p className="text-[18px] font-black leading-6 text-[#2b2116] dark:text-[#f5efe3]">
               {isAffiliate ? 'You’re an affiliate now 🎉' : `Earn $${reward} per friend`}
            </p>
            <p className="text-[14px] font-medium leading-[18px] text-[#6b5d48] dark:text-[#bfb29a]">
               {isAffiliate ? `Earn $${reward} USDC for each friend who repays.` : 'Invite friends who borrow and repay.'}
            </p>
            <button
               type="button"
               onClick={() => navigate('/refer')}
               className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#6b55f7] px-4 py-2 text-[15px] font-bold text-white active:scale-[0.98]"
            >
               <UserPlus className="h-4 w-4" aria-hidden="true" />
               Invite friends
            </button>
         </div>
         <img
            src="/hippos/thumb-up-right.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 right-0 h-[88%] select-none object-contain"
            draggable={false}
         />
      </section>
   );
}
