import { useCallback, useEffect, useState } from 'react';

import { ChevronRight, LoaderCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { EXTERNAL_LINKS } from '@/config/externalLinks';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface FundWalletSheetProps {
   isOpen: boolean;
   onClose: () => void;
   walletAddress?: string;
}

const COINBASE_PAY_URL = 'https://pay.coinbase.com/buy/select-asset';

const COINBASE_LOGO = (
   <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#0052FF" />
      <circle cx="20" cy="20" r="10" fill="white" />
      <rect x="16.5" y="17" width="3" height="6" rx="1" fill="#0052FF" />
      <rect x="20.5" y="17" width="3" height="6" rx="1" fill="#0052FF" />
   </svg>
);

const BRIDGE_LOGO = (
   <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#1a1a2e" />
      <path d="M12 16.5H24.5M24.5 16.5L21 13M24.5 16.5L21 20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 23.5H15.5M15.5 23.5L19 20M15.5 23.5L19 27" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

const SOLANA_LOGO = (
   <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#1a1a2e" />
      <defs>
         <linearGradient id="sol-grad-sheet" x1="10" y1="28" x2="30" y2="12" gradientUnits="userSpaceOnUse">
            <stop stopColor="#9945FF" />
            <stop offset="0.5" stopColor="#14F195" />
            <stop offset="1" stopColor="#00D1FF" />
         </linearGradient>
      </defs>
      <path d="M11 25.5L14 22.5H29L26 25.5H11Z" fill="url(#sol-grad-sheet)" />
      <path d="M11 14.5L14 17.5H29L26 14.5H11Z" fill="url(#sol-grad-sheet)" />
      <path d="M11 20L14 17H29L26 20H11Z" fill="url(#sol-grad-sheet)" />
   </svg>
);

const CHAIN_CHIPS = [
   { name: 'Ethereum', color: '#627EEA' },
   { name: 'Arbitrum', color: '#12AAFF' },
   { name: 'Optimism', color: '#FF0420' },
   { name: 'Polygon', color: '#8247E5' },
   { name: 'BNB', color: '#F3BA2F' },
];

export default function FundWalletSheet({ isOpen, onClose, walletAddress }: FundWalletSheetProps) {
   const navigate = useNavigate();
   const [coinbaseLoading, setCoinbaseLoading] = useState(false);

   useEffect(() => {
      if (!isOpen) return;
      const handleEscape = (e: KeyboardEvent) => {
         if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
   }, [isOpen, onClose]);

   useEffect(() => {
      if (isOpen) {
         document.body.style.overflow = 'hidden';
      } else {
         document.body.style.overflow = '';
      }
      return () => {
         document.body.style.overflow = '';
      };
   }, [isOpen]);

   // Opens the Coinbase buy widget. Coinbase's "Secure Initialization" requires a
   // short-lived session token minted server-side (browser never sees the secret key),
   // so we fetch one from the `coinbase-onramp-token` edge function, then open the widget
   // as a centered popup window on top of the app. A true inline iframe isn't possible —
   // Coinbase blocks it because bank 2FA/3DS can't run in an iframe.
   const handleCoinbase = useCallback(async () => {
      if (coinbaseLoading) return;
      setCoinbaseLoading(true);

      // Open the popup synchronously (before the await) so it isn't blocked as a
      // non-user-gesture popup, then navigate it once the token resolves.
      const popup = window.open('', 'coinbase-onramp', 'width=460,height=720,menubar=no,toolbar=no');

      try {
         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase.functions.invoke('coinbase-onramp-token', {
            body: walletAddress ? { address: walletAddress } : {},
         });
         const token = (data as { token?: string } | null)?.token;

         if (error || !token) {
            throw new Error('Could not start Coinbase. Please try again.');
         }

         const url = `${COINBASE_PAY_URL}?sessionToken=${encodeURIComponent(token)}&defaultNetwork=base&fiatCurrency=USD`;
         if (popup) {
            popup.location.href = url;
         } else {
            // Popup blocked — fall back to a same-context navigation in a new tab.
            window.open(url, '_blank', 'noopener,noreferrer');
         }
      } catch {
         // Token mint failed (not yet configured, no wallet, etc.) — fall back to the
         // hosted Coinbase page so the option still works.
         popup?.close();
         window.open(EXTERNAL_LINKS.fund.coinbaseOnramp, '_blank', 'noopener,noreferrer');
      } finally {
         setCoinbaseLoading(false);
      }
   }, [coinbaseLoading, walletAddress]);

   if (!isOpen) return null;

   const handleEcoBridge = () => {
      onClose();
      navigate('/fund/bridge');
   };

   const handleSolanaBridge = () => {
      window.open(EXTERNAL_LINKS.fund.baseSolanaBridge, '_blank', 'noopener,noreferrer');
   };

   return (
      <div className="fixed inset-0 z-[80] flex items-end justify-center">
         <button
            className="absolute inset-0 bg-[#12071f]/40 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Close overlay"
         />
         <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="fund-wallet-title"
            className="relative mx-auto w-full max-w-[440px] rounded-t-[28px] bg-white shadow-[0_-8px_32px_rgba(20,18,24,0.22)] animate-[slideUp_0.25s_ease-out]"
         >
            <div className="pt-2.5 pb-0.5">
               <div className="mx-auto h-1 w-10 rounded-full bg-[#c9c3d4]" />
            </div>

            <div className="flex items-center justify-between px-4 pb-1 pt-2">
               <h2 id="fund-wallet-title" className="text-[17px] font-semibold text-md-heading">
                  Fund your wallet
               </h2>
               <button
                  onClick={onClose}
                  className="rounded-full p-1 transition-colors hover:bg-md-neutral-200 active:bg-md-neutral-300"
                  aria-label="Close"
               >
                  <X className="h-5 w-5 text-md-neutral-1400" strokeWidth={2} />
               </button>
            </div>

            <div className="flex flex-col gap-2.5 px-4 pb-6 pt-1" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
               {/* Coinbase Onramp */}
               <button
                  onClick={handleCoinbase}
                  disabled={coinbaseLoading}
                  className="flex flex-col gap-2 rounded-xl border border-md-neutral-400 bg-white px-3 py-3 text-left transition-all hover:border-md-primary-400 hover:shadow-md-card active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
               >
                  <div className="flex w-full items-center gap-3">
                     <div className="shrink-0">{COINBASE_LOGO}</div>
                     <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-md-heading leading-tight">Buy USDC with debit card</p>
                        <p className="text-[12px] font-normal text-md-neutral-800 leading-tight mt-0.5">
                           Visa / Mastercard &middot; Apple Pay &middot; Google Pay
                        </p>
                     </div>
                     {coinbaseLoading ? (
                        <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-md-neutral-800" />
                     ) : (
                        <ChevronRight className="h-5 w-5 shrink-0 text-md-neutral-800" />
                     )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                     <span className="rounded-full bg-md-primary-100 px-2 py-0.5 text-[10px] font-semibold text-md-primary-1200">
                        ~1.5% fee
                     </span>
                     <span className="rounded-full bg-[#e8f0ff] px-2 py-0.5 text-[10px] font-semibold text-[#0052FF]">
                        Powered by Coinbase
                     </span>
                     <span className="rounded-full bg-md-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-md-neutral-1400">
                        No account needed
                     </span>
                  </div>
               </button>

               {/* Eco Bridge */}
               <button
                  onClick={handleEcoBridge}
                  className="flex flex-col gap-2 rounded-xl border border-md-neutral-400 bg-white px-3 py-3 text-left transition-all hover:border-md-primary-400 hover:shadow-md-card active:scale-[0.98]"
               >
                  <div className="flex w-full items-center gap-3">
                     <div className="shrink-0">{BRIDGE_LOGO}</div>
                     <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-md-heading leading-tight">Bridge from another chain</p>
                        <p className="text-[12px] font-normal text-md-neutral-800 leading-tight mt-0.5">
                           Already have stablecoins? Move them to Base
                        </p>
                     </div>
                     <ChevronRight className="h-5 w-5 shrink-0 text-md-neutral-800" />
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                     {CHAIN_CHIPS.map((chain) => (
                        <span
                           key={chain.name}
                           className="inline-flex items-center gap-1 rounded-full bg-md-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-md-neutral-1400"
                        >
                           <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ backgroundColor: chain.color }} />
                           {chain.name}
                        </span>
                     ))}
                     <span className="rounded-full bg-md-neutral-200 px-2 py-0.5 text-[10px] font-medium text-md-neutral-800">
                        +10 more
                     </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                     <span className="rounded-full bg-[#e6f9ef] px-2 py-0.5 text-[10px] font-semibold text-[#1a8c4e]">
                        &lt; 0.5% fee
                     </span>
                     <span className="rounded-full bg-[#e6f9ef] px-2 py-0.5 text-[10px] font-semibold text-[#1a8c4e]">
                        Powered by Eco
                     </span>
                     <span className="rounded-full bg-md-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-md-neutral-1400">
                        ~30 sec
                     </span>
                  </div>
               </button>

               {/* Base-Solana Bridge */}
               <button
                  onClick={handleSolanaBridge}
                  className="flex flex-col gap-2 rounded-xl border border-md-neutral-400 bg-white px-3 py-3 text-left transition-all hover:border-md-primary-400 hover:shadow-md-card active:scale-[0.98]"
               >
                  <div className="flex w-full items-center gap-3">
                     <div className="shrink-0">{SOLANA_LOGO}</div>
                     <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-md-heading leading-tight">Bridge from Solana</p>
                        <p className="text-[12px] font-normal text-md-neutral-800 leading-tight mt-0.5">
                           SOL and USDC to Base
                        </p>
                     </div>
                     <ChevronRight className="h-5 w-5 shrink-0 text-md-neutral-800" />
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                     <span className="rounded-full bg-md-primary-100 px-2 py-0.5 text-[10px] font-semibold text-md-primary-1200">
                        Official Base bridge
                     </span>
                     <span className="rounded-full bg-md-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-md-neutral-1400">
                        SOL &middot; USDC
                     </span>
                  </div>
               </button>
            </div>
         </section>

         <style>{`
            @keyframes slideUp {
               from { transform: translateY(100%); }
               to { transform: translateY(0); }
            }
         `}</style>
      </div>
   );
}
