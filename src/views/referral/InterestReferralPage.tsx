import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, Clock, Copy, Lock, UserPlus } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';

import { useFriendReferrals } from '@/hooks/useFriendReferrals';

import {
   EMPTY_INTEREST_REFUNDS,
   getMyInterestRefunds,
   type InterestRefundFriend,
   type MyInterestRefunds
} from '@/lib/friendReferrals';
import { isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import type { RootState } from '@/store/store';
import { buildInviteLink } from '@/views/dashboard-v2/dashboardV2Model';
import { ShareSheet } from '@/views/dashboard-v2/DashboardV2Rewards';

const SAMPLE_CODE = 'MOODEN12345';
const SAMPLE_REFUNDS: MyInterestRefunds = {
   friends: [
      { joinedAt: '2026-10-29T08:00:00Z', repaid: true, refundUsd: 5, refundStatus: 'sent', sentAt: '2026-10-31T08:00:00Z', txHash: null },
      { joinedAt: '2026-10-30T08:00:00Z', repaid: true, refundUsd: 5, refundStatus: 'pending', sentAt: null, txHash: null },
      { joinedAt: '2026-10-31T08:00:00Z', repaid: false, refundUsd: null, refundStatus: null, sentAt: null, txHash: null }
   ],
   totalRefundedUsd: 5,
   totalEarnedUsd: 5,
   owedUsd: 5,
   isAffiliate: true,
   rewardUsd: 5
};
const SAMPLE_LOCKED: MyInterestRefunds = {
   ...EMPTY_INTEREST_REFUNDS,
   friends: [{ joinedAt: '2026-10-31T08:00:00Z', repaid: false, refundUsd: null, refundStatus: null, sentAt: null, txHash: null }]
};

const steps = (rewardUsd: number) => [
   { title: 'Your friend signs up', body: 'With your link or code.' },
   { title: 'They repay a loan', body: 'One you didn’t fund.' },
   { title: `We send you $${rewardUsd} USDC`, body: 'To your wallet, for each friend.' }
];

const formatUsd = (value: number) => `$${value.toFixed(2).replace(/\.00$/, '')}`;
const formatDay = (iso: string) =>
   iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' }) : '';

function FriendStatus({ friend }: { friend: InterestRefundFriend }) {
   if (friend.refundStatus === 'sent' && friend.refundUsd !== null) {
      return (
         <span className="inline-flex items-center gap-1 rounded-full bg-[#d7f5df] px-3 py-1 text-md-b3 font-semibold text-[#178447]">
            <CheckCircle className="h-4 w-4" aria-hidden="true" />
            {formatUsd(friend.refundUsd)} sent
         </span>
      );
   }
   if (friend.refundStatus === 'pending' && friend.refundUsd !== null) {
      return (
         <span className="inline-flex items-center gap-1 rounded-full bg-md-primary-100 px-3 py-1 text-md-b3 font-semibold text-md-primary-1200">
            <Clock className="h-4 w-4" aria-hidden="true" />
            {formatUsd(friend.refundUsd)} on the way
         </span>
      );
   }
   return (
      <span className="rounded-full bg-md-neutral-200 px-3 py-1 text-md-b3 font-semibold text-md-neutral-700">
         {friend.repaid ? 'Repay your first loan to unlock' : 'Waiting for them to repay'}
      </span>
   );
}

/**
 * Affiliate page: $5 USDC per friend who signs up with your code and repays a loan, unlocked by your
 * first repaid loan. Invite codes and payouts live in the database (friend_referrals, interest_refunds,
 * migration 20261115120000_affiliate_cash_per_friend); this page only shows them.
 * Preview: /refer-preview (affiliate) or /refer-preview?locked=1 (before the first repaid loan).
 */
export default function InterestReferralPage({ sample = false }: { sample?: boolean }) {
   const userId = useSelector((state: RootState) => state.auth.user?.id) ?? '';
   const isLive = !sample && Boolean(userId);
   const [params] = useSearchParams();
   const { inviteCode, error: inviteError } = useFriendReferrals(isLive);
   const refundsQuery = useQuery({
      queryKey: ['friend-referrals', 'interest-refunds', userId],
      queryFn: getMyInterestRefunds,
      enabled: isLive && isSupabaseBrowserConfigured(),
      staleTime: 60_000
   });
   const refunds = sample ? (params.get('locked') ? SAMPLE_LOCKED : SAMPLE_REFUNDS) : (refundsQuery.data ?? EMPTY_INTEREST_REFUNDS);
   const reward = refunds.rewardUsd;
   const isLocked = !refunds.isAffiliate && !(isLive && refundsQuery.isLoading);
   const code = sample ? SAMPLE_CODE : inviteCode;
   const inviteLink = code ? buildInviteLink(code) : null;
   const [copied, setCopied] = useState(false);
   const [isShareOpen, setIsShareOpen] = useState(false);

   const flashCopied = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
   };
   const copyCode = async () => {
      if (!code) return;
      await navigator.clipboard.writeText(code).then(flashCopied, () => undefined);
   };

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="mx-auto flex max-w-[440px] flex-col gap-5 px-5 pb-28 pt-6">
            <Link to="/request-board" className="flex w-fit items-center gap-1 text-md-b2 font-semibold text-md-primary-1200">
               <ArrowLeft className="h-5 w-5" aria-hidden="true" />
               Request Board
            </Link>

            <div className="relative overflow-hidden rounded-md-lg border border-[#f0f0f0] bg-md-primary-100 p-4">
               <div className="relative z-10 flex max-w-[210px] flex-col gap-1">
                  <p className="text-md-b3 font-semibold uppercase tracking-wide text-md-primary-1200">Affiliate</p>
                  <h1 className="text-md-h5 font-semibold text-md-heading max-[374px]:text-[22px]">Earn ${reward} per friend</h1>
                  <p className="text-md-b2 font-medium text-md-neutral-700">Friend repays, you get ${reward} USDC.</p>
               </div>
               <img src="/hippos/thumb-up-right.png" alt="" className="pointer-events-none absolute right-0 top-0 h-full object-contain" />
            </div>

            {isLocked ? (
               <div className="flex items-center gap-3 rounded-md-lg border border-[#f0f0f0] bg-white p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-md-neutral-200">
                     <Lock className="h-5 w-5 text-md-neutral-700" aria-hidden="true" />
                  </span>
                  <span className="flex flex-col">
                     <span className="text-md-b2 font-semibold text-md-heading">Repay your first loan to unlock</span>
                     <span className="text-md-b3 text-md-neutral-700">Friends who join now still count.</span>
                  </span>
               </div>
            ) : null}

            <section className="flex flex-col gap-3 rounded-md-lg border border-[#f0f0f0] bg-white p-4">
               <p className="text-md-b2 font-semibold text-md-neutral-700">Your code</p>
               <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[22px] font-semibold tracking-[1px] text-md-heading">
                     {code ?? (inviteError ? 'Unavailable right now' : 'Loading…')}
                  </p>
                  <button
                     type="button"
                     onClick={copyCode}
                     disabled={!code}
                     className="inline-flex items-center gap-1 rounded-full border border-md-primary-1200 px-3 py-1.5 text-md-b3 font-semibold text-md-primary-1200 disabled:opacity-50"
                  >
                     <Copy className="h-4 w-4" aria-hidden="true" />
                     {copied ? 'Copied' : 'Copy'}
                  </button>
               </div>
               <button
                  type="button"
                  onClick={() => setIsShareOpen(true)}
                  disabled={!inviteLink}
                  className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-md-lg bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 shadow-md-card transition-all duration-150 hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
               >
                  <UserPlus className="h-5 w-5" aria-hidden="true" />
                  Invite friends
               </button>
            </section>

            <section className="flex flex-col gap-3 rounded-md-lg border border-[#f0f0f0] bg-white p-4">
               <h2 className="text-md-b1 font-semibold text-md-heading">How it works</h2>
               <ol className="flex flex-col gap-3">
                  {steps(reward).map((step, index) => (
                     <li key={step.title} className="flex gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-md-primary-100 text-md-b3 font-bold text-md-primary-1200">
                           {index + 1}
                        </span>
                        <span className="flex flex-col">
                           <span className="text-md-b2 font-semibold text-md-heading">{step.title}</span>
                           <span className="text-md-b3 text-md-neutral-700">{step.body}</span>
                        </span>
                     </li>
                  ))}
               </ol>
            </section>

            <section className="flex flex-col gap-3 rounded-md-lg border border-[#f0f0f0] bg-white p-4">
               <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-md-b1 font-semibold text-md-heading">Your friends</h2>
                  {refunds.totalEarnedUsd > 0 ? (
                     <p className="text-md-b3 font-semibold text-[#178447]">{formatUsd(refunds.totalEarnedUsd)} earned</p>
                  ) : null}
               </div>
               {refunds.friends.length ? (
                  <ul className="flex flex-col divide-y divide-md-neutral-200">
                     {refunds.friends.map((friend, index) => (
                        <li key={friend.joinedAt} className="flex items-center justify-between gap-3 py-2.5">
                           <span className="flex flex-col">
                              <span className="text-md-b2 font-semibold text-md-heading">Friend {refunds.friends.length - index}</span>
                              <span className="text-md-b3 text-md-neutral-700">Joined {formatDay(friend.joinedAt)}</span>
                           </span>
                           <FriendStatus friend={friend} />
                        </li>
                     ))}
                  </ul>
               ) : (
                  <p className="text-md-b2 text-md-neutral-700">
                     {isLive && refundsQuery.isLoading ? 'Loading…' : 'No friends yet. Share your code to get started.'}
                  </p>
               )}
            </section>
         </div>

         {isShareOpen && inviteLink ? (
            <ShareSheet
               link={inviteLink}
               text={`Join me on Moodeng Credit. Use my code ${code}:`}
               onClose={() => setIsShareOpen(false)}
               onCopied={flashCopied}
            />
         ) : null}
      </div>
   );
}
