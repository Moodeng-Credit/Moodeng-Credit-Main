import { type FormEvent, useEffect, useRef, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { useSubmitVoucherClaim } from '@/hooks/useFriendReferrals';

import {
   type ClaimableVoucher,
   getInviteInviter,
   isValidInviteCode,
   normalizeInviteCode,
   rememberPendingInvite,
   type VoucherReward
} from '@/lib/friendReferrals';
import { isPreviewHost } from '@/lib/previewHost';
import { isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { DASHBOARD_V2_ASSETS, getMoodengAsset } from '@/views/dashboard-v2/assets';
import DesignImage from '@/views/dashboard-v2/components/DesignImage';
import { buildInviteLink, getVoucherState, REFERRAL_VOUCHERS } from '@/views/dashboard-v2/dashboardV2Model';
import DashboardV2PreviewBar from '@/views/dashboard-v2/DashboardV2Preview';
import { useDashboardV2Preview } from '@/views/dashboard-v2/useDashboardV2Preview';

// These screens extend the designer's system (her type, colors, pills and art) to flows she did not
// draw. Referral tracking and voucher fulfilment have no backend yet — nothing here is saved or sent.

const PRIMARY_GRADIENT = 'linear-gradient(77.66deg, #9584ff 0.5%, #6b55f7 98.16%)';

const FIELD =
   'h-12 w-full rounded-[12px] border-2 border-[#e8e4ff] bg-white px-3.5 text-[16px] text-[#0f172b] outline-none placeholder:text-[#c0b9c8] focus:border-[#7b67f9]';

const CLAIM_COPY: Record<VoucherReward, { headline: string; body: string }> = {
   first_on_time_repayment: { headline: 'You repaid on time. Treat yourself!', body: 'Tell us where to send your GrabFood voucher code.' },
   referral_inviter: {
      headline: 'Your friend repaid on time. Free meal!',
      body: 'Thanks for inviting them. Where should we send your voucher code?'
   },
   referral_invitee: {
      headline: 'You repaid on time. Free meal!',
      body: 'Thanks for joining with a friend. Where should we send your voucher code?'
   }
};

const describeClaimError = (error: unknown) => {
   const message = error instanceof Error ? error.message : String((error as { message?: string } | null)?.message ?? '');
   if (message.includes('already claimed')) return 'This voucher was already claimed.';
   if (message.includes('not eligible')) return "This voucher isn't unlocked yet.";
   if (message.includes('check constraint')) return 'Please check your name and mobile number.';
   return 'Something went wrong. Please try again.';
};

/**
 * "You earned a GrabFood voucher" — collects where to send the code. Real claims are validated and
 * stored by submit_voucher_claim(); preview samples only simulate the submission.
 */
export function VoucherClaimPopup({ voucher, isPreview, onClose }: { voucher: ClaimableVoucher; isPreview: boolean; onClose: () => void }) {
   const [isSubmitted, setIsSubmitted] = useState(false);
   const submitClaim = useSubmitVoucherClaim();
   const copy = CLAIM_COPY[voucher.reward];

   const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isPreview) {
         setIsSubmitted(true);
         return;
      }
      const form = new FormData(event.currentTarget);
      submitClaim.mutate(
         {
            reward: voucher.reward,
            friendReferralId: voucher.friendReferralId,
            fullName: String(form.get('name') ?? ''),
            mobile: String(form.get('mobile') ?? ''),
            email: String(form.get('email') ?? '')
         },
         { onSuccess: () => setIsSubmitted(true) }
      );
   };

   return (
      <div
         className="fixed inset-0 z-[80] flex overflow-y-auto overscroll-contain bg-black/80 px-5 py-6"
         role="dialog"
         aria-modal="true"
         aria-labelledby="dv2-voucher-title"
         onClick={onClose}
      >
         {/* m-auto centres the popup when it fits and lets it scroll on short screens (small or landscape phones). */}
         <div className="m-auto flex w-full max-w-[400px] flex-col items-center" onClick={(event) => event.stopPropagation()}>
            <p className="mb-2 text-center text-[26px] font-black italic leading-7 text-[#3c8248] underline decoration-[#4aa256] decoration-4 underline-offset-8">
               Voucher Unlocked!
            </p>
            <div className="w-full rounded-[26px] bg-gradient-to-b from-[#fff6c2] via-white via-40% to-white px-5 pb-6 pt-5 text-center">
               {isSubmitted ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                     <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#4aa256]">
                        <Check className="h-8 w-8 text-white" strokeWidth={3} aria-hidden="true" />
                     </span>
                     <p id="dv2-voucher-title" className="text-[24px] font-bold leading-7 text-[#594d65]">
                        Salamat! We got it.
                     </p>
                     <p className="text-[16px] leading-[22px] text-[#45556c]">
                        We&apos;ll send your ₱{voucher.amountPhp} GrabFood voucher code to your mobile within 2 business days.
                     </p>
                     {isPreview ? <p className="text-[12px] text-[#c0b9c8]">Preview sample — nothing was sent.</p> : null}
                  </div>
               ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3">
                     <div className="flex items-center gap-2">
                        <DesignImage src={DASHBOARD_V2_ASSETS.coupon} className="h-20 w-20 object-contain" />
                        <span className="text-[34px] font-black text-[#3c8248]">₱{voucher.amountPhp}</span>
                     </div>
                     <p id="dv2-voucher-title" className="text-[22px] font-bold leading-6 text-[#594d65]">
                        {copy.headline}
                     </p>
                     <p className="text-[16px] leading-5 text-[#45556c]">{copy.body}</p>
                     <input className={FIELD} name="name" required autoComplete="name" placeholder="Full name" aria-label="Full name" />
                     <input
                        className={FIELD}
                        name="mobile"
                        required
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="Mobile number (GCash)"
                        aria-label="Mobile number"
                     />
                     <input
                        className={FIELD}
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="Email (optional)"
                        aria-label="Email"
                     />
                     {submitClaim.error ? (
                        <p className="text-[14px] font-medium text-[#d51728]" role="alert">
                           {describeClaimError(submitClaim.error)}
                        </p>
                     ) : null}
                     <button
                        type="submit"
                        disabled={submitClaim.isPending}
                        className="mt-1 flex h-[52px] w-full items-center justify-center rounded-[35px] text-[20px] font-semibold text-white disabled:opacity-60"
                        style={{ backgroundImage: PRIMARY_GRADIENT }}
                     >
                        {submitClaim.isPending ? 'Sending…' : 'Send My Voucher'}
                     </button>
                  </form>
               )}
            </div>
            <button type="button" onClick={onClose} className="mt-14 h-[50px] w-[50px]" aria-label="Close">
               <DesignImage src={DASHBOARD_V2_ASSETS.closeLarge} className="h-[50px] w-[50px]" />
            </button>
         </div>
      </div>
   );
}

