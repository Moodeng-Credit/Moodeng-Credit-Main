import { useCallback, useEffect, useState } from 'react';

import { Check, ChevronRight, Copy, ExternalLink, LoaderCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { erc20Abi, formatUnits } from 'viem';
import { useAccount, useReadContract } from 'wagmi';

import { ALLOWED_CHAIN_ID, BASE_USDC_ADDRESS } from '@/config/wagmiConfig';
import { EXTERNAL_LINKS } from '@/config/externalLinks';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { FlagUS, FlagEU, FlagGB, FlagAU, FlagCA } from '@/components/verification/CountryFlags';
import FundBridge from '@/views/fund/FundBridge';

const COINBASE_SUPPORTED_REGIONS = [
   { Flag: FlagUS, label: 'US' },
   { Flag: FlagEU, label: 'EU' },
   { Flag: FlagGB, label: 'UK' },
   { Flag: FlagCA, label: 'CA' },
   { Flag: FlagAU, label: 'AU' },
];

interface FundWalletSheetProps {
   isOpen: boolean;
   onClose: () => void;
   walletAddress?: string;
}

const COINBASE_PAY_URL = 'https://pay.coinbase.com/buy/select-asset';

const COINBASE_LOGO = (
   <img src="/hippos/hippo-debit-card.png" alt="" className="h-12 w-12 object-contain" />
);

const BRIDGE_LOGO = (
   <img src="/hippos/hippo-bridge-swap.png" alt="" className="h-12 w-12 object-contain" />
);

const SOLANA_LOGO = (
   <img src="/hippos/hippo-solana-bridge.png" alt="" className="h-12 w-12 object-contain" />
);

const DEPOSIT_LOGO = <img src="/icons/base-account.svg" alt="" className="h-12 w-12 rounded-[10px] object-contain" />;

const CHAIN_CHIPS = [
   { name: 'Ethereum', color: '#627EEA' },
   { name: 'Arbitrum', color: '#12AAFF' },
   { name: 'Optimism', color: '#FF0420' },
   { name: 'Polygon', color: '#8247E5' },
   { name: 'BNB', color: '#F3BA2F' },
];

export default function FundWalletSheet({ isOpen, onClose, walletAddress }: FundWalletSheetProps) {
   const navigate = useNavigate();
   const [showBridge, setShowBridge] = useState(false);
   const [coinbaseLoading, setCoinbaseLoading] = useState(false);
   const [coinbaseError, setCoinbaseError] = useState<string | null>(null);

   // Destination for onramp/funding: prefer the saved profile wallet, but fall back to the
   // wallet the user has connected in this session. The saved value can lag (e.g. just after
   // connecting, or when it never persisted), so relying on it alone wrongly reports "no
   // wallet" for someone who clearly has one connected.
   const { address: connectedAddress } = useAccount();
   const effectiveWalletAddress = walletAddress || connectedAddress;

   const [showDeposit, setShowDeposit] = useState(false);
   const [addressCopied, setAddressCopied] = useState(false);

   // Current USDC-on-Base balance for the little "your balance" chip above the options, so the
   // user can see what they already have before choosing how to add more.
   const { data: rawUsdcBalance, isLoading: isBalanceLoading } = useReadContract({
      abi: erc20Abi,
      address: BASE_USDC_ADDRESS,
      functionName: 'balanceOf',
      args: effectiveWalletAddress ? [effectiveWalletAddress as `0x${string}`] : undefined,
      chainId: ALLOWED_CHAIN_ID,
      query: { enabled: Boolean(effectiveWalletAddress) }
   });
   const usdcBalanceDisplay =
      rawUsdcBalance != null
         ? Number(formatUnits(rawUsdcBalance, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
         : null;

   const handleCopyAddress = useCallback(() => {
      if (!effectiveWalletAddress) return;
      void navigator.clipboard?.writeText(effectiveWalletAddress);
      setAddressCopied(true);
      window.setTimeout(() => setAddressCopied(false), 1800);
   }, [effectiveWalletAddress]);

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

      // Coinbase needs a destination wallet to send the USDC to. Without one, the token
      // mint fails with NO_WALLET — so short-circuit with an honest message ("connect a
      // wallet first") instead of opening a popup that dead-ends on the generic error.
      if (!effectiveWalletAddress) {
         setCoinbaseError('Connect a wallet first so we know where to send your USDC.');
         return;
      }

      setCoinbaseLoading(true);
      setCoinbaseError(null);

      // Open the popup synchronously (before the await) so it isn't blocked as a
      // non-user-gesture popup, then navigate it once the token resolves.
      const popup = window.open('', 'coinbase-onramp', 'width=460,height=720,menubar=no,toolbar=no');

      // Paint a branded loader into the blank popup so it isn't an ugly white
      // about:blank flash while the session token is minted. Replaced by the
      // Coinbase page once the token resolves (or closed on error).
      popup?.document.write(`
         <!doctype html><html><head><meta charset="utf-8"><title>Opening Coinbase…</title>
         <style>
            html,body{height:100%;margin:0}
            body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;
               padding:0 36px;text-align:center;box-sizing:border-box;
               background:#0a0b0d;color:#e6e8eb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
            .spinner{width:34px;height:34px;border:3px solid rgba(255,255,255,.15);border-top-color:#0052FF;
               border-radius:50%;animation:spin .8s linear infinite}
            .title{margin:4px 0 0;font-size:15px;font-weight:600;color:#e6e8eb}
            .steps{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px;
               font-size:13px;line-height:1.4;color:#9aa0a6;max-width:300px;text-align:left}
            .steps li{display:flex;gap:8px;align-items:flex-start}
            .steps b{flex:none;width:18px;height:18px;border-radius:50%;background:#1c2230;color:#7aa7ff;
               font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center}
            @keyframes spin{to{transform:rotate(360deg)}}
         </style></head>
         <body>
            <div class="spinner"></div>
            <p class="title">Opening Coinbase…</p>
            <ol class="steps">
               <li><b>1</b><span>Coinbase checks if you’re already signed in.</span></li>
               <li><b>2</b><span>If not, you’ll sign in (or create an account).</span></li>
               <li><b>3</b><span>Pay with your card — USDC lands in your wallet.</span></li>
            </ol>
         </body></html>
      `);
      popup?.document.close();

      try {
         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase.functions.invoke('coinbase-onramp-token', {
            body: effectiveWalletAddress ? { address: effectiveWalletAddress } : {},
         });
         const token = (data as { token?: string } | null)?.token;

         if (error || !token) {
            throw new Error((data as { error?: string } | null)?.error || 'Could not start Coinbase.');
         }

         const url = `${COINBASE_PAY_URL}?sessionToken=${encodeURIComponent(token)}&defaultNetwork=base&fiatCurrency=USD`;
         if (popup) {
            popup.location.href = url;
         } else {
            // Popup blocked — same-context navigation in a new tab still carries the token.
            window.open(url, '_blank', 'noopener,noreferrer');
         }
      } catch {
         // Token mint failed (secrets not configured, no wallet, etc.). The bare hosted URL
         // would just hit Coinbase's error page (Secure Init needs the token), so show an
         // inline message instead of bouncing the user out.
         popup?.close();
         setCoinbaseError('Card purchases aren’t available just yet — try a bridge below.');
      } finally {
         setCoinbaseLoading(false);
      }
   }, [coinbaseLoading, effectiveWalletAddress]);

   if (!isOpen) return null;

   const handleEcoBridge = () => {
      setShowBridge(true);
   };

   const handleSolanaBridge = () => {
      window.open(EXTERNAL_LINKS.fund.baseSolanaBridge, '_blank', 'noopener,noreferrer');
   };

   return (
      <>
      <div className="fixed inset-0 z-[80] flex flex-col items-center justify-end">
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
               {/* Current balance — what they already hold on Base, before adding more. */}
               {effectiveWalletAddress ? (
                  <div className="flex items-center justify-between rounded-xl bg-md-primary-100 px-3 py-2.5">
                     <span className="text-[12px] font-medium text-md-primary-1200">Your USDC balance</span>
                     {isBalanceLoading ? (
                        <span className="h-4 w-16 animate-pulse rounded bg-md-primary-300/60 dark:bg-[#3d2a5c]" aria-label="Loading balance" />
                     ) : (
                        <span className="text-[15px] font-bold text-md-primary-1200">{usdcBalanceDisplay ?? '0.00'} USDC</span>
                     )}
                  </div>
               ) : null}

               {/* Deposit USDC — direct receive to the wallet on Base (for people who already
                   hold USDC somewhere). First in the list per product ask. */}
               <div className="flex flex-col">
                  <button
                     onClick={() => setShowDeposit((v) => !v)}
                     disabled={!effectiveWalletAddress}
                     aria-expanded={showDeposit}
                     className="flex flex-col gap-2 rounded-xl border border-md-neutral-400 bg-white px-3 py-3 text-left transition-all hover:border-md-primary-400 hover:shadow-md-card active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
                  >
                     <div className="flex w-full items-center gap-3">
                        <div className="shrink-0">{DEPOSIT_LOGO}</div>
                        <div className="flex-1 min-w-0">
                           <p className="text-[14px] font-semibold text-md-heading leading-tight">Deposit USDC</p>
                           <p className="text-[12px] font-normal text-md-neutral-800 leading-tight mt-0.5">
                              Already have USDC? Send it to your wallet on Base
                           </p>
                        </div>
                        <ChevronRight
                           className={`h-5 w-5 shrink-0 text-md-neutral-800 transition-transform ${showDeposit ? 'rotate-90' : ''}`}
                        />
                     </div>
                     <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-[#e6f9ef] px-2 py-0.5 text-[10px] font-semibold text-[#1a8c4e]">No fee</span>
                        <span className="rounded-full bg-md-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-md-neutral-1400">
                           Base network only
                        </span>
                     </div>
                  </button>
                  {/* The panel's `/50` tint is an opacity-modifier class, which the dark remap in
                      globals.css (an exact `.bg-md-primary-100` selector) can't reach — so it
                      painted the light lavender at 50% over the dark sheet, a washed grey box.
                      Pin the dark surface explicitly: a subtle purple recess between the sheet
                      (#1b1525) and the full primary tint (#2a1740). */}
                  {showDeposit && effectiveWalletAddress ? (
                     <div className="mt-2 rounded-xl border border-md-primary-300 bg-md-primary-100/50 px-3 py-3 dark:bg-[#231733]">
                        <p className="text-[12px] font-medium text-md-neutral-1200">
                           Send USDC on the <span className="font-semibold text-md-heading">Base network</span> to this address:
                        </p>
                        <div className="mt-2 flex items-center gap-2 rounded-lg border border-md-primary-300 bg-white px-2.5 py-2">
                           <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-md-heading">{effectiveWalletAddress}</span>
                           <button
                              type="button"
                              onClick={handleCopyAddress}
                              className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-md-primary-1200"
                           >
                              {addressCopied ? (
                                 <>
                                    <Check className="h-4 w-4" /> Copied
                                 </>
                              ) : (
                                 <>
                                    <Copy className="h-4 w-4" /> Copy
                                 </>
                              )}
                           </button>
                        </div>
                        <p className="mt-2 text-[11px] leading-snug text-md-red-500">
                           Only send USDC on Base. Other tokens or networks may be lost.
                        </p>
                     </div>
                  ) : null}
               </div>

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
                        <ExternalLink className="h-[18px] w-[18px] shrink-0 text-md-neutral-800" />
                     )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                     <span className="rounded-full bg-md-primary-100 px-2 py-0.5 text-[10px] font-semibold text-md-primary-1200">
                        ~1.5% fee
                     </span>
                     <span className="rounded-full bg-md-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-md-neutral-1400">
                        Coinbase account needed
                     </span>
                  </div>
                  <div className="flex items-center gap-2">
                     <span className="text-[11px] text-md-neutral-800 leading-tight">Supported in</span>
                     {COINBASE_SUPPORTED_REGIONS.map(({ Flag, label }) => (
                        <span key={label} className="inline-flex items-center gap-1">
                           <Flag className="h-[10px] w-[15px] rounded-[1px]" />
                           <span className="text-[11px] text-md-neutral-800">{label}</span>
                        </span>
                     ))}
                     <span className="text-[11px] text-md-neutral-800 leading-tight">only</span>
                  </div>
                  <div className="rounded-lg bg-md-neutral-100 px-2.5 py-2 text-[11px] font-normal leading-snug text-md-neutral-800">
                     Coinbase checks if you’re signed in — if not, you’ll sign in first, then pay by card.
                  </div>
               </button>

               {coinbaseError && (
                  <p className="-mt-1 px-1 text-[12px] font-medium text-md-red-500" role="alert">
                     {coinbaseError}
                  </p>
               )}

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
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                     <span className="rounded-full bg-[#e6f9ef] px-2 py-0.5 text-[10px] font-semibold text-[#1a8c4e]">
                        &lt; 0.5% fee
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
                           SOL and USDC to Base &middot; opens Superbridge
                        </p>
                     </div>
                     <ExternalLink className="h-[18px] w-[18px] shrink-0 text-md-neutral-800" />
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                     <span className="rounded-full bg-[#e6f9ef] px-2 py-0.5 text-[10px] font-semibold text-[#1a8c4e]">
                        Gas only
                     </span>
                  </div>
               </button>
            </div>
         </section>

         {/* Other ways to add funds (exchanges, P2P, local services, other wallets).
             relative z-10 lifts this above the absolute backdrop — otherwise the backdrop paints
             over it and a tap on "Learn more" closed the sheet instead of navigating. */}
         <p className="relative z-10 w-full max-w-[440px] px-4 pb-2 text-[12px] font-normal leading-snug text-md-neutral-800">
            Prefer another way? You can also buy USDC on an exchange (Binance P2P, Coins.ph, PDAX, GCrypto),
            through an external service like Moneybees, or send it from any wallet — always on the Base network.{' '}
            <button
               type="button"
               onClick={() => {
                  onClose();
                  navigate('/support/guides/adding-funds-to-your-wallet');
               }}
               className="font-semibold text-md-primary-1200 underline underline-offset-2"
            >
               Learn more
            </button>
         </p>

         <style>{`
            @keyframes slideUp {
               from { transform: translateY(100%); }
               to { transform: translateY(0); }
            }
         `}</style>
      </div>
      {showBridge && <FundBridge onClose={() => setShowBridge(false)} />}
      </>
   );
}
