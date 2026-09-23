import { DASHBOARD_V2_ASSETS } from '@/views/dashboard-v2/assets';
import DesignImage from '@/views/dashboard-v2/components/DesignImage';

const HEADLINE = 'text-[24px] font-black italic leading-[1.2]';
const SUBLINE = 'text-[14px] font-medium leading-[1.2] tracking-[-0.28px]';

export function VerifyIdentityBanner({ onVerify }: { onVerify: () => void }) {
   return (
      <button
         type="button"
         onClick={onVerify}
         className="relative mx-5 h-16 overflow-hidden rounded-[8px] bg-gradient-to-r from-[#7b67f9] to-[#4d30ff] text-left transition active:scale-[0.99]"
      >
         <DesignImage
            src={DASHBOARD_V2_ASSETS.verifyBannerTexture}
            className="absolute right-0 top-0 h-full w-[78%] object-cover opacity-50 mix-blend-luminosity"
         />
         <span className="relative block pl-2.5 pt-[11px]">
            <span className={`${HEADLINE} block text-[#fff099] [text-shadow:0_0_2px_rgba(0,0,0,0.3)]`}>Verify My Identity</span>
            <span className={`${SUBLINE} block text-[#e9e6ff]`}>Unlock borrowing &amp; feeding Moodeng pandesal</span>
         </span>
         <span className="absolute left-[225px] top-[11px] flex h-[26px] w-[125px] items-center gap-0.5 rounded-full bg-[#ffce1b] pl-2 shadow-[0_-2px_1px_rgba(255,255,255,0.3),0_2px_1px_rgba(63,89,79,0.4)]">
            <DesignImage src={DASHBOARD_V2_ASSETS.pandesal} className="h-[16.5px] w-5 object-contain" />
            <span className="text-[14px] font-bold leading-[1.2] tracking-[-0.42px] text-[#704518]">+10Pandesal</span>
         </span>
         <DesignImage src={DASHBOARD_V2_ASSETS.verifyBannerHippo} className="absolute right-[-12px] top-1 h-[60px] w-[81px] object-contain" />
      </button>
   );
}

export function ConnectWalletBanner({ onConnect }: { onConnect: () => void }) {
   return (
      <button
         type="button"
         onClick={onConnect}
         className="relative mx-5 flex h-16 items-center justify-between rounded-[8px] border-2 border-[#e8e4ff] bg-white pl-2 pr-2.5 text-left transition active:scale-[0.99]"
      >
         <span className="block">
            <span className={`${HEADLINE} block text-[#877897]`}>Connect Wallet</span>
            <span className={`${SUBLINE} block text-[#c3bbce]`}>Receive USDC loans</span>
         </span>
         <span className="flex h-[30px] w-[129px] items-center justify-center rounded-full bg-[#6d57f7] text-[14px] font-bold leading-[1.2] text-white">
            +10Pandesal
         </span>
      </button>
   );
}

/** SAMPLE DATA: referral vouchers have no backend yet, so this banner is display-only. */
export function VoucherReferralBanner() {
   return (
      <div className="relative mx-5 h-[81px] overflow-hidden" aria-label="₱100 GrabFood voucher for referring a friend">
         <div className="absolute inset-x-0 bottom-0 h-16 overflow-hidden rounded-[8px] bg-[#ffef85]">
            <DesignImage src={DASHBOARD_V2_ASSETS.voucherBannerPattern} className="absolute left-0 top-0 h-16 w-[89px]" />
            <p className="relative flex items-baseline gap-1.5 pl-2.5 pt-1.5 font-black italic leading-[1.2] text-[#3c8248]">
               <span className="text-[26px]">₱100</span>
               <span className="text-[20px]">GrabFood Voucher</span>
            </p>
            <p className="relative -mt-0.5 flex items-center gap-2 pl-2.5">
               <span className={`${SUBLINE} text-[#96aa26]`}>kumain kayong dalawa</span>
               <span className="flex h-5 w-[85px] items-center justify-center rounded-full bg-[#4aa256] text-[12px] font-bold tracking-[-0.24px] text-white shadow-[0_1px_1px_rgba(0,0,0,0.3),0_-1px_1px_rgba(255,255,255,0.2)]">
                  Mag-refer
               </span>
            </p>
         </div>
         <DesignImage src={DASHBOARD_V2_ASSETS.voucherBannerArt} className="absolute right-px top-[-4px] h-[85px] w-[170px] rounded-br-[8px] object-contain" />
      </div>
   );
}