const SHARE_TARGETS = [
   { id: 'embed', label: 'Embed', icon: DASHBOARD_V2_ASSETS.shareEmbed },
   { id: 'whatsapp', label: 'WhatsApp', icon: DASHBOARD_V2_ASSETS.shareWhatsapp },
   { id: 'facebook', label: 'Facebook', icon: DASHBOARD_V2_ASSETS.shareFacebook },
   { id: 'x', label: 'X', icon: DASHBOARD_V2_ASSETS.shareX },
   { id: 'email', label: 'Email', icon: DASHBOARD_V2_ASSETS.shareEmail },
   { id: 'reddit', label: 'Reddit', icon: DASHBOARD_V2_ASSETS.shareReddit }
] as const;

type ShareTargetId = (typeof SHARE_TARGETS)[number]['id'];

const SHARE_TITLE = 'Free meal for both of us — Moodeng Credit';

const getShareUrl = (target: Exclude<ShareTargetId, 'embed'>, link: string, text: string) => {
   const url = encodeURIComponent(link);
   const message = encodeURIComponent(`${text} ${link}`);
   switch (target) {
      case 'whatsapp':
         return `https://wa.me/?text=${message}`;
      case 'facebook':
         return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
      case 'x':
         return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`;
      case 'email':
         return `mailto:?subject=${encodeURIComponent(SHARE_TITLE)}&body=${message}`;
      case 'reddit':
         return `https://www.reddit.com/submit?url=${url}&title=${encodeURIComponent(SHARE_TITLE)}`;
   }
};

