import clsx from 'clsx';
import { ArrowUpRight, Bell, BellOff, Facebook, Share, Video, Wallet } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { PRE_KYC_CONNECT_PATH, usePreKycGate } from '@/hooks/usePreKycGate';
import { useLocalization } from '@/i18n/LocalizationProvider';
import type { RootState } from '@/store/store';

import { DASHBOARD_V2_ASSETS } from '@/views/dashboard-v2/assets';
import DesignImage from '@/views/dashboard-v2/components/DesignImage';
import type { DashboardV2Language } from '@/views/dashboard-v2/types';

// Banners are exported from Figma as whole 440px-wide frames (20px side margins and copy baked in),
// so each renders full width at its native aspect ratio.
const BANNER_BUTTON = 'block w-full transition active:scale-[0.99]';

// Pre-KYC gate (src/hooks/usePreKycGate.ts): until they've met the team, "Verify My Identity" would
// only lead to booking the call — so the banner says that instead.
const MEET_TEAM_COPY = {
   en: {
      title: 'Meet the team',
      body: 'A quick 15-min call, then you can verify your ID and borrow.',
      bookedTitle: 'See you on the call',
      bookedBody: 'Right after it, you can verify your ID and borrow.',
      cta: 'Book',
      bookedCta: 'View'
   },
   fil: {
      title: 'Kilalanin ang team',
      body: 'Mabilis na 15-min call, tapos puwede mo nang i-verify ang ID mo at humiram.',
      bookedTitle: 'Kita tayo sa call',
      bookedBody: 'Pagkatapos nito, puwede mo nang i-verify ang ID mo at humiram.',
      cta: 'Mag-book',
      bookedCta: 'Tingnan'
   }
} as const;

export function VerifyIdentityBanner({ onVerify }: { onVerify: () => void }) {
   const preKycGate = usePreKycGate();
   if (preKycGate.isGated) return <MeetTeamBanner />;
   return (
      <button type="button" onClick={onVerify} className={BANNER_BUTTON}>
         <DesignImage
            src={DASHBOARD_V2_ASSETS.verifyBanner}
            alt="Verify My Identity: +10 Pandesal. Unlock borrowing and feeding Moodeng pandesal."
            className="aspect-[880/128] h-auto w-full"
         />
      </button>
   );
}

function MeetTeamBanner() {
   const navigate = useNavigate();
   const { locale } = useLocalization();
   const isBooked = useSelector((state: RootState) => state.auth.user?.loanAccessStatus === 'pending');
   const copy = MEET_TEAM_COPY[locale === 'fil' ? 'fil' : 'en'];
   return (
      <button
         type="button"
         onClick={() => navigate(PRE_KYC_CONNECT_PATH)}
         className="mx-5 flex w-[calc(100%-40px)] items-center gap-3 rounded-[8px] bg-white px-3 py-3.5 text-left shadow-[0_1px_2px_rgba(28,5,61,0.06)] active:scale-[0.99] dark:bg-dv2-card"
      >
         <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#efeaff] dark:bg-dv2-tab">
            <Video className="h-5 w-5 text-[#6b55f7] dark:text-[#b3a6ff]" aria-hidden="true" />
         </span>
         <span className="min-w-0 flex-1">
            <span className="block text-[18px] font-medium leading-6 text-[#0f172b] dark:text-[#d9cfe6]">{isBooked ? copy.bookedTitle : copy.title}</span>
            <span className="block text-[14px] leading-[18px] text-[#45556c] dark:text-[#8f819e]">{isBooked ? copy.bookedBody : copy.body}</span>
         </span>
         <span className="shrink-0 rounded-full bg-[#6b55f7] px-3 py-1.5 text-[13px] font-bold text-white">{isBooked ? copy.bookedCta : copy.cta}</span>
      </button>
   );
}

export function ConnectWalletBanner({ onConnect }: { onConnect: () => void }) {
   return (
      <button type="button" onClick={onConnect} className={BANNER_BUTTON}>
         <DesignImage
            src={DASHBOARD_V2_ASSETS.connectWalletBanner}
            alt="Connect Wallet: +10 Pandesal. Receive USDC loans."
            className="aspect-[878/128] h-auto w-full dark:hidden"
         />
         {/* The exported banner has a white card baked in, so dark mode re-sets it in code. */}
         <span className="mx-5 my-0.5 hidden h-[60px] items-center justify-between gap-2 rounded-[8px] border-2 border-dv2-tab bg-dv2-card px-2.5 text-left dark:flex">
            <span className="flex min-w-0 flex-col">
               <span className="truncate text-[clamp(17px,5.6vw,24px)] font-black italic leading-6 text-[#d9cfe6]">Connect Wallet</span>
               <span className="truncate text-[clamp(12px,3.7vw,14px)] leading-[18px] text-[#8f819e]">Receive USDC loans</span>
            </span>
            <span className="shrink-0 rounded-full bg-[#6b55f7] px-[clamp(10px,3.7vw,16px)] py-1.5 text-[clamp(13px,4.2vw,16px)] font-bold leading-5 text-white">
               +10Pandesal
            </span>
         </span>
      </button>
   );
}

