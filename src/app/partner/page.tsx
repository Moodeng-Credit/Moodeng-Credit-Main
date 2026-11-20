import { useEffect, useRef, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
   AFFILIATE_WALLET_RETURN_TO,
   claimAffiliateInvite,
   claimErrorMessage,
   clearParkedAffiliateInvite,
   fetchAffiliateInvite,
   parkAffiliateInvite,
   partnerPath
} from '@/lib/affiliateInvite';
import { rememberNextPath } from '@/lib/authNext';
import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { DASHBOARD_V2_ASSETS } from '@/views/dashboard-v2/assets';
import { GhostButton, PrimaryButton } from '@/views/dashboard/components/connectKit';

/*
 * moodeng.app/partner/TOKEN — the affiliate-only sign-up link (lib/affiliateInvite). Signed out: what
 * they get + sign up. Signed in: take the code, then a wallet (payouts go there), then /affiliate.
 * No borrower steps.
 */

function Shell({ children }: { children: React.ReactNode }) {
   return (
      <div className="min-h-screen bg-white dark:bg-[#100d17]">
         <div className="mx-auto flex min-h-screen max-w-[440px] flex-col justify-center gap-6 px-5 py-10 text-center">{children}</div>
      </div>
   );
}

export default function PartnerInvitePage() {
   const { token = '' } = useParams();
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const isAuthChecked = useSelector((state: RootState) => state.auth.isAuthChecked);
   const signedIn = Boolean(user?.id);
   const [claimError, setClaimError] = useState<string | null>(null);
   const claimStarted = useRef(false);

   const invite = useQuery({
      queryKey: ['affiliate-invite', token, user?.id ?? null],
      queryFn: () => fetchAffiliateInvite(token),
      enabled: Boolean(token) && isAuthChecked,
      staleTime: 0
   });
   const info = invite.data;

   // Signed in on a link they can use: take the code and move on.
   useEffect(() => {
      if (!signedIn || !info || claimStarted.current) return;
      if (info.claimed) {
         clearParkedAffiliateInvite();
         return;
      }
      claimStarted.current = true;
      claimAffiliateInvite(token)
         .then(async () => {
            clearParkedAffiliateInvite();
            const fresh = await dispatch(fetchUser()).unwrap();
            if (fresh?.userRole === 'affiliate' && !fresh.walletAddress) {
               navigate(`/onboarding/wallet?returnTo=${AFFILIATE_WALLET_RETURN_TO}`, { replace: true });
            } else {
               navigate('/affiliate', { replace: true });
            }
         })
         .catch((err: { message?: string }) => {
            clearParkedAffiliateInvite();
            setClaimError(claimErrorMessage(err?.message));
         });
   }, [signedIn, info, token, dispatch, navigate]);

   const start = (to: '/sign-up' | '/sign-in') => {
      parkAffiliateInvite(token);
      rememberNextPath(partnerPath(token));
      navigate(to, { state: { from: { pathname: partnerPath(token) } } });
   };

   if (!isAuthChecked || invite.isLoading) {
      return (
         <Shell>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#6b55f7]" />
         </Shell>
      );
   }

   const problem =
      claimError ??
      (invite.error ? 'Could not load this link. Check your connection and try again.' : null) ??
      (!info ? "This link doesn't work. Ask the Moodeng team for a new one." : null) ??
      (info.claimed ? 'Someone already used this link. Ask the Moodeng team for a new one.' : null);

   if (problem) {
      return (
         <Shell>
            <img src={DASHBOARD_V2_ASSETS.emptyMoodeng} alt="" className="mx-auto h-[120px] w-auto" />
            <p className="text-[18px] font-semibold text-[#2d2438] dark:text-white">{problem}</p>
            <Link to={signedIn ? '/affiliate' : '/'} className="text-[15px] font-bold text-[#6b55f7] underline underline-offset-2">
               {signedIn ? 'Go to my affiliate page' : 'Go to Moodeng'}
            </Link>
         </Shell>
      );
   }

   if (signedIn) {
      return (
         <Shell>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#6b55f7]" />
            <p className="text-[16px] font-semibold text-[#594d65] dark:text-[#d9cfe6]">Setting up your affiliate account…</p>
         </Shell>
      );
   }

   const name = info?.label?.trim();
   const payout = `$${info?.payout ?? 5}`;
   return (
      <Shell>
         <img src={DASHBOARD_V2_ASSETS.affiliateHero} alt="" className="mx-auto h-[150px] w-auto" />
         <div className="flex flex-col gap-2">
            <h1 className="text-[30px] font-bold leading-[1.15] tracking-[-0.03em] text-[#2d2438] dark:text-white">
               {name ? `Hi ${name}! ` : ''}Join as a Moodeng affiliate
            </h1>
            <p className="text-[16px] font-medium leading-6 text-[#6d6278] dark:text-[#c8b8e8]">
               Earn {payout} for every friend who borrows and pays back on time.
            </p>
         </div>
         <ul className="flex flex-col gap-2 text-left text-[15px] font-semibold text-[#2d2438] dark:text-[#e6def2]">
            <li className="rounded-[14px] bg-[#f3f0ff] px-4 py-3 dark:bg-white/5">🎟️ Your code: {info?.code}</li>
            <li className="rounded-[14px] bg-[#f3f0ff] px-4 py-3 dark:bg-white/5">🙅 No loan, no ID check, no call</li>
            <li className="rounded-[14px] bg-[#f3f0ff] px-4 py-3 dark:bg-white/5">💸 Paid in USDC to your Moodeng wallet</li>
         </ul>
         <div className="flex flex-col gap-2">
            <PrimaryButton onClick={() => start('/sign-up')}>Create my account</PrimaryButton>
            <GhostButton onClick={() => start('/sign-in')}>I already have an account</GhostButton>
         </div>
      </Shell>
   );
}