/** Figma "invite_popup" share sheet. "Embed" hands off to the phone's own share menu (or copies the link). */
export function ShareSheet({ link, text, onClose, onCopied }: { link: string; text: string; onClose: () => void; onCopied: () => void }) {
   const rowRef = useRef<HTMLDivElement>(null);
   const shareNative = async () => {
      if (navigator.share) {
         await navigator.share({ title: SHARE_TITLE, text, url: link }).catch(() => undefined);
         return;
      }
      await navigator.clipboard.writeText(link).then(onCopied, () => undefined);
   };

   return (
      <div
         className="fixed inset-0 z-[80] flex items-end justify-center"
         role="dialog"
         aria-modal="true"
         aria-labelledby="dv2-share-title"
         onClick={onClose}
      >
         <div className="relative w-full max-w-[440px] rounded-t-[28px] bg-white pb-8 pt-5" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between px-5">
               <h2 id="dv2-share-title" className="text-[20px] font-medium text-[#594d65]">
                  Share
               </h2>
               <button type="button" onClick={onClose} className="h-6 w-6" aria-label="Close share">
                  <DesignImage src={DASHBOARD_V2_ASSETS.shareClose} className="h-4 w-4" />
               </button>
            </div>
            <div ref={rowRef} className="mt-4 flex gap-[14.5px] overflow-x-auto px-[27px] pb-1 pr-16" style={{ scrollbarWidth: 'none' }}>
               {SHARE_TARGETS.map((target) =>
                  target.id === 'embed' ? (
                     <button
                        key={target.id}
                        type="button"
                        onClick={shareNative}
                        className="flex w-[52px] shrink-0 flex-col items-center gap-1.5"
                     >
                        <DesignImage src={target.icon} className="h-[52px] w-[52px]" />
                        <span className="text-[13px] text-[#c0b9c8]">{target.label}</span>
                     </button>
                  ) : (
                     <a
                        key={target.id}
                        href={getShareUrl(target.id, link, text)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex w-[52px] shrink-0 flex-col items-center gap-1.5"
                     >
                        <DesignImage src={target.icon} className="h-[52px] w-[52px]" />
                        <span className="whitespace-nowrap text-[13px] text-[#c0b9c8]">{target.label}</span>
                     </a>
                  )
               )}
            </div>
            <button
               type="button"
               onClick={() => rowRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
               className="absolute right-2 top-[62px] h-[52px] w-[52px]"
               aria-label="More share options"
            >
               <DesignImage src={DASHBOARD_V2_ASSETS.shareNext} className="h-[52px] w-[52px]" />
            </button>
         </div>
      </div>
   );
}

const COPY_GRADIENT = 'linear-gradient(90deg, #ffe27a 0%, #f6b73c 100%)';
const LOCKED_GRADIENT = 'linear-gradient(85.47deg, #b9aeff 0.5%, #8b7afa 57.57%, #6b55f7 98.16%)';

/** Figma "invite" — "FREE MEAL for both of you": referral code, the two ₱100 vouchers, and sharing. */
export function DashboardV2Referral() {
   const { model, previewState, isReal, isSignedIn, language, previewSearch } = useDashboardV2Preview();
   const [isShareOpen, setIsShareOpen] = useState(false);
   const [claimingVoucher, setClaimingVoucher] = useState<ClaimableVoucher | null>(null);
   const referralVoucher = getVoucherState(model.rewards, REFERRAL_VOUCHERS, model.referralLoading);
   const [copied, setCopied] = useState<'code' | null>(null);
   const code = model.referralCode
      ? model.referralCode.toUpperCase()
      : model.referralUnavailable
        ? 'Unavailable right now'
        : isReal
          ? 'Loading…'
          : '—';
   const inviteLink = model.referralCode ? buildInviteLink(model.referralCode) : null;
   const shareText =
      language === 'fil'
         ? 'Libreng pagkain para sa ating dalawa! Sumali sa Moodeng Credit gamit ang code ko:'
         : `Free meal for both of us! Join Moodeng Credit with my code ${code}:`;

   const copyCode = async () => {
      if (!model.referralCode) return;
      try {
         await navigator.clipboard.writeText(code);
         setCopied('code');
         window.setTimeout(() => setCopied(null), 2000);
      } catch {
         setCopied(null);
      }
   };

   return (
      <div className="min-h-screen bg-[#efecff]">
         <div className="relative mx-auto max-w-[440px] pb-28">
            {isPreviewHost() ? <DashboardV2PreviewBar previewState={previewState} isSignedIn={isSignedIn} language={language} /> : null}

            {/* The designer's full illustrated card; interactive pieces sit on top at her positions. */}
            <div className="relative aspect-[440/735] w-full">
               <DesignImage
                  src={DASHBOARD_V2_ASSETS.inviteBackground}
                  alt="Free meal for both of you: a ₱100 voucher for you and a ₱100 voucher for your friend."
                  className="absolute inset-0 h-full w-full"
               />
               <Link
                  to={`/dashboard-v2-preview${previewSearch}`}
                  className="absolute left-[4.5%] top-[81px] h-6 w-6"
                  aria-label="Back to dashboard"
               >
                  <DesignImage src={DASHBOARD_V2_ASSETS.back} className="h-6 w-6" />
               </Link>

               {/* Live referral code over the sample code baked into the artwork. */}
               <p className="absolute left-[6.8%] top-[56.4%] flex h-[4%] min-w-[26%] items-center bg-[#745ff8] text-[16px] tracking-[0.5px] text-white">
                  {code}
               </p>
               <button
                  type="button"
                  onClick={copyCode}
                  disabled={!model.referralCode}
                  className="absolute left-[74.8%] top-[54.1%] flex h-[4.6%] w-[18.6%] items-center justify-center rounded-full text-[18px] font-semibold text-[#704518] disabled:opacity-60"
                  style={{ backgroundImage: COPY_GRADIENT }}
               >
                  {copied === 'code' ? 'Copied' : 'Copy'}
               </button>

               {/* For You — claimable once a friend's (or your own, if you were invited) on-time repayment unlocks it. */}
               {referralVoucher.state === 'claimable' ? (
                  <button
                     type="button"
                     onClick={() => setClaimingVoucher(referralVoucher.voucher)}
                     className="absolute left-[17%] top-[78.2%] flex h-[4.6%] w-[25.5%] items-center justify-center rounded-full text-[18px] font-semibold text-[#704518]"
                     style={{ backgroundImage: COPY_GRADIENT }}
                  >
                     Claim
                  </button>
               ) : (
                  <span className="absolute left-[17%] top-[78.2%] flex h-[4.6%] w-[25.5%] items-center justify-center overflow-hidden rounded-full text-[18px] font-semibold text-white">
                     <span className="absolute inset-0" style={{ backgroundImage: LOCKED_GRADIENT }} aria-hidden="true" />
                     <span className="absolute inset-0 bg-white/80 mix-blend-color" aria-hidden="true" />
                     <span className="relative">
                        {referralVoucher.state === 'pending'
                           ? 'Pending'
                           : referralVoucher.state === 'sent'
                             ? 'Sent'
                             : referralVoucher.state === 'rejected'
                               ? 'Rejected'
                               : 'Locked'}
                     </span>
                  </span>
               )}
               <button
                  type="button"
                  onClick={() => setIsShareOpen(true)}
                  disabled={!inviteLink}
                  className="absolute left-[59.5%] top-[78.2%] flex h-[4.6%] w-[25.5%] items-center justify-center rounded-full text-[18px] font-semibold text-white disabled:opacity-60"
                  style={{ backgroundImage: PRIMARY_GRADIENT }}
               >
                  Invite
               </button>

               <p className="absolute inset-x-[10%] top-[91.8%] text-center text-[14px] leading-[14px] text-[#c0b9c8]">
                  You both get a ₱100 voucher once your friend repays their first loan on time. Claim yours here or on your dashboard.
               </p>
            </div>
            {isReal || model.rewards.invitedCount > 0 ? (
               <p className="mt-4 text-center text-[14px] font-medium text-[#7b6b8c]">
                  Friends joined: <span className="text-[#6b55f7]">{model.rewards.invitedCount}</span> · Repaid on time:{' '}
                  <span className="text-[#6b55f7]">{model.rewards.qualifiedCount}</span>
               </p>
            ) : null}
         </div>

         {claimingVoucher ? (
            <VoucherClaimPopup voucher={claimingVoucher} isPreview={!isReal} onClose={() => setClaimingVoucher(null)} />
         ) : null}
         {isShareOpen && inviteLink ? (
            <ShareSheet
               link={inviteLink}
               text={shareText}
               onClose={() => setIsShareOpen(false)}
               onCopied={() => {
                  setCopied('code');
                  window.setTimeout(() => setCopied(null), 2000);
               }}
            />
         ) : null}
      </div>
   );
}

/** Public page an invited friend lands on from the shared link. */
export function DashboardV2InviteLanding() {
   const { code: rawCode = '' } = useParams();
   // useParams already decodes the segment; decoding again would throw on codes like "%".
   const code = normalizeInviteCode(rawCode);
   const isCodeValid = isValidInviteCode(code);
   const inviterQuery = useQuery({
      queryKey: ['friend-referrals', 'inviter', code],
      queryFn: () => getInviteInviter(code),
      enabled: isCodeValid && isSupabaseBrowserConfigured(),
      staleTime: Infinity
   });
   const inviter = inviterQuery.data ?? '';
   const isUnknownCode = !isCodeValid || (inviterQuery.isSuccess && !inviterQuery.data);

   // Park the code so it can be credited right after sign-up (see usePendingInviteRedemption).
   useEffect(() => {
      if (isCodeValid && inviterQuery.data) rememberPendingInvite(code);
   }, [code, isCodeValid, inviterQuery.data]);

   return (
      <div className="min-h-screen bg-[#f7f7f7]">
         <div className="relative mx-auto max-w-[440px] overflow-hidden pb-10">
            <div className="relative h-[360px] overflow-hidden">
               <DesignImage
                  src={DASHBOARD_V2_ASSETS.heroBackground}
                  className="absolute left-0 top-[-54px] h-[414px] w-full object-cover"
               />
               <DesignImage
                  src={getMoodengAsset('rookie', 'repaid')}
                  alt="Moodeng"
                  className="absolute left-1/2 top-[150px] h-[164px] w-[164px] -translate-x-1/2"
               />
               <div className="absolute inset-x-5 top-10 rounded-[16px] bg-[#fffef7]/85 px-4 py-3 text-center">
                  <p className="text-[15px] font-medium text-[#7b6b8c]">You&apos;re invited by</p>
                  <p className="text-[24px] font-black italic leading-7 text-[#4c239f]">{isUnknownCode ? 'a friend' : inviter || '…'}</p>
               </div>
               <div
                  className="absolute inset-x-0 bottom-0 h-[70px] rounded-t-[28px] bg-gradient-to-b from-[#efeaff] to-[#f7f7f7]"
                  aria-hidden="true"
               />
            </div>

            <div className="-mt-2 px-5 text-center">
               <h1 className="text-[28px] font-bold leading-8 text-[#594d65]">Borrow small, build your credit</h1>
               <p className="mt-2 text-[17px] leading-6 text-[#45556c]">
                  Small person-to-person loans with one amount, one date, and no Moodeng fees.
               </p>
            </div>

            <div className="relative mx-5 mt-6 overflow-hidden rounded-[16px] bg-[#ffef85] px-4 py-4">
               <DesignImage
                  src={DASHBOARD_V2_ASSETS.voucherBannerFood}
                  className="absolute -right-4 top-0 h-[90px] w-[160px] object-contain"
               />
               <p className="relative max-w-[60%] text-[20px] font-black italic leading-6 text-[#3c8248]">₱100 GrabFood voucher each</p>
               <p className="relative mt-1 max-w-[60%] text-[14px] font-medium leading-5 text-[#6f7d1d]">
                  When you repay your first loan on time, you and {inviter || 'your friend'} both get one.
               </p>
            </div>

            <Link
               to={isUnknownCode ? '/sign-up' : `/sign-up?invite=${encodeURIComponent(code)}`}
               className="mx-5 mt-6 flex h-[52px] items-center justify-center rounded-[35px] text-[20px] font-semibold text-white"
               style={{ backgroundImage: PRIMARY_GRADIENT }}
            >
               Join Moodeng
            </Link>
            <p className="mt-3 text-center text-[14px] text-[#877897]">
               Already have an account?{' '}
               <Link to="/sign-in" className="font-semibold text-[#4492f1]">
                  Sign in
               </Link>
            </p>
         </div>
      </div>
   );
}