/**
 * Referral entry point. Filipino uses the designer's exported banner as-is; English re-sets the copy
 * over the same yellow card and the text-free food art cut from that banner.
 */
export function VoucherReferralBanner({ language, onRefer }: { language: DashboardV2Language; onRefer: () => void }) {
   if (language === 'fil') {
      return (
         <button type="button" onClick={onRefer} className={BANNER_BUTTON}>
            <DesignImage
               src={DASHBOARD_V2_ASSETS.voucherBanner}
               alt="₱100 GrabFood Voucher: kumain kayong dalawa. Mag-refer."
               className="aspect-[880/162] h-auto w-full"
            />
         </button>
      );
   }

   return (
      <button type="button" onClick={onRefer} className={clsx(BANNER_BUTTON, 'relative h-[81px] text-left')}>
         {/* Figma "banner_4" (9.23 file). */}
         <span
            className="absolute inset-x-5 bottom-0 h-16 rounded-[8px]"
            style={{ backgroundImage: 'linear-gradient(90deg, #fff3a3 0%, #ffe27a 100%)' }}
            aria-hidden="true"
         />
         <DesignImage
            src={DASHBOARD_V2_ASSETS.voucherBannerFood}
            className="absolute right-0 top-0 h-[81px] w-[clamp(100px,32.7vw,144px)] object-contain object-right"
         />
         <span className="absolute left-[34px] top-[22px] flex items-baseline gap-1.5 font-black italic leading-none text-[#3c8248]">
            <span className="text-[clamp(20px,6.4vw,28px)]">FREE</span>
            <span className="text-[clamp(13px,4.5vw,20px)]">meal for both of you</span>
         </span>
         <span className="absolute left-[34px] top-[52px] flex items-center gap-2">
            <span className="text-[14px] font-medium tracking-[-0.28px] text-[#96aa26]">Feast with friend</span>
            <span className="flex h-5 items-center rounded-full bg-[#4aa256] px-3 text-[12px] font-bold tracking-[-0.24px] text-white shadow-[0_1px_1px_rgba(0,0,0,0.3),0_-1px_1px_rgba(255,255,255,0.2)]">
               Grab Now
            </span>
         </span>
      </button>
   );
}

const CONNECT_FACEBOOK_COPY = {
   en: {
      title: 'Connect your Facebook',
      body: "Your verification is almost done. Connect Messenger so we can tell you the moment it's approved.",
      cta: 'Connect'
   },
   fil: {
      title: 'I-connect ang Facebook mo',
      body: 'Malapit nang matapos ang verification mo. I-connect ang Messenger para masabihan ka namin agad kapag approved na.',
      cta: 'I-connect'
   }
} as const;

// A declined ID check: they can't fix it alone, so the card asks for the line we'll help them on.
const DECLINED_CONNECT_COPY = {
   en: {
      title: "Your ID check didn't go through",
      body: "Let's sort it out together. Connect Messenger and the team will message you to help.",
      cta: 'Connect'
   },
   fil: {
      title: 'Hindi pumasa ang ID check mo',
      body: 'Ayusin natin nang magkasama. I-connect ang Messenger at imemessage ka ng team para tumulong.',
      cta: 'I-connect'
   }
} as const;

/**
 * Shown while a borrower's ID is in manual review — or was declined — and they haven't connected
 * Facebook yet, so we have a line to tell them on (review) or talk them through it (declined).
 * Opens /verify, which lands on the Facebook step.
 */
export function ConnectFacebookBanner({
   language,
   onConnect,
   declined = false
}: {
   language: DashboardV2Language;
   onConnect: () => void;
   // ID check declined (not in review): "let's talk" copy instead of "almost done".
   declined?: boolean;
}) {
   const copy = (declined ? DECLINED_CONNECT_COPY : CONNECT_FACEBOOK_COPY)[language];
   return (
      <button
         type="button"
         onClick={onConnect}
         className="mx-5 flex items-center gap-3 rounded-[8px] bg-white px-3 py-3.5 text-left shadow-[0_1px_2px_rgba(28,5,61,0.06)] active:scale-[0.99]"
      >
         <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e7f0ff] dark:bg-[#102a3f]">
            <Facebook className="h-5 w-5 text-[#0866FF]" aria-hidden="true" />
         </span>
         <span className="min-w-0 flex-1">
            <span className="block text-[18px] font-medium leading-6 text-[#0f172b]">{copy.title}</span>
            <span className="block text-[14px] leading-[18px] text-[#45556c]">{copy.body}</span>
         </span>
         <span className="shrink-0 rounded-full bg-[#6b55f7] px-3 py-1.5 text-[13px] font-bold text-white">{copy.cta}</span>
      </button>
   );
}

