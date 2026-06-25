import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { AlertTriangle, ArrowLeft, ArrowUpRight, Check, CheckCircle2, ChevronDown, Copy, ExternalLink, Loader2, ShieldCheck, Wallet, X } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { erc20Abi } from 'viem';
import { useAccount, useReadContract } from 'wagmi';

import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { TOAST_TYPES } from '@/components/ToastSystem/types';

import { useGeoCheck } from '@/hooks/useGeoCheck';
import { useLoanData } from '@/hooks/useLoanData';
import useWallet from '@/hooks/useWallet';

import { formatCurrency } from '@/utils/decimalHelpers';

import { ALLOWED_CHAIN_ID, BASE_USDC_ADDRESS } from '@/config/wagmiConfig';
import { formatWalletAddressShort, getBaseWalletLockStatus } from '@/lib/walletProvider';
import type { RootState } from '@/store/store';
import type { Loan } from '@/types/loanTypes';

// ─── Exchange cash-out rails ──────────────────────────────────────────────────
// The withdraw flow is the inverse of the repay "add funds" flow: the borrower
// already holds USDC (their funded loan) and sends it OUT to an exchange to sell
// for local currency. The on-chain send is the same for every self-service rail
// (transfer USDC on Base to the deposit address the exchange shows); only the
// "how to get the address" and "how to sell" guidance differs. Moneybees is an
// assisted OTC desk — the borrower gets the destination address over chat after a
// quick KYC, then sends with the same control below.
type ExchangeId = 'moneybees' | 'coinsph' | 'gcrypto' | 'pdax' | 'binance';

type Exchange = {
   id: ExchangeId;
   label: string;
   blurb: string;
   payout: string;
   eta: string;
   fee: 'free' | 'small';
   assisted?: boolean;
   open: { label: string; href: string };
   depositSteps: string[];
   sellTitle: string;
   sellSteps: string[];
};

