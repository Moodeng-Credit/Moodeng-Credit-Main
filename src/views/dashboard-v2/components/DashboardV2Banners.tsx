import { DASHBOARD_V2_ASSETS } from '@/views/dashboard-v2/assets';
import DesignImage from '@/views/dashboard-v2/components/DesignImage';

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

/** SAMPLE DATA: referral vouchers have no backend yet, so this banner is display-only. */
export function VoucherReferralBanner() {
   return (
      <DesignImage
         src={DASHBOARD_V2_ASSETS.voucherBanner}
         alt="₱100 GrabFood Voucher: kumain kayong dalawa. Mag-refer."
         className="aspect-[880/162] h-auto w-full"
      />
   );
}
