import { type FormEvent, useState } from 'react';

import { Check, ChevronLeft, Copy, MessageCircle, Share2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { DASHBOARD_V2_ASSETS, getMoodengAsset } from '@/views/dashboard-v2/assets';
import DesignImage from '@/views/dashboard-v2/components/DesignImage';
import { buildInviteLink } from '@/views/dashboard-v2/dashboardV2Model';
import DashboardV2PreviewBar from '@/views/dashboard-v2/DashboardV2Preview';
import { useDashboardV2Preview } from '@/views/dashboard-v2/useDashboardV2Preview';

// These screens extend the designer's system (her type, colors, pills and art) to flows she did not
// draw. Referral tracking and voucher fulfilment have no backend yet — nothing here is saved or sent.

const PRIMARY_GRADIENT = 'linear-gradient(77.66deg, #9584ff 0.5%, #6b55f7 98.16%)';

const FIELD =
   'h-12 w-full rounded-[12px] border-2 border-[#e8e4ff] bg-white px-3.5 text-[16px] text-[#0f172b] outline-none placeholder:text-[#c0b9c8] focus:border-[#7b67f9]';

/** "You earned a GrabFood voucher" — contact capture so the team can send the voucher code. */
export function VoucherClaimPopup({ onClose }: { onClose: () => void }) {
   const [isSubmitted, setIsSubmitted] = useState(false);

   const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      // TODO(backend): persist the claim (name, mobile, email) and notify the team.
      setIsSubmitted(true);
   };

   return (
      <div
         className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 px-5"
         role="dialog"
         aria-modal="true"
         aria-labelledby="dv2-voucher-title"
         onClick={onClose}
      >
         <div className="flex w-full max-w-[400px] flex-col items-center" onClick={(event) => event.stopPropagation()}>
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
                        We&apos;ll send your ₱50 GrabFood voucher code to your mobile within 2 business days.
                     </p>
                     <p className="text-[12px] text-[#c0b9c8]">Preview only — details are not sent yet.</p>
                  </div>
               ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3">
                     <div className="flex items-center gap-2">
                        <DesignImage src={DASHBOARD_V2_ASSETS.coupon} className="h-20 w-20 object-contain" />
                        <span className="text-[34px] font-black text-[#3c8248]">₱50</span>
                     </div>
                     <p id="dv2-voucher-title" className="text-[22px] font-bold leading-6 text-[#594d65]">
                        You repaid on time. Treat yourself!
                     </p>
                     <p className="text-[16px] leading-5 text-[#45556c]">Tell us where to send your GrabFood voucher code.</p>
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
                     <button
                        type="submit"
                        className="mt-1 flex h-[52px] w-full items-center justify-center rounded-[35px] text-[20px] font-semibold text-white"
                        style={{ backgroundImage: PRIMARY_GRADIENT }}
                     >
                        Send My Voucher
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

const STEPS = [
   { title: 'Share your link', body: 'Send it to a friend on Messenger, WhatsApp or SMS.' },
   { title: 'Your friend joins & verifies', body: 'They sign up with your link and verify their ID.' },
   { title: 'They repay their first loan on time', body: 'You both get a ₱50 GrabFood voucher — kumain kayong dalawa!' }
];

/** Invite screen behind the "Mag-refer" banner. */
export function DashboardV2Referral() {
   const { model, previewState, isSignedIn, language, previewSearch } = useDashboardV2Preview();
   const [isCopied, setIsCopied] = useState(false);
   const inviteLink = model.referralCode ? buildInviteLink(model.referralCode) : null;
   const shareText = `Join me on Moodeng Credit — small loans with clear terms. Repay your first loan on time and we both get a GrabFood voucher! ${inviteLink ?? ''}`;

   const copyLink = async () => {
      if (!inviteLink) return;
      try {
         await navigator.clipboard.writeText(inviteLink);
         setIsCopied(true);
         window.setTimeout(() => setIsCopied(false), 2000);
      } catch {
         setIsCopied(false);
      }
   };

   const shareNative = async () => {
      if (!inviteLink) return;
      if (navigator.share) {
         await navigator.share({ title: 'Moodeng Credit', text: shareText, url: inviteLink }).catch(() => undefined);
         return;
      }
      await copyLink();
   };

   return (
      <div className="min-h-screen bg-[#f7f7f7]">
         <div className="mx-auto max-w-[440px] pb-28">
            <DashboardV2PreviewBar previewState={previewState} isSignedIn={isSignedIn} language={language} />
            <header className="relative flex h-16 items-end justify-center px-5 pb-1">
               <Link
                  to={`/dashboard-v2-preview${previewSearch}`}
                  className="absolute bottom-1 left-5 text-[#594d65]"
                  aria-label="Back to dashboard"
               >
                  <ChevronLeft className="h-6 w-6" strokeWidth={2} />
               </Link>
               <h1 className="text-[24px] font-semibold leading-[1.1] tracking-[-0.48px] text-[#594d65]">
                  {language === 'fil' ? 'Mag-refer' : 'Invite a Friend'}
               </h1>
            </header>

            <section className="relative mx-5 mt-8 overflow-hidden rounded-[16px] bg-[#ffef85] px-5 pb-5 pt-5">
               <DesignImage
                  src={DASHBOARD_V2_ASSETS.voucherBannerFood}
                  className="absolute -right-3 top-0 h-[104px] w-[185px] object-contain"
               />
               <p className="relative text-[30px] font-black italic leading-[1.1] text-[#3c8248]">₱100</p>
               <p className="relative text-[22px] font-black italic leading-[1.2] text-[#3c8248]">GrabFood Voucher</p>
               <p className="relative mt-3 max-w-[58%] text-[15px] font-medium leading-5 text-[#6f7d1d]">
                  ₱50 for you, ₱50 for your friend — {language === 'fil' ? 'kumain kayong dalawa!' : 'eat together!'}
               </p>
            </section>

            <section className="mx-5 mt-6 rounded-[16px] bg-white p-4">
               <p className="text-[18px] font-medium text-[#0f172b]">Your invite link</p>
               <div className="mt-3 flex items-center gap-2 rounded-[12px] border-2 border-[#e8e4ff] bg-[#f8f6ff] px-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[15px] text-[#594d65]">{inviteLink ?? 'Sign in to get your link'}</span>
                  <button
                     type="button"
                     onClick={copyLink}
                     disabled={!inviteLink}
                     className="flex items-center gap-1 text-[15px] font-semibold text-[#6b55f7] disabled:opacity-40"
                  >
                     {isCopied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                     {isCopied ? 'Copied' : 'Copy'}
                  </button>
               </div>
               <div className="mt-3 grid grid-cols-2 gap-2">
                  <a
                     href={inviteLink ? `fb-messenger://share/?link=${encodeURIComponent(inviteLink)}` : undefined}
                     target="_blank"
                     rel="noreferrer"
                     className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-[#e0dbff] text-[15px] font-semibold text-[#5640e0]"
                  >
                     <MessageCircle className="h-4 w-4" aria-hidden="true" />
                     Messenger
                  </a>
                  <a
                     href={inviteLink ? `https://wa.me/?text=${encodeURIComponent(shareText)}` : undefined}
                     target="_blank"
                     rel="noreferrer"
                     className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-[#e3f5e8] text-[15px] font-semibold text-[#2f8a4a]"
                  >
                     <MessageCircle className="h-4 w-4" aria-hidden="true" />
                     WhatsApp
                  </a>
               </div>
               <button
                  type="button"
                  onClick={shareNative}
                  disabled={!inviteLink}
                  className="mt-3 flex h-[52px] w-full items-center justify-center gap-2 rounded-[35px] text-[20px] font-semibold text-white disabled:opacity-50"
                  style={{ backgroundImage: PRIMARY_GRADIENT }}
               >
                  <Share2 className="h-5 w-5" aria-hidden="true" />
                  Share Invite
               </button>
            </section>

            <section className="mx-5 mt-6">
               <h2 className="text-[22px] font-black italic leading-[18px] text-[#594d65]">How it works</h2>
               <ol className="mt-4 flex flex-col rounded-[16px] bg-white px-3">
                  {STEPS.map((step, index) => (
                     <li key={step.title} className="flex items-center gap-2 border-b border-[#ece9f1] py-3.5 last:border-0">
                        <span className="relative h-10 w-10 shrink-0">
                           <DesignImage
                              src={index === 2 ? DASHBOARD_V2_ASSETS.coupon : DASHBOARD_V2_ASSETS.pandesal}
                              className="h-10 w-10 object-contain"
                           />
                           <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#6b55f7] text-[11px] font-bold text-white">
                              {index + 1}
                           </span>
                        </span>
                        <span>
                           <span className="block text-[17px] font-medium leading-6 text-[#0f172b]">{step.title}</span>
                           <span className="block text-[15px] leading-[18px] text-[#45556c]">{step.body}</span>
                        </span>
                     </li>
                  ))}
               </ol>
            </section>

            <section className="mx-5 mt-6 rounded-[16px] bg-white px-4 py-5 text-center">
               <p className="text-[18px] font-medium text-[#0f172b]">Your invites</p>
               <p className="mt-1 text-[14px] font-medium tracking-[-0.28px] text-[#877897]">
                  No friends invited yet. Share your link to start!
               </p>
            </section>
         </div>
      </div>
   );
}

/** Public page an invited friend lands on from the shared link. */
export function DashboardV2InviteLanding() {
   const { code = '' } = useParams();
   const inviter = decodeURIComponent(code);

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
                  <p className="text-[24px] font-black italic leading-7 text-[#4c239f]">{inviter || 'a friend'}</p>
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
               <p className="relative max-w-[60%] text-[20px] font-black italic leading-6 text-[#3c8248]">₱50 GrabFood voucher each</p>
               <p className="relative mt-1 max-w-[60%] text-[14px] font-medium leading-5 text-[#6f7d1d]">
                  When you repay your first loan on time, you and {inviter || 'your friend'} both get one.
               </p>
            </div>

            <Link
               to={`/sign-up?ref=${encodeURIComponent(inviter)}`}
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