const EXCHANGES: Record<ExchangeId, Exchange> = {
   moneybees: {
      id: 'moneybees',
      label: 'Moneybees',
      blurb: 'Assisted cash-out · BSP-registered',
      payout: 'Bank, GCash or Maya',
      eta: '~1 business day',
      fee: 'free',
      assisted: true,
      open: { label: 'Chat with Moneybees', href: 'https://www.moneybees.ph' },
      depositSteps: [
         'Message Moneybees on Telegram, Viber or WhatsApp.',
         'Complete the quick one-time ID check (about 1 minute).',
         'They confirm the rate and send you a USDC (Base) address to pay to.',
         'Paste that address below and send — only after they confirm the details.'
      ],
      sellTitle: 'Getting your pesos',
      sellSteps: [
         'Moneybees converts your USDC at the rate you agreed.',
         'They pay out to your bank, GCash, or Maya — usually within a business day.'
      ]
   },
   coinsph: {
      id: 'coinsph',
      label: 'Coins.ph',
      blurb: 'Sell for local currency, withdraw to bank or GCash',
      payout: 'Bank or GCash',
      eta: '~30 min',
      fee: 'small',
      open: { label: 'Open Coins.ph', href: 'https://coins.ph' },
      depositSteps: [
         'Open Coins.ph → Portfolio → USDC → Receive.',
         'Choose Base as the network.',
         'Copy the deposit address shown, then paste it below.'
      ],
      sellTitle: 'Cash out with Coins.ph',
      sellSteps: [
         'Once your USDC arrives, tap Trade → Sell → USDC.',
         'Go to Portfolio → Withdraw / Cash Out.',
         'Choose your bank or e-wallet, pick InstaPay or PESONet, and confirm with the OTP.'
      ]
   },
   gcrypto: {
      id: 'gcrypto',
      label: 'GCrypto',
      blurb: 'Cash out straight to your GCash',
      payout: 'GCash balance',
      eta: '~5 min',
      fee: 'free',
      open: { label: 'Open GCash', href: 'https://www.gcash.com' },
      depositSteps: [
         'Open GCash → Enjoy → GCrypto → Receive.',
         'Choose USDC, then select Base as the network.',
         'Copy the address shown, then paste it below.'
      ],
      sellTitle: 'Cash out to pesos in GCash',
      sellSteps: [
         'Once your USDC is in GCrypto, tap Sell.',
         'Choose USDC and enter the amount.',
         'Confirm — pesos land in your GCash balance in under a minute.'
      ]
   },
   pdax: {
      id: 'pdax',
      label: 'PDAX',
      blurb: 'Sell for local currency, withdraw to bank or e-wallet',
      payout: 'Bank, GCash or Maya',
      eta: '~30 min',
      fee: 'small',
      open: { label: 'Open PDAX', href: 'https://www.pdax.ph' },
      depositSteps: [
         'Open PDAX → Portfolio → USDC → Receive.',
         'Choose Base as the network.',
         'Copy your deposit address, then paste it below.'
      ],
      sellTitle: 'Cash out to pesos with PDAX',
      sellSteps: [
         'Once your USDC arrives, go to Trade → Sell and pick USDC → PHP.',
         'Enter the amount and confirm the sale.',
         'Go to Wallet → Withdraw PHP and pick your bank, GCash, or Maya.'
      ]
   },
   binance: {
      id: 'binance',
      label: 'Binance',
      blurb: 'Sell for local currency via P2P marketplace',
      payout: 'Bank or local wallet',
      eta: '30 min–hours',
      fee: 'small',
      open: { label: 'Open Binance', href: 'https://www.binance.com' },
      depositSteps: [
         'Open Binance → Wallet → Receive (or Deposit → Deposit Crypto).',
         'Select USDC (not USDT) and choose Base as the network.',
         'Copy the address shown, then paste it below.'
      ],
      sellTitle: 'Cash out with Binance P2P',
      sellSteps: [
         'Once your USDC arrives, open P2P Trading → Sell → USDC.',
         'Choose your local currency and payout method, then pick a buyer with a high completion rate.',
         'Release USDC only after the payment actually lands in your account — check it yourself first.'
      ]
   }
};

const renderExchangeLogo = (id: ExchangeId) => {
   if (id === 'moneybees') {
      return (
         <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 1L17.5 5.25V13.75L10 18L2.5 13.75V5.25L10 1Z" fill="#F7B700" stroke="#111" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M10 5.5L14 7.75L10 10L6 7.75L10 5.5Z" fill="white" />
            <path d="M6 7.75V11.75L10 14V10L6 7.75Z" fill="#e5a800" />
            <path d="M14 7.75V11.75L10 14V10L14 7.75Z" fill="#1a1a1a" />
         </svg>
      );
   }
   if (id === 'gcrypto') {
      return (
         <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="9" cy="10" r="8.5" stroke="#00AEEF" strokeWidth="1.5" fill="none" />
            <path d="M14 8.5H10V10.5H12.5C12.1 11.8 10.9 12.5 9.5 12.5C7.6 12.5 6 11 6 9C6 7 7.6 5.5 9.5 5.5C10.4 5.5 11.3 5.9 11.9 6.5L13.3 5.1C12.3 4.2 10.9 3.5 9.5 3.5C6.5 3.5 4 6 4 9C4 12 6.5 14.5 9.5 14.5C12.5 14.5 15 12 15 9V8.5H14Z" fill="#0050A0" />
         </svg>
      );
   }
   if (id === 'pdax') {
      return (
         <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="10" fill="#1B2A4A" />
            <path d="M5 14.5L7.8 5.5H10.2L7.4 14.5H5Z" fill="#00D097" />
            <path d="M9.8 14.5L12.6 5.5H15L12.2 14.5H9.8Z" fill="#00D097" />
         </svg>
      );
   }
   if (id === 'coinsph') {
      return (
         <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="10" fill="#E9A200" />
            <circle cx="10" cy="10" r="8" fill="#3B60C4" />
            <path d="M13.2 6.2 A5 5 0 1 0 13.2 13.8" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
         </svg>
      );
   }
   // binance
   return (
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
         <circle cx="12" cy="12" r="12" fill="#0B0E11" />
         <path fill="#F3BA2F" d="m16.624 13.92 2.717 2.716-7.353 7.353-7.352-7.352 2.717-2.717 4.636 4.66 4.635-4.66zm4.637-4.636L24 12l-2.715 2.716L18.568 12l2.693-2.716zm-9.272 0 2.716 2.692-2.717 2.717L9.272 12l2.716-2.715zm-9.273 0L5.41 12l-2.692 2.692L0 12l2.716-2.716zM11.99.01l7.352 7.33-2.717 2.715-4.636-4.636-4.635 4.66-2.717-2.716L11.989.011z" />
      </svg>
   );
};

