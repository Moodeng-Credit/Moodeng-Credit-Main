import { useEffect, useState } from 'react';

import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { erc20Abi } from 'viem';
import { useReadContract } from 'wagmi';

import ExportInstantWalletKey from '@/views/account/ExportInstantWalletKey';

import { type LocaleCode, useLocalization } from '@/i18n';
import { TOAST_TYPES } from '@/components/ToastSystem/types';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { ALLOWED_CHAIN_ID, BASE_USDC_ADDRESS } from '@/config/wagmiConfig';
import { useUsdcRate } from '@/lib/useUsdcRate';
import { getBaseWalletLockStatus } from '@/lib/walletProvider';
import type { RootState } from '@/store/store';

// The borrower's "money home" — a GCash/Atome-style balance card, deliberately NOT a
// crypto wallet screen. Big balance up top, one plain action (Cash out — Repay lives on the
// nav bar, not here), and the crypto plumbing (address, export key) tucked under a quiet
// "Wallet details" fold for the rare user who needs it. Non-crypto borrowers should read this
// as "here's my money", not "here's my Ethereum account".
//
// Instant-wallet only: a Base Account borrower manages money in their own wallet app, so we
// don't front a balance card for them. Once the instant wallet is on, this card IS the wallet
// UI and no Base-wallet affordances should appear anywhere.

type WalletCopy = {
   availableBalance: string;
   subtitle: string;
   emptySubtitle: string;
   moneyArrivedTitle: string;
   moneyArrivedBody: string;
   cashOut: string;
   details: string;
   instantWallet: string;
   walletType: string;
   address: string;
   copyAddress: string;
   copied: string;
   copyFailed: string;
};

const WALLET_COPY: Record<LocaleCode, WalletCopy> = {
   en: {
      availableBalance: 'Available balance',
      subtitle: 'Money you receive lands here.',
      emptySubtitle: 'When a lender funds you, the money appears here.',
      moneyArrivedTitle: 'Money arrived',
      moneyArrivedBody: 'landed in your wallet',
      cashOut: 'Cash out',
      details: 'Wallet details',
      instantWallet: 'Instant Wallet',
      walletType: 'Wallet type',
      address: 'Wallet address',
      copyAddress: 'Copy',
      copied: 'Address copied',
      copyFailed: 'Copy failed'
   },
   fil: {
      availableBalance: 'Available na balance',
      subtitle: 'Dito napupunta ang perang natatanggap mo.',
      emptySubtitle: 'Kapag pinondohan ka ng lender, dito lalabas ang pera.',
      moneyArrivedTitle: 'May dumating na pera',
      moneyArrivedBody: 'ay pumasok sa wallet mo',
      cashOut: 'Mag-cash out',
      details: 'Mga detalye ng wallet',
      instantWallet: 'Instant Wallet',
      walletType: 'Uri ng wallet',
      address: 'Address ng wallet',
      copyAddress: 'Kopyahin',
      copied: 'Nakopya ang address',
      copyFailed: 'Hindi na-copy'
   },
   id: {
      availableBalance: 'Saldo tersedia',
      subtitle: 'Uang yang kamu terima masuk ke sini.',
      emptySubtitle: 'Saat lender mendanaimu, uangnya muncul di sini.',
      moneyArrivedTitle: 'Uang masuk',
      moneyArrivedBody: 'masuk ke dompetmu',
      cashOut: 'Tarik dana',
      details: 'Detail dompet',
      instantWallet: 'Instant Wallet',
      walletType: 'Jenis dompet',
      address: 'Alamat dompet',
      copyAddress: 'Salin',
      copied: 'Alamat disalin',
      copyFailed: 'Gagal menyalin'
   },
   th: {
      availableBalance: 'ยอดคงเหลือที่ใช้ได้',
      subtitle: 'เงินที่คุณได้รับจะเข้ามาที่นี่',
      emptySubtitle: 'เมื่อผู้ให้กู้โอนเงินให้คุณ เงินจะแสดงที่นี่',
      moneyArrivedTitle: 'เงินเข้าแล้ว',
      moneyArrivedBody: 'เข้ากระเป๋าเงินของคุณ',
      cashOut: 'ถอนเงิน',
      details: 'รายละเอียดกระเป๋าเงิน',
      instantWallet: 'Instant Wallet',
      walletType: 'ประเภทกระเป๋าเงิน',
      address: 'ที่อยู่กระเป๋าเงิน',
      copyAddress: 'คัดลอก',
      copied: 'คัดลอกที่อยู่แล้ว',
      copyFailed: 'คัดลอกไม่สำเร็จ'
   },
   vi: {
      availableBalance: 'Số dư khả dụng',
      subtitle: 'Tiền bạn nhận được sẽ vào đây.',
      emptySubtitle: 'Khi người cho vay chuyển tiền, tiền sẽ hiện ở đây.',
      moneyArrivedTitle: 'Tiền đã đến',
      moneyArrivedBody: 'đã vào ví của bạn',
      cashOut: 'Rút tiền',
      details: 'Chi tiết ví',
      instantWallet: 'Instant Wallet',
      walletType: 'Loại ví',
      address: 'Địa chỉ ví',
      copyAddress: 'Sao chép',
      copied: 'Đã sao chép địa chỉ',
      copyFailed: 'Sao chép thất bại'
   }
};