/** The live dashboard's "Withdraw your USDC" button, in the new card style (not in the Figma). */
export function WithdrawBanner({ onWithdraw }: { onWithdraw: () => void }) {
   return (
      <button
         type="button"
         onClick={onWithdraw}
         className="mx-5 flex items-center gap-3 rounded-[8px] bg-white px-3 py-3.5 text-left shadow-[0_1px_2px_rgba(28,5,61,0.06)] active:scale-[0.99]"
      >
         <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#efeaff] dark:bg-dv2-tab">
            <Wallet className="h-5 w-5 text-[#6b55f7] dark:text-[#b3a6ff]" aria-hidden="true" />
         </span>
         <span className="min-w-0 flex-1">
            <span className="block text-[18px] font-medium leading-6 text-[#0f172b]">Withdraw your USDC</span>
            <span className="block text-[14px] leading-[18px] text-[#45556c]">Cash out your funded loan to local currency.</span>
         </span>
         <ArrowUpRight className="h-5 w-5 shrink-0 text-[#6b55f7] dark:text-[#b3a6ff]" aria-hidden="true" />
      </button>
   );
}

const REMINDERS_COPY = {
   en: {
      title: 'Turn on repayment reminders',
      body: 'Get a heads-up before your due date so you never pay late.',
      blockedTitle: 'Reminders are blocked',
      blockedBody: 'Allow notifications for moodeng.app in your browser settings.',
      homeScreenTitle: 'Get reminders on your iPhone',
      homeScreenBody: 'Tap Share, then "Add to Home Screen". Open Moodeng from your Home Screen, log in and turn on reminders.'
   },
   fil: {
      title: 'I-on ang mga repayment reminder',
      body: 'Makatanggap ng paalala bago ang due date para hindi ka ma-late.',
      blockedTitle: 'Naka-block ang mga reminder',
      blockedBody: 'I-allow ang mga notification para sa moodeng.app sa browser settings mo.',
      homeScreenTitle: 'Makatanggap ng mga reminder sa iPhone mo',
      homeScreenBody:
         'I-tap ang Share, tapos "Add to Home Screen". Buksan ang Moodeng mula sa Home Screen, mag-log in, at i-on ang mga reminder.'
   }
} as const;

/**
 * Shown to borrowers with a loan to repay who haven't allowed push. When push can't be turned on
 * from here (the browser blocked it, or it's iPhone Safari, which only offers push from the Home
 * Screen) it explains what to do instead of offering a button.
 */
export function TurnOnRemindersBanner({
   language,
   variant,
   isBusy,
   onEnable
}: {
   language: DashboardV2Language;
   variant: 'enable' | 'blocked' | 'home-screen';
   isBusy: boolean;
   onEnable: () => void;
}) {
   const copy = REMINDERS_COPY[language];
   const Icon = variant === 'blocked' ? BellOff : variant === 'home-screen' ? Share : Bell;
   const title = variant === 'blocked' ? copy.blockedTitle : variant === 'home-screen' ? copy.homeScreenTitle : copy.title;
   const body = variant === 'blocked' ? copy.blockedBody : variant === 'home-screen' ? copy.homeScreenBody : copy.body;
   const content = (
      <>
         <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#efeaff] dark:bg-dv2-tab">
            <Icon className="h-5 w-5 text-[#6b55f7] dark:text-[#b3a6ff]" aria-hidden="true" />
         </span>
         <span className="min-w-0 flex-1">
            <span className="block text-[18px] font-medium leading-6 text-[#0f172b]">{title}</span>
            <span className="block text-[14px] leading-[18px] text-[#45556c]">{body}</span>
         </span>
      </>
   );
   const cardClass = 'mx-5 flex items-center gap-3 rounded-[8px] bg-white px-3 py-3.5 text-left shadow-[0_1px_2px_rgba(28,5,61,0.06)]';

   if (variant !== 'enable') {
      return <div className={cardClass}>{content}</div>;
   }

   return (
      <button type="button" onClick={onEnable} disabled={isBusy} className={clsx(cardClass, 'active:scale-[0.99] disabled:opacity-60')}>
         {content}
         <span className="shrink-0 rounded-full bg-[#6b55f7] px-3 py-1.5 text-[13px] font-bold text-white">
            {language === 'fil' ? 'I-on' : 'Turn on'}
         </span>
      </button>
   );
}
