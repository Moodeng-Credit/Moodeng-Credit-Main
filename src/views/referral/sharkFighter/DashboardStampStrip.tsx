import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';

import { EMPTY_INTEREST_REFUNDS, getMyInterestRefunds } from '@/lib/friendReferrals';
import { isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import type { RootState } from '@/store/store';
import { MiniStampStrip } from '@/views/referral/sharkFighter/SharkFighterStamps';

/** Dashboard entry to the Shark Fighter Card (replaced "Earn $5 per friend"). Sample stamps on previews. */
export default function DashboardStampStrip({ preview, onOpen }: { preview: boolean; onOpen: () => void }) {
   const userId = useSelector((state: RootState) => state.auth.user?.id) ?? '';
   const query = useQuery({
      queryKey: ['friend-referrals', 'interest-refunds', userId],
      queryFn: getMyInterestRefunds,
      enabled: !preview && Boolean(userId) && isSupabaseBrowserConfigured(),
      staleTime: 60_000
   });
   const data = preview ? { ...EMPTY_INTEREST_REFUNDS, stamps: 3, isAffiliate: true } : (query.data ?? EMPTY_INTEREST_REFUNDS);
   return (
      <MiniStampStrip
         stamps={data.stamps}
         every={data.bonusEvery}
         rewardUsd={data.rewardUsd}
         bonusUsd={data.bonusUsd}
         unlocked={data.isAffiliate}
         onOpen={onOpen}
      />
   );
}