const isValidAddress = (value: string): boolean => /^0x[a-fA-F0-9]{40}$/.test(value.trim());

const getFundedAmount = (loan: Loan): number => Number(loan.loanAmount || 0);

export default function Withdraw() {
   const navigate = useNavigate();
   const location = useLocation();
   const { showToast } = useToast();
   const { Transfer } = useWallet();
   const account = useAccount();

   const user = useSelector((state: RootState) => state.auth.user);
   const loans = useSelector((state: RootState) => state.loans.loans.gloans);

   // Preview host: localhost / *.vercel.app, route /withdraw-preview — mock a funded
   // wallet so the flow is visible without a real Base Account.
   const isPreview = useMemo(() => {
      if (typeof window === 'undefined') return false;
      const isPreviewHost = ['127.0.0.1', 'localhost'].includes(window.location.hostname) || window.location.hostname.endsWith('.vercel.app');
      return isPreviewHost && location.pathname === '/withdraw-preview';
   }, [location.pathname]);

   useLoanData({ userId: user.id, enabled: Boolean(user.id) && !isPreview });

   const { allowed: geoAllowed, loading: geoLoading } = useGeoCheck(isPreview);
   const inPhilippines = geoAllowed;

   // Borrower's funded loans (the disbursed USDC they can now cash out).
   const fundedLoans = useMemo(
      () => loans.filter((loan) => loan.borrowerUser === user.id && loan.loanStatus === 'Lent'),
      [loans, user.id]
   );
   const fundedTotal = useMemo(() => fundedLoans.reduce((sum, loan) => sum + getFundedAmount(loan), 0), [fundedLoans]);

   const PREVIEW_ADDRESS = '0x1234aBCd5678Ef901234abcd5678ef901234ABcd';
   const walletAddress = getBaseWalletLockStatus(user).address ?? account.address ?? (isPreview ? PREVIEW_ADDRESS : '');

   // Read the borrower's live on-chain USDC balance — this is what they can withdraw.
   // Public balance read, not custody. In preview, mock a funded balance.
   const { data: usdcBalanceRaw } = useReadContract({
      abi: erc20Abi,
      address: BASE_USDC_ADDRESS,
      functionName: 'balanceOf',
      args: walletAddress ? [walletAddress as `0x${string}`] : undefined,
      chainId: ALLOWED_CHAIN_ID,
      query: { enabled: Boolean(walletAddress) && !isPreview, refetchInterval: 30000 }
   });
   const usdcBalance = isPreview ? 121 : typeof usdcBalanceRaw === 'bigint' ? Number(usdcBalanceRaw) / 1e6 : null;
   const availableToWithdraw = usdcBalance ?? fundedTotal;

   const [selectedId, setSelectedId] = useState<ExchangeId>('moneybees');
   const [address, setAddress] = useState('');
   const [amount, setAmount] = useState('');
   const [showMore, setShowMore] = useState(false);
   const [copied, setCopied] = useState(false);
   const [isSending, setIsSending] = useState(false);
   const [sentHash, setSentHash] = useState<string | null>(null);

   // Keep the selected rail valid for the user's region: abroad only Binance is
   // offered; in PH default to the recommended local rail.
   useEffect(() => {
      if (geoLoading) return;
      if (!inPhilippines) setSelectedId('binance');
      else setSelectedId((current) => (current === 'binance' ? 'moneybees' : current));
   }, [inPhilippines, geoLoading]);

   const exchange = EXCHANGES[selectedId];

   const phOrder: ExchangeId[] = ['moneybees', 'coinsph', 'gcrypto', 'pdax', 'binance'];
   const intlOrder: ExchangeId[] = ['binance', 'gcrypto', 'pdax', 'coinsph'];
   const order = inPhilippines ? phOrder : intlOrder;
   const primaryId = order[0];
   const restIds = order.slice(1);

   const addrValid = isValidAddress(address);
   const amtNum = parseFloat(amount);
   const amtValid = !isNaN(amtNum) && amtNum > 0 && amtNum <= availableToWithdraw + 0.0001;
   const canSend = addrValid && amtValid && !isSending;

   const setMax = () => setAmount(formatCurrency(availableToWithdraw));

   const handleCopy = useCallback(async () => {
      if (!walletAddress) return;
      try {
         await navigator.clipboard.writeText(walletAddress);
         setCopied(true);
         window.setTimeout(() => setCopied(false), 1800);
      } catch {
         showToast(TOAST_TYPES.ERROR, 'Copy failed', 'Could not copy your wallet address.', undefined, undefined);
      }
   }, [walletAddress, showToast]);

   const handleAmount = (event: ChangeEvent<HTMLInputElement>) => setAmount(event.target.value);

   const handleSend = useCallback(async () => {
      if (!canSend) return;
      if (isPreview) {
         setIsSending(true);
         window.setTimeout(() => {
            setIsSending(false);
            setSentHash('0xpreview');
         }, 1500);
         return;
      }

      setIsSending(true);
      const hash = await Transfer(address.trim(), amount, fundedLoans[0]?.id ?? 'withdraw', 'USDC');
      setIsSending(false);
      if (hash) {
         setSentHash(hash);
         showToast(TOAST_TYPES.SUCCESS, 'USDC sent', `${amount} USDC is on its way to ${exchange.label}.`, undefined, undefined);
      }
   }, [canSend, isPreview, Transfer, address, amount, fundedLoans, exchange.label, showToast]);

   const renderExchangeRow = (id: ExchangeId, recommended = false) => {
      const ex = EXCHANGES[id];
      const active = selectedId === id;
      return (
         <button
            key={id}
            type="button"
            onClick={() => setSelectedId(id)}
            aria-pressed={active}
            className={`relative flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition active:scale-[0.99] ${
               active ? 'border-2 border-[#6c3fe0] bg-[#f3effe] dark:bg-[#2a1740]' : 'border border-[#e9e3f8] bg-white hover:border-md-primary-300 dark:border-[#3d2a60] dark:bg-[#1e1535]'
            }`}
         >
            {recommended ? (
               <span className="absolute -top-2 left-3 rounded-full bg-[#6c3fe0] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">Recommended</span>
            ) : null}
            {renderExchangeLogo(id)}
            <span className="min-w-0 flex-1">
               <span className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-[#1a1240] dark:text-white">{ex.label}</span>
                  {ex.fee === 'free' ? (
                     <span className="rounded-full bg-[#dcfce7] px-1.5 py-0.5 text-[10px] font-bold text-[#16a34a]">Free</span>
                  ) : (
                     <span className="rounded-full bg-[#ede9f8] px-1.5 py-0.5 text-[10px] font-bold text-[#6b6090]">Small fee</span>
                  )}
               </span>
               <span className="mt-0.5 block text-xs text-[#6b6090] dark:text-[#a095c8]">{ex.blurb}</span>
               <span className="block text-[11px] text-[#9990b8] dark:text-[#7d70a8]">{ex.payout} · {ex.eta}</span>
            </span>
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-[#6c3fe0] bg-[#6c3fe0]' : 'border-[#cbbef0]'}`}>
               {active ? <Check className="h-3 w-3 text-white" strokeWidth={3.5} /> : null}
            </span>
         </button>
      );
   };

   // ── Success state — the on-chain send went through ────────────────────────
   if (sentHash) {
      return (
         <main className="min-h-screen bg-md-neutral-200 px-4 pb-28 pt-5 sm:px-6 dark:bg-[#140d28]">
            <div className="mx-auto flex w-full max-w-[440px] flex-col gap-4">
               <header className="flex items-center gap-3">
                  <button type="button" onClick={() => navigate('/dashboard')} className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md-card dark:bg-[#1e1535]">
                     <ArrowLeft className="h-5 w-5 text-md-heading dark:text-white" aria-hidden="true" />
                  </button>
                  <h1 className="text-md-h4 font-semibold text-md-heading dark:text-white">Withdraw</h1>
               </header>

               <section className="flex flex-col items-center rounded-md-xl border border-md-neutral-300 bg-white px-6 py-9 text-center shadow-md-card dark:border-[#3d2a60] dark:bg-[#1a1240]">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#dcfce7] dark:bg-[#052e16]">
                     <CheckCircle2 className="h-8 w-8 text-[#16a34a]" aria-hidden="true" />
                  </span>
                  <h2 className="mt-5 text-md-h4 font-semibold text-md-heading dark:text-white">{amount} USDC sent</h2>
                  <p className="mt-2 max-w-[320px] text-md-b2 text-md-neutral-1200 dark:text-[#a095c8]">
                     On its way to <span className="font-semibold text-md-heading dark:text-white">{exchange.label}</span>. It usually arrives in a minute or two.
                  </p>
                  {sentHash !== '0xpreview' ? (
                     <a
                        href={`https://basescan.org/tx/${sentHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex items-center gap-1.5 text-md-b3 font-semibold text-[#6c3fe0] hover:underline"
                     >
                        View transaction <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                     </a>
                  ) : null}
               </section>

               <section className="rounded-md-xl border border-md-neutral-300 bg-white p-5 shadow-md-card dark:border-[#3d2a60] dark:bg-[#1a1240]">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#6c3fe0]">After it arrives</p>
                  <p className="mb-3 text-md-b1 font-semibold text-md-heading dark:text-white">{exchange.sellTitle}</p>
                  <ol className="flex flex-col gap-3">
                     {exchange.sellSteps.map((step, i) => (
                        <li key={i} className="flex gap-3">
                           <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#cbbef0] text-[11px] font-bold text-[#6c3fe0]">{i + 1}</span>
                           <span className="text-md-b3 text-md-neutral-1200 dark:text-[#a095c8]">{step}</span>
                        </li>
                     ))}
                  </ol>
               </section>

               <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="w-full rounded-full bg-[#6c3fe0] py-4 text-[15px] font-semibold text-white active:scale-[0.98]"
               >
                  Done
               </button>
            </div>
         </main>
      );
   }

   return (
      <main className="min-h-screen bg-md-neutral-200 px-4 pb-28 pt-5 sm:px-6 dark:bg-[#140d28]">
         <div className="mx-auto flex w-full max-w-[440px] flex-col gap-4">
            <header className="flex items-center gap-3">
               <button type="button" onClick={() => navigate('/dashboard')} className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md-card dark:bg-[#1e1535]">
                  <ArrowLeft className="h-5 w-5 text-md-heading dark:text-white" aria-hidden="true" />
               </button>
               <h1 className="text-md-h4 font-semibold text-md-heading dark:text-white">Withdraw your USDC</h1>
            </header>

            {/* Available balance */}
            <section className="flex items-center gap-3 rounded-md-xl border border-md-neutral-300 bg-white p-4 shadow-md-card dark:border-[#3d2a60] dark:bg-[#1a1240]">
               <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f3effe] dark:bg-[#2a1740]">
                  <Wallet className="h-5 w-5 text-[#6c3fe0]" aria-hidden="true" />
               </span>
               <div className="min-w-0 flex-1">
                  <p className="text-xs text-md-neutral-1200 dark:text-[#a095c8]">Available to withdraw</p>
                  <p className="text-[22px] font-semibold leading-tight text-md-heading dark:text-white">${formatCurrency(availableToWithdraw)} USDC</p>
               </div>
               <ArrowUpRight className="h-5 w-5 shrink-0 text-[#6c3fe0]" aria-hidden="true" />
            </section>

            {/* Step 1 — pick a cash-out option */}
            <section>
               <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#6c3fe0] text-[11px] font-bold text-white">1</span>
                  <p className="text-sm font-semibold text-[#1a1240] dark:text-white">How would you like to cash out?</p>
               </div>
               {geoLoading ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#6b6090] dark:text-[#a095c8]">
                     <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your options…
                  </div>
               ) : (
                  <div className="flex flex-col gap-2">
                     {renderExchangeRow(primaryId, true)}
                     {restIds.length > 0 ? (
                        <>
                           <button
                              type="button"
                              onClick={() => setShowMore((v) => !v)}
                              aria-expanded={showMore || restIds.includes(selectedId)}
                              className="flex min-h-[40px] w-full items-center justify-center gap-1 text-xs font-semibold text-[#6b6090] transition hover:text-[#6c3fe0] dark:text-[#a095c8]"
                           >
                              {showMore || restIds.includes(selectedId) ? 'Fewer options' : 'Other options'}
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMore || restIds.includes(selectedId) ? 'rotate-180' : ''}`} aria-hidden="true" />
                           </button>
                           {showMore || restIds.includes(selectedId) ? <div className="flex flex-col gap-2">{restIds.map((id) => renderExchangeRow(id))}</div> : null}
                        </>
                     ) : null}
                  </div>
               )}
            </section>

            {/* Step 2 — how to get the deposit address */}
            <section className="rounded-md-xl border border-md-neutral-300 bg-white p-5 shadow-md-card dark:border-[#3d2a60] dark:bg-[#1a1240]">
               <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#6c3fe0] text-[11px] font-bold text-white">2</span>
                  <p className="text-sm font-semibold text-[#1a1240] dark:text-white">
                     {exchange.assisted ? `Get your address from ${exchange.label}` : `Get your ${exchange.label} deposit address`}
                  </p>
               </div>
               <ol className="mb-3 flex flex-col gap-2.5">
                  {exchange.depositSteps.map((step, i) => (
                     <li key={i} className="flex gap-2.5">
                        <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#f3effe] text-[10px] font-bold text-[#6c3fe0] dark:bg-[#2a1740]">{i + 1}</span>
                        <span className="text-md-b3 leading-snug text-md-neutral-1200 dark:text-[#a095c8]">{step}</span>
                     </li>
                  ))}
               </ol>
               <a href={exchange.open.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-md-b3 font-semibold text-[#6c3fe0] hover:underline">
                  {exchange.open.label} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
               </a>

               <div className="mt-4 rounded-xl bg-[#fdf6ec] px-3.5 py-3 dark:bg-[#2a2010]">
                  <p className="flex items-start gap-2 text-[12px] leading-snug text-[#92600a] dark:text-[#e8c887]">
                     <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                     Only send on the <span className="font-semibold">Base</span> network. Sending on another network can lose your funds.
                  </p>
               </div>
            </section>

            {/* Step 3 — paste address + amount + send */}
            <section className="rounded-md-xl border border-md-neutral-300 bg-white p-5 shadow-md-card dark:border-[#3d2a60] dark:bg-[#1a1240]">
               <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#6c3fe0] text-[11px] font-bold text-white">3</span>
                  <p className="text-sm font-semibold text-[#1a1240] dark:text-white">Send to {exchange.label}</p>
               </div>

               <label className="mb-1.5 block text-xs font-semibold text-[#6b6090] dark:text-[#a095c8]">{exchange.label} deposit address</label>
               <div className="relative mb-1 flex items-center rounded-xl border border-[#e9e3f8] bg-white dark:border-[#3d2a60] dark:bg-[#140d28]">
                  <input
                     value={address}
                     onChange={(e) => setAddress(e.target.value)}
                     placeholder={`Paste the address from ${exchange.label}`}
                     className="w-full flex-1 bg-transparent px-3.5 py-3 text-sm text-md-heading placeholder:text-[#a89cc8] focus:outline-none dark:text-white"
                  />
                  {address ? (
                     <button type="button" onClick={() => setAddress('')} className="pr-3 text-[#a89cc8] hover:text-md-heading" aria-label="Clear address">
                        <X className="h-4 w-4" aria-hidden="true" />
                     </button>
                  ) : null}
               </div>
               {address && !addrValid ? (
                  <p className="mb-2 flex items-center gap-1 text-[12px] text-[#dc2626]">
                     <AlertTriangle className="h-3 w-3" aria-hidden="true" /> That doesn't look like a valid wallet address.
                  </p>
               ) : null}

               <label className="mb-1.5 mt-3 block text-xs font-semibold text-[#6b6090] dark:text-[#a095c8]">Amount</label>
               <div className="relative flex items-center rounded-xl border border-[#e9e3f8] bg-white dark:border-[#3d2a60] dark:bg-[#140d28]">
                  <input
                     type="number"
                     inputMode="decimal"
                     value={amount}
                     onChange={handleAmount}
                     placeholder="0"
                     className="w-full min-w-0 flex-1 bg-transparent px-3.5 py-3 text-sm text-md-heading placeholder:text-[#a89cc8] focus:outline-none dark:text-white"
                  />
                  <button type="button" onClick={setMax} className="shrink-0 pr-2 text-xs font-semibold text-[#6c3fe0] hover:underline">Max</button>
                  <span className="shrink-0 pr-3.5 text-sm font-semibold text-[#6b6090]">USDC</span>
               </div>
               <p className="mt-1.5 text-[12px] text-[#6b6090] dark:text-[#a095c8]">Available: ${formatCurrency(availableToWithdraw)} USDC</p>

               {!isPreview && !walletAddress ? (
                  <p className="mt-3 flex items-center gap-1.5 text-[12px] text-[#dc2626]">
                     <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Connect your Base Account to send.
                  </p>
               ) : null}

               <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full py-4 text-[15px] font-semibold text-white transition active:scale-[0.98] ${
                     canSend ? 'bg-[#6c3fe0]' : 'cursor-not-allowed bg-[#c4b5e8]'
                  }`}
               >
                  {isSending ? (
                     <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Sending…</>
                  ) : (
                     <>Send {amount || '0'} USDC to {exchange.label}</>
                  )}
               </button>

               <p className="mt-3 text-center text-[12px] text-[#6b6090] dark:text-[#a095c8]">
                  <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-[#6c3fe0]" aria-hidden="true" />
                  Sent from your own wallet — Moodeng never holds your funds.
               </p>
            </section>

            {/* Your wallet address (for reference / receiving back) */}
            {walletAddress ? (
               <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center justify-between gap-2 rounded-md-xl border border-md-neutral-300 bg-white px-4 py-3 text-left shadow-md-card dark:border-[#3d2a60] dark:bg-[#1a1240]"
               >
                  <div className="min-w-0">
                     <p className="text-[11px] font-semibold text-[#6b6090] dark:text-[#a095c8]">Your wallet (Base)</p>
                     <p className="truncate font-mono text-sm font-semibold text-md-heading dark:text-white">{formatWalletAddressShort(walletAddress)}</p>
                  </div>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${copied ? 'bg-[#16a34a]' : 'bg-[#6c3fe0]'}`}>
                     {copied ? <Check className="h-3.5 w-3.5 text-white" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5 text-white" aria-hidden="true" />}
                  </span>
               </button>
            ) : null}
         </div>
      </main>
   );
}
