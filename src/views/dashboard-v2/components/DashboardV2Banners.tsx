import clsx from 'clsx';
import { ArrowUpRight, Wallet } from 'lucide-react';

import { DASHBOARD_V2_ASSETS } from '@/views/dashboard-v2/assets';
import DesignImage from '@/views/dashboard-v2/components/DesignImage';
import type { DashboardV2Language } from '@/views/dashboard-v2/types';

// Banners are exported from Figma as whole 440px-wide frames (20px side margins and copy baked in),
// so each renders full width at its native aspect ratio.
const BANNER_BUTTON = 'block w-full transition active:scale-[0.99]';

export function VerifyIdentityBanner({ onVerify }: { onVerify: () => void }) {
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

export function ConnectWalletBanner({ onConnect }: { onConnect: () => void }) {
   return (
      <button type="button" onClick={onConnect} className={BANNER_BUTTON}>
         <DesignImage
            src={DASHBOARD_V2_ASSETS.connectWalletBanner}
            alt="Connect Wallet: +10 Pandesal. Receive USDC loans."
            className="aspect-[878/128] h-auto w-full"
         />
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

/** The live dashboard's "Withdraw your USDC" button, in the new card style (not in the Figma). */
export function WithdrawBanner({ onWithdraw }: { onWithdraw: () => void }) {
   return (
      <button
         type="button"
         onClick={onWithdraw}
         className="mx-5 flex items-center gap-3 rounded-[8px] bg-white px-3 py-3.5 text-left shadow-[0_1px_2px_rgba(28,5,61,0.06)] active:scale-[0.99]"
      >
         <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#efeaff]">
            <Wallet className="h-5 w-5 text-[#6b55f7]" aria-hidden="true" />
         </span>
         <span className="min-w-0 flex-1">
            <span className="block text-[18px] font-medium leading-6 text-[#0f172b]">Withdraw your USDC</span>
            <span className="block text-[14px] leading-[18px] text-[#45556c]">Cash out your funded loan to local currency.</span>
         </span>
         <ArrowUpRight className="h-5 w-5 shrink-0 text-[#6b55f7]" aria-hidden="true" />
      </button>
   );
}