const shortenAddress = (address: string) => (address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address);

const formatUsd = (value: number) =>
   value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// DEV-only: lets the /account-wallet-preview route render the real card with mock data,
// so the design can be reviewed without a logged-in, wallet-locked borrower. No effect in prod.
type WalletBalanceCardProps = {
   previewAddress?: string;
   previewBalance?: number;
   previewIsInstant?: boolean;
};

export default function WalletBalanceCard({ previewAddress, previewBalance, previewIsInstant }: WalletBalanceCardProps = {}) {
   const navigate = useNavigate();
   const { locale } = useLocalization();
   const { showToast } = useToast();
   const user = useSelector((state: RootState) => state.auth.user);
   const [showDetails, setShowDetails] = useState(false);

   const copy = WALLET_COPY[locale];
   const walletLock = getBaseWalletLockStatus(user);
   const address = previewAddress ?? walletLock.address;
   const isInstant = previewAddress ? Boolean(previewIsInstant) : walletLock.isConfirmedOpenfort;

   // GCash-minded borrowers think in pesos — show the ≈₱ equivalent under the USDC number.
   const phpRate = useUsdcRate('php');

   const { data: usdcBalanceRaw, isLoading } = useReadContract({
      abi: erc20Abi,
      address: BASE_USDC_ADDRESS,
      functionName: 'balanceOf',
      args: address ? [address as `0x${string}`] : undefined,
      chainId: ALLOWED_CHAIN_ID,
      query: { enabled: Boolean(address) && previewAddress === undefined, refetchInterval: 30000 }
   });

   const balance =
      previewAddress !== undefined ? (previewBalance ?? 0) : typeof usdcBalanceRaw === 'bigint' ? Number(usdcBalanceRaw) / 1e6 : null;

   // "Money arrived" moment: compare against the last balance this device saw for this
   // address, and celebrate an increase — the GCash "may pera ka na" ping. Stored locally
   // so it fires once per arrival, on whichever screen mounts the card first.
   useEffect(() => {
      if (previewAddress !== undefined || balance == null || !address || !isInstant) return;
      const key = `wallet_last_balance_${address.toLowerCase()}`;
      let last: number | null = null;
      try {
         const raw = localStorage.getItem(key);
         last = raw == null ? null : Number(raw);
      } catch {
         return;
      }
      try {
         localStorage.setItem(key, String(balance));
      } catch {
         /* ignore */
      }
      if (last != null && Number.isFinite(last) && balance > last + 0.009) {
         const delta = balance - last;
         const php = delta * phpRate.value;
         showToast(
            TOAST_TYPES.SUCCESS,
            copy.moneyArrivedTitle,
            `+${formatUsd(delta)} USDC (≈ ₱${php.toLocaleString(undefined, { maximumFractionDigits: 0 })}) ${copy.moneyArrivedBody}`
         );
      }
   }, [balance, address, isInstant, previewAddress, phpRate.value, showToast, copy.moneyArrivedTitle, copy.moneyArrivedBody]);

   // Instant wallet only. No wallet → the Account header's "Set up wallet" button handles it;
   // Base Account borrowers manage money in their own wallet app, so no card for them either.
   if (!address || !isInstant) return null;

   const copyAddress = async () => {
      try {
         await navigator.clipboard.writeText(address);
         showToast(TOAST_TYPES.SUCCESS, copy.copied, '');
      } catch {
         showToast(TOAST_TYPES.ERROR, copy.copyFailed, '');
      }
   };

   return (
      <div className="flex flex-col gap-3">
         {/* Balance hero — reads as "here's your money", GCash/Atome style. */}
         <div className="rounded-[20px] bg-gradient-to-br from-[#7B5FFF] to-[#6010D2] p-5 text-white shadow-[0_14px_40px_rgba(96,16,210,0.28)]">
            <p className="text-md-b3 font-medium text-white/80">{copy.availableBalance}</p>
            <div className="mt-1 flex items-baseline gap-1">
               <span className="text-[40px] font-bold leading-none tracking-[-0.02em]">
                  {balance == null ? (isLoading ? '—' : '0.00') : formatUsd(balance)}
               </span>
               <span className="text-md-b1 font-semibold text-white/80">USDC</span>
            </div>
            {balance != null && balance > 0 ? (
               <p className="mt-1 text-md-b2 font-semibold text-white/90">
                  ≈ ₱{(balance * phpRate.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
               </p>
            ) : null}
            <p className="mt-2 text-md-b3 font-medium text-white/70">
               {balance != null && balance > 0 ? copy.subtitle : copy.emptySubtitle}
            </p>

            {/* One action only — Repay already lives on the nav bar. */}
            <button
               type="button"
               onClick={() => navigate('/withdraw')}
               className="mt-4 w-full rounded-[14px] bg-white px-4 py-3 text-md-b1 font-semibold text-md-primary-1200 transition-all duration-150 hover:brightness-95 active:scale-[0.98]"
            >
               {copy.cashOut}
            </button>
         </div>

         {/* Wallet details — the crypto plumbing, deliberately folded away so it never fronts
             a non-crypto borrower. Only opened by someone who goes looking for it. */}
         <div className="rounded-[16px] border border-md-neutral-400 bg-white dark:bg-md-neutral-200 overflow-hidden">
            <button
               type="button"
               onClick={() => setShowDetails((v) => !v)}
               aria-expanded={showDetails}
               className="flex w-full items-center justify-between px-md-4 py-md-3 text-left"
            >
               <span className="text-md-b2 font-medium text-md-neutral-1200">{copy.details}</span>
               <div
                  className="h-5 w-5 shrink-0 bg-md-neutral-800 transition-transform duration-200"
                  style={{
                     WebkitMaskImage: "url('/icons/chevron-down.svg')",
                     maskImage: "url('/icons/chevron-down.svg')",
                     WebkitMaskRepeat: 'no-repeat',
                     maskRepeat: 'no-repeat',
                     WebkitMaskPosition: 'center',
                     maskPosition: 'center',
                     WebkitMaskSize: 'contain',
                     maskSize: 'contain',
                     transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)'
                  }}
               />
            </button>

            {showDetails ? (
               <div className="flex flex-col gap-md-3 border-t border-md-neutral-400 px-md-4 py-md-3">
                  <div className="flex items-center justify-between gap-3">
                     <span className="text-md-b3 font-medium text-md-neutral-700">{copy.walletType}</span>
                     <span className="text-md-b2 font-semibold text-md-heading">{copy.instantWallet}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                     <span className="text-md-b3 font-medium text-md-neutral-700">{copy.address}</span>
                     <button
                        type="button"
                        onClick={copyAddress}
                        className="flex items-center gap-1.5 text-md-b2 font-semibold text-md-heading"
                        title={copy.copyAddress}
                     >
                        <span className="font-mono">{shortenAddress(address)}</span>
                        <span
                           className="h-4 w-4 bg-md-primary-1200 dark:bg-md-primary-500"
                           style={{
                              WebkitMaskImage: "url('/icons/copy.svg')",
                              maskImage: "url('/icons/copy.svg')",
                              WebkitMaskRepeat: 'no-repeat',
                              maskRepeat: 'no-repeat',
                              WebkitMaskPosition: 'center',
                              maskPosition: 'center',
                              WebkitMaskSize: 'contain',
                              maskSize: 'contain'
                           }}
                        />
                     </button>
                  </div>
                  {isInstant ? (
                     <div className="pt-1">
                        <ExportInstantWalletKey />
                     </div>
                  ) : null}
               </div>
            ) : null}
         </div>
      </div>
   );
}
