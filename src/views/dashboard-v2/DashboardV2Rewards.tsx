import { type FormEvent, useEffect, useRef, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Link, useParams } from 'react-router-dom';

import { useSubmitVoucherClaim } from '@/hooks/useFriendReferrals';

import {
   type ClaimableVoucher,
   getInviteInviter,
   GRABMART_MIN_PHP,
   isValidInviteCode,
   normalizeInviteCode,
   rememberPendingInvite,
   type VoucherBrand,
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
   'h-12 w-full rounded-[12px] border-2 border-[#e8e4ff] bg-dv2-card px-3.5 text-[16px] text-[#0f172b] outline-none placeholder:text-[#c0b9c8] focus:border-[#7b67f9] dark:border-[#3a2f55] dark:bg-dv2-page dark:focus:border-[#7b67f9]';

const CLAIM_HEADLINE: Record<VoucherReward, string> = {
   first_on_time_repayment: 'You repaid on time. Treat yourself!',
   referral_inviter: 'Your friend repaid on time. Free meal!',
   referral_invitee: 'You repaid on time. Free meal!',
   tier_rising: 'Moodeng grew to Rising. Treat yourself!',
   tier_prime: 'Moodeng grew to Prime. Treat yourself!',
   tier_apex: 'Moodeng reached Apex. Feast time!'
};

/** The two Moo-Menu picks, drawn as the designer's referral voucher tickets. GrabMart only comes from ₱100 (its smallest card). */
const MOO_MENU: Array<{ brand: VoucherBrand; title: string; detail: string; where: string; art: string; ticket: string; tag: string }> = [
   {
      brand: 'food',
      title: 'Moo-food',
      detail: 'Jollibee + 4 more',
      where: 'Anywhere in PH',
      art: DASHBOARD_V2_ASSETS.foodJollibee,
      ticket: 'linear-gradient(180deg, #ffffff 0%, #ebe7ff 55%, #dcd5ff 100%)',
      tag: 'bg-[#f1ccfd] text-[#6b55f7]'
   },
   {
      brand: 'grabmart',
      title: 'Moo-snacks',
      detail: 'GrabMart',
      where: 'Manila & Cebu only',
      art: DASHBOARD_V2_ASSETS.foodGrabMart,
      ticket: 'linear-gradient(180deg, #fff9c4 0%, #fff087 55%, #ffea62 100%)',
      tag: 'bg-[#faf173] text-[#5a3a12]'
   }
];

/** The other restaurants on the Xoxo link, shown small under Jollibee. */
const MORE_RESTAURANTS = [
   { name: 'Chowking', art: DASHBOARD_V2_ASSETS.foodChowking },
   { name: 'Greenwich', art: DASHBOARD_V2_ASSETS.foodGreenwich },
   { name: 'Mang Inasal', art: DASHBOARD_V2_ASSETS.foodMangInasal },
   { name: 'Red Ribbon', art: DASHBOARD_V2_ASSETS.foodRedRibbon }
];

/** A food icon on a small white plate (the icons carry a soft shadow that needs a light ground). */
function FoodIcon({ src, label, size }: { src: string; label: string; size: 'lg' | 'md' | 'sm' }) {
   return (
      <span
         className={clsx(
            'flex shrink-0 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(80,60,120,0.18)]',
            size === 'lg' ? 'h-[72px] w-[72px]' : size === 'md' ? 'h-14 w-14' : 'h-7 w-7'
         )}
         title={label}
      >
         <DesignImage
            src={src}
            alt={label}
            className={size === 'lg' ? 'h-[60px] w-[60px] object-contain' : size === 'md' ? 'h-12 w-12 object-contain' : 'h-6 w-6 object-contain'}
         />
      </span>
   );
}

const describeClaimError = (error: unknown) => {
   const message = error instanceof Error ? error.message : String((error as { message?: string } | null)?.message ?? '');
   if (message.includes('already claimed')) return 'This voucher was already claimed.';
   if (message.includes('not eligible')) return "This voucher isn't unlocked yet.";
   if (message.includes('email required')) return 'Please add your email — your voucher is sent there.';
   if (message.includes('grabmart needs 100')) return 'GrabMart starts at ₱100. Pick Moo-food for this one.';
   if (message.includes('check constraint')) return 'Please check your name and mobile number.';
   return 'Something went wrong. Please try again.';
};

type MooStep = 'pick' | 'area' | 'details' | 'sent';

/**
 * The Moo-Menu: "You earned a voucher" → pick Moo-food (Jollibee & 4 more restaurants, Xoxo link) or Moo-snacks
 * (GrabMart, ₱100+) → for GrabMart, "are you in Metro Manila or Cebu?" (a No switches them to Moo-food; IP location
 * can't tell, since Philippine mobile data mostly exits in Manila) → where to send it → on its way. Real claims are validated and stored by
 * submit_voucher_claim() and sent automatically; preview samples only simulate the submission.
 */
export function VoucherClaimPopup({
   voucher,
   isPreview,
   onClose,
   initialStep = 'pick'
}: {
   voucher: ClaimableVoucher;
   isPreview: boolean;
   onClose: () => void;
   initialStep?: MooStep;
}) {
   const [step, setStep] = useState<MooStep>(initialStep);
   const [brand, setBrand] = useState<VoucherBrand>('food');
   const submitClaim = useSubmitVoucherClaim();
   const canGrabMart = voucher.amountPhp >= GRABMART_MIN_PHP;
   const picked = MOO_MENU.find((item) => item.brand === brand) ?? MOO_MENU[0];

   const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isPreview) {
         setStep('sent');
         return;
      }
      const form = new FormData(event.currentTarget);
      submitClaim.mutate(
         {
            reward: voucher.reward,
            friendReferralId: voucher.friendReferralId,
            fullName: String(form.get('name') ?? ''),
            mobile: String(form.get('mobile') ?? ''),
            email: String(form.get('email') ?? ''),
            brand
         },
         { onSuccess: () => setStep('sent') }
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
            <p className="mb-2 text-center text-[26px] font-black italic leading-7 text-[#3c8248] underline decoration-[#4aa256] decoration-4 underline-offset-8 dark:text-[#7fd68b]">
               {step === 'sent' ? 'Moo-redeemed!' : 'Moo-Menu'}
            </p>
            <div className="w-full rounded-[26px] bg-gradient-to-b from-[#fff6c2] via-white via-40% to-white px-5 pb-6 pt-5 text-center dark:from-[#3a3216] dark:via-dv2-card dark:to-dv2-card">
               {step === 'pick' ? (
                  <div className="flex flex-col items-center gap-3">
                     <DesignImage src={DASHBOARD_V2_ASSETS.mooMenuChef} alt="" className="h-28 w-28 object-contain" />
                     <p id="dv2-voucher-title" className="text-[22px] font-bold leading-6 text-[#594d65] dark:text-[#e6def2]">
                        {CLAIM_HEADLINE[voucher.reward]}
                     </p>
                     <p className="text-[16px] leading-5 text-[#45556c]">Pick your treat</p>
                     <div className="grid w-full grid-cols-2 gap-2.5">
                        {MOO_MENU.map((item) => {
                           const disabled = item.brand === 'grabmart' && !canGrabMart;
                           const isPicked = brand === item.brand;
                           return (
                              <button
                                 key={item.brand}
                                 type="button"
                                 disabled={disabled}
                                 aria-pressed={isPicked}
                                 onClick={() => setBrand(item.brand)}
                                 className={clsx(
                                    'relative mt-3 flex flex-col items-center rounded-[14px] px-2 pb-3 pt-6 text-center',
                                    isPicked && !disabled ? 'shadow-[0_0_0_3px_#6b55f7]' : 'shadow-[0_1px_4px_rgba(80,60,120,0.15)]',
                                    disabled && 'opacity-50'
                                 )}
                                 style={{ backgroundImage: item.ticket }}
                              >
                                 {/* Tag on the corner, like the designer's "For You" / "For Friend" tickets. */}
                                 <span
                                    className={clsx(
                                       'absolute -left-1.5 -top-3 -rotate-6 rounded-[8px] rounded-bl-none px-2 py-0.5 text-[12px] font-bold shadow-sm',
                                       item.tag
                                    )}
                                 >
                                    {item.where}
                                 </span>
                                 <FoodIcon src={item.art} label={item.brand === 'food' ? 'Jollibee' : 'GrabMart'} size="md" />
                                 {item.brand === 'food' ? (
                                    <span className="mt-1 flex justify-center gap-0.5" aria-label="Also Chowking, Greenwich, Mang Inasal and Red Ribbon">
                                       {MORE_RESTAURANTS.map((place) => (
                                          <FoodIcon key={place.name} src={place.art} label={place.name} size="sm" />
                                       ))}
                                    </span>
                                 ) : (
                                    <span className="mt-1 h-7" aria-hidden="true" />
                                 )}
                                 <span className="mt-1 text-[36px] font-black italic leading-[40px] text-[#745ff8]">
                                    <span className="text-[26px]">₱</span>
                                    {disabled ? GRABMART_MIN_PHP : voucher.amountPhp}
                                 </span>
                                 <span className="text-[15px] font-black italic leading-5 text-[#745ff8]">{item.title}</span>
                                 <span className="text-[12px] font-semibold leading-4 text-[#7b6b8c]">{item.detail}</span>
                                 {/* Tear line with notches at both edges. */}
                                 <span className="relative my-2.5 w-full border-t-2 border-dashed border-[#745ff8]/30" aria-hidden="true">
                                    <span className="absolute -left-[17px] -top-[9px] h-4 w-4 rounded-full bg-white dark:bg-dv2-card" />
                                    <span className="absolute -right-[17px] -top-[9px] h-4 w-4 rounded-full bg-white dark:bg-dv2-card" />
                                 </span>
                                 <span
                                    className={clsx(
                                       'flex h-9 w-full items-center justify-center rounded-full text-[15px] font-semibold text-white',
                                       !(isPicked && !disabled) && 'bg-gradient-to-r from-[#b4b1c4] to-[#7d7a8e]'
                                    )}
                                    style={isPicked && !disabled ? { backgroundImage: PRIMARY_GRADIENT } : undefined}
                                 >
                                    {disabled ? `Needs ₱${GRABMART_MIN_PHP}` : isPicked ? 'Picked ✓' : 'Pick'}
                                 </span>
                              </button>
                           );
                        })}
                     </div>
                     <button
                        type="button"
                        onClick={() => setStep(brand === 'grabmart' ? 'area' : 'details')}
                        className="mt-1 flex h-[52px] w-full items-center justify-center rounded-[35px] text-[20px] font-semibold text-white"
                        style={{ backgroundImage: PRIMARY_GRADIENT }}
                     >
                        Moo-redeem!
                     </button>
                  </div>
               ) : step === 'area' ? (
                  <div className="flex flex-col items-center gap-3 py-1">
                     <FoodIcon src={DASHBOARD_V2_ASSETS.foodGrabMart} label="GrabMart" size="lg" />
                     <p id="dv2-voucher-title" className="text-[22px] font-bold leading-7 text-[#594d65] dark:text-[#e6def2]">
                        Are you in Metro Manila or Cebu?
                     </p>
                     <p className="text-[16px] leading-[22px] text-[#45556c]">GrabMart only delivers there.</p>
                     <button
                        type="button"
                        onClick={() => setStep('details')}
                        className="mt-1 flex h-[52px] w-full items-center justify-center rounded-[35px] text-[18px] font-semibold text-white"
                        style={{ backgroundImage: PRIMARY_GRADIENT }}
                     >
                        Yes, I&apos;m there
                     </button>
                     <button
                        type="button"
                        onClick={() => {
                           setBrand('food');
                           setStep('pick');
                        }}
                        className="flex h-[52px] w-full items-center justify-center rounded-[35px] border-2 border-[#e8e4ff] bg-white text-[18px] font-semibold text-[#6b55f7] dark:border-[#3a2f55] dark:bg-dv2-page dark:text-[#9b8bff]"
                     >
                        No, give me Moo-food
                     </button>
                  </div>
               ) : step === 'details' ? (
                  <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3">
                     <div className="flex items-center gap-2">
                        <FoodIcon src={picked.art} label={picked.detail} size="lg" />
                        <div className="text-left">
                           <p className="text-[18px] font-black italic leading-5 text-[#3c8248] dark:text-[#7fd68b]">{picked.title}</p>
                           <p className="text-[24px] font-black text-[#3c8248] dark:text-[#7fd68b]">₱{voucher.amountPhp}</p>
                        </div>
                     </div>
                     <p id="dv2-voucher-title" className="text-[16px] leading-5 text-[#45556c]">
                        Where should we send your {brand === 'food' ? 'food' : 'GrabMart'} voucher?
                     </p>
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
                        required
                        autoComplete="email"
                        placeholder="Email (we send your voucher here)"
                        aria-label="Email"
                     />
                     {submitClaim.error ? (
                        <p className="text-[14px] font-medium text-[#d51728] dark:text-[#ff8a96]" role="alert">
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
                     <button type="button" onClick={() => setStep('pick')} className="text-[14px] font-semibold text-[#6b55f7]">
                        Back to the Moo-Menu
                     </button>
                  </form>
               ) : (
                  <div className="flex flex-col items-center gap-3 py-2">
                     <DesignImage src={DASHBOARD_V2_ASSETS.mooEnvelope} alt="" className="h-32 w-32 object-contain" />
                     <p id="dv2-voucher-title" className="text-[22px] font-bold leading-7 text-[#594d65] dark:text-[#e6def2]">
                        Your treat is mooo-ving to your email!
                     </p>
                     <p className="text-[16px] leading-[22px] text-[#45556c]">
                        Your ₱{voucher.amountPhp} {brand === 'food' ? 'food' : 'GrabMart'} voucher is on its way.
                        {brand === 'food'
                           ? ' Open it, pick your restaurant and show the code at the counter.'
                           : ' Open the email and use the code in the Grab app → Mart.'}
                     </p>
                     <p className="text-[14px] leading-5 text-[#7b6b8c]">We&apos;ll ask on your dashboard if it arrived.</p>
                     {isPreview ? (
                        <p className="text-[12px] text-[#c0b9c8] dark:text-[#8f819e]">Preview sample — nothing was sent.</p>
                     ) : null}
                  </div>
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
         className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center sm:px-5"
         role="dialog"
         aria-modal="true"
         aria-labelledby="dv2-share-title"
         onClick={onClose}
      >
         <div
            className="relative w-full max-w-[440px] rounded-t-[28px] bg-white pb-8 pt-5 sm:rounded-[28px] sm:pb-6"
            onClick={(event) => event.stopPropagation()}
         >
            <div className="flex items-center justify-between px-5">
               <h2 id="dv2-share-title" className="text-[20px] font-medium text-[#594d65]">
                  Share
               </h2>
               <button type="button" onClick={onClose} className="h-6 w-6" aria-label="Close share">
                  <DesignImage src={DASHBOARD_V2_ASSETS.shareClose} className="h-4 w-4" />
               </button>
            </div>
            <div
               ref={rowRef}
               className="mt-4 flex gap-[14.5px] overflow-x-auto px-[27px] pb-1 pr-16 sm:justify-between sm:gap-0 sm:overflow-visible sm:px-5"
               style={{ scrollbarWidth: 'none' }}
            >
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
               className="absolute right-2 top-[62px] h-[52px] w-[52px] sm:hidden"
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
         ? `Libreng pagkain para sa ating dalawa! Sumali sa Moodeng Credit gamit ang code ko na ${code}:`
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
               <Link to={`/dashboard${previewSearch}`} className="absolute left-[4.5%] top-[81px] h-6 w-6" aria-label="Back to dashboard">
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
