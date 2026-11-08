import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { unwrapResult } from '@reduxjs/toolkit';
import {
   AlertTriangle,
   ArrowLeft,
   Check,
   ChevronDown,
   Clock,
   Copy,
   ExternalLink,
   Loader2,
   MessageCircle,
   PlayCircle,
   ShieldCheck,
   TrendingUp,
   Wallet,
   X
} from 'lucide-react';
import posthog from 'posthog-js';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { erc20Abi } from 'viem';
import { useAccount, useConnect, useReadContract, useSwitchChain, useWatchContractEvent } from 'wagmi';

import { useBottomNavPrimaryAction } from '@/components/BottomNavActionContext';
import RepayInAppBrowserGate from '@/components/RepayInAppBrowserGate';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { TOAST_TYPES } from '@/components/ToastSystem/types';
import UserAvatar from '@/components/UserAvatar';
import { useVerifyYourself } from '@/components/verification/VerifyYourselfModal';

import { useGeoCheck } from '@/hooks/useGeoCheck';
import { useIdOnboarding } from '@/hooks/useIdOnboarding';
import { useLoanData } from '@/hooks/useLoanData';
import { useVerificationJourney } from '@/hooks/useVerificationJourney';
import useWallet, { type PaymentMethod, toSettlementMethod, useActivePaymentMethod } from '@/hooks/useWallet';

import { parseDateSafely } from '@/utils/dateFormatters';
import { formatCurrency, toNumber } from '@/utils/decimalHelpers';

import { getCreditLevelNumber, getNextCreditTier, STARTING_CREDIT_LIMIT } from '@/config/creditTiers';
import { COINS_PH_SUSPENDED, COINS_PH_SUSPENDED_MESSAGE, COINS_PH_SUSPENDED_TITLE } from '@/config/paymentRails';
import { ALLOWED_CHAIN_ID, BASE_USDC_ADDRESS } from '@/config/wagmiConfig';
import { useLocalization } from '@/i18n';
import { clearPendingBasePayment, hasPendingPaymentForLoan, registerPendingBasePayment } from '@/lib/basePayReconciliation';
import { evaluateCreditProgression } from '@/lib/creditLeveling';
import { ensureAllowedChain } from '@/lib/ensureAllowedChain';
import { detectInAppBrowser, shouldBlockRepayForInAppBrowser } from '@/lib/inAppBrowser';
import { isUserVerified } from '@/lib/isUserVerified';
import { getDueDayEnd, getLoanTimezone, isPastDueDay } from '@/lib/loanDeadline';
import { formatIdr, remainingIdr } from '@/lib/loanMarket';
import { clearStep, readStep, writeStep } from '@/lib/stepMemory';
import { openSupportChat } from '@/lib/support/liveChat';
import { useUsdcRate } from '@/lib/useUsdcRate';
import { areWalletAddressesEqual, formatWalletAddressShort, getBaseWalletLockStatus, isBaseWalletProvider } from '@/lib/walletProvider';
import { confirmLoanPayment, getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { ERROR_CODES } from '@/types/errorCodes';
import { getToastKeyFromErrorCode } from '@/types/errorToastMapping';
import type { Loan } from '@/types/loanTypes';
import { CONNECT_HIPPOS } from '@/views/dashboard/components/connectKit';
import { Card, DoneRow, GoldButton, SoftButton, StepHead, WaitRow } from '@/views/indonesia/ui';
import WaltRepaySteps from '@/views/indonesia/walt/WaltRepaySteps';
import AppGuideSteps from '@/views/repay/AppGuideSteps';
import { suggestedBuyAmount as suggestedGcryptoBuyAmount } from '@/views/repay/gcryptoBuyAmount';
import GcryptoPictureSteps from '@/views/repay/GcryptoPictureSteps';

// The step-by-step repay (like onboarding): one small card per step, each ending in a green "done".
// Already holding enough USDC: one screen with the Pay button (no steps).
const WIZARD_STEPS = ['amount', 'source', 'send', 'pay'] as const;
type WizardStep = (typeof WIZARD_STEPS)[number];
const WIZARD_LABELS: Record<WizardStep, string> = {
   amount: 'How much',
   source: 'Pick an app',
   send: 'Send USDC',
   pay: 'Pay'
};

// Repay-funnel analytics (PostHog only runs in production, see main.tsx).
const trackRepay = (event: string, props?: Record<string, unknown>) => {
   if (import.meta.env.PROD) posthog.capture(event, props);
};
const repayMemoryKey = (loanId: string) => `moodeng-repay:${loanId}`;
const repayGuideMemoryKey = (loanId: string, source: string) => `moodeng-repay-guide:${loanId}:${source}`;
type RepayMemory = { step: WizardStep; source: FundSourceId; amount: string };

function RepayTrail({ step, onPick }: { step: WizardStep; onPick: (step: WizardStep) => void }) {
   const index = WIZARD_STEPS.indexOf(step);
   return (
      <div className="pt-1">
         <ol className="flex items-center justify-between gap-1" aria-label={`Step ${index + 1} of ${WIZARD_STEPS.length}`}>
            {WIZARD_STEPS.map((key, i) => {
               const done = i < index;
               const isCurrent = i === index;
               return (
                  <li key={key} className="flex flex-1 items-center last:flex-none">
                     <button
                        type="button"
                        aria-current={isCurrent ? 'step' : undefined}
                        aria-label={WIZARD_LABELS[key]}
                        disabled={!done}
                        onClick={() => onPick(key)}
                        className={`grid size-9 shrink-0 place-items-center rounded-full text-[15px] font-extrabold transition ${
                           done
                              ? 'bg-[#2f9e44] text-white'
                              : isCurrent
                                ? 'bg-[#ffd75a] text-[#4a2a00] ring-4 ring-[#ffe9a8] dark:ring-[#4a3a10]'
                                : 'bg-[#efe6cc] text-[#9a8a6a] dark:bg-[#2a2335] dark:text-[#8a7f99]'
                        }`}
                     >
                        {done ? <Check aria-hidden="true" className="size-4" strokeWidth={3.5} /> : i + 1}
                     </button>
                     {i < WIZARD_STEPS.length - 1 ? (
                        <span className={`mx-1 h-1 flex-1 rounded-full ${done ? 'bg-[#2f9e44]' : 'bg-[#efe6cc] dark:bg-[#2a2335]'}`} />
                     ) : null}
                  </li>
               );
            })}
         </ol>
         <p className="mt-2 text-center text-[14px] font-bold text-[#7a6a4f] dark:text-[#bfb29a]">
            Step {index + 1} of {WIZARD_STEPS.length} · {WIZARD_LABELS[step]}
         </p>
      </div>
   );
}

const quickRepaymentFractions = [
   { label: '25%', value: 0.25 },
   { label: '50%', value: 0.5 },
   { label: '75%', value: 0.75 },
   { label: 'Full', value: 1 }
];

// Places a borrower can buy USDC and send it to their Base Account. The repay flow is the
// same for all (send USDC on Base to the address below); only the "open" link differs.
// The local rails (Coins.ph, Moneybees, GCrypto, PDAX) are shown to EVERYONE, regardless of
// detected location — Coins.ph leads as the featured exchange, Moneybees is offered as an
// EXTERNAL user-directed option (no Moodeng partnership; they drive their own process),
// GCrypto/PDAX sit under "Other options". Location (`inPhilippines`, see below) only ever
// ADDS Binance under "Other options" for users detected outside the Philippines — it never
// hides the local rails. Most of Moodeng's users are Filipino, including many living or
// traveling abroad, and their Coins.ph/GCash/PDAX accounts work fine from anywhere; a
// location-based lookup only knows where the phone's IP is, not the user's nationality or
// which accounts they actually hold, so it must never be the thing that hides their own
// rails. Binance stays excluded specifically for users detected IN the Philippines, where
// Binance doesn't operate. Order matters: index 0 renders as the hero card, index 1 as the
// pill below it.
//
// Indonesian borrowers (IP in Indonesia, or the app set to Bahasa Indonesia) get Indonesian
// exchanges only: Tokocrypto leads, Reku is the pill, Pintu/Indodax sit under "Other options".
// Unlike Filipinos abroad, there are no Filipino borrowers living in Indonesia on the platform, so
// the Philippine rails and Binance aren't offered there. All four Indonesian exchanges support
// USDC withdrawals on Base (checked 2026-09-30); they have no deep link because their app URL
// schemes aren't documented — the web URL hands off to the app where it's installed.
const fundSources = [
   { id: 'coinsph', label: 'Coins.ph', action: 'Open Coins.ph', href: 'https://coins.ph', deepLink: 'coinsph://' },
   { id: 'moneybees', label: 'Moneybees', action: 'Visit Moneybees', href: 'https://www.moneybees.ph', deepLink: null },
   { id: 'gcrypto', label: 'GCrypto', action: 'Open GCrypto', href: 'https://www.gcash.com', deepLink: 'gcash://' },
   { id: 'pdax', label: 'PDAX', action: 'Open PDAX', href: 'https://www.pdax.ph', deepLink: 'pdax://' },
   {
      id: 'binance',
      label: 'Binance',
      action: 'Open Binance',
      href: 'https://www.binance.com/en/my/wallet/account/main/withdrawal/crypto/USDC',
      deepLink: 'bnc://app.binance.com/'
   },
   { id: 'reku', label: 'Reku', action: 'Open Reku', href: 'https://reku.id', deepLink: null },
   { id: 'tokocrypto', label: 'Tokocrypto', action: 'Open Tokocrypto', href: 'https://www.tokocrypto.com', deepLink: null },
   { id: 'indodax', label: 'Indodax', action: 'Open Indodax', href: 'https://indodax.com', deepLink: null },
   { id: 'pintu', label: 'Pintu', action: 'Open Pintu', href: 'https://pintu.co.id', deepLink: null }
] as const;

type FundSourceId = (typeof fundSources)[number]['id'];
type FundSource = (typeof fundSources)[number];

const getFundSource = (id: FundSourceId): FundSource => fundSources.find((source) => source.id === id) ?? fundSources[0];

// The hero (featured) source. Coins.ph normally; PDAX while Coins.ph is suspended — Coins.ph then
// moves under "Other options", greyed out, with its steps kept intact for when it comes back.
const HERO_SOURCE_ID: FundSourceId = COINS_PH_SUSPENDED ? 'pdax' : 'coinsph';
const isPausedSource = (id: FundSourceId) => id === 'coinsph' && COINS_PH_SUSPENDED;

// Indonesian layout: Tokocrypto is the hero — it's the cheapest at our loan sizes (average ~$15).
// A $15 repayment topped up by bank transfer costs ~$0.23 there (free bank/VA deposit, 0.2222% to
// buy USDC/IDR, 0.2 USDC to withdraw on Base) vs ~$0.50 on Reku (0.0111% to buy, 0.5 USDC to
// withdraw); Reku only wins above ~$140. Tokocrypto charges 2% on QRIS/e-wallet deposits, hence
// the bank-transfer nudge in its subtitle. Reku is the pill below it.
const INDONESIA_HERO_SOURCE_ID: FundSourceId = 'tokocrypto';
const INDONESIA_PILL_SOURCE_ID: FundSourceId = 'reku';
const INDONESIA_OTHER_SOURCE_IDS: readonly FundSourceId[] = ['pintu', 'indodax'];
const INDONESIA_SOURCE_IDS: readonly FundSourceId[] = [INDONESIA_HERO_SOURCE_ID, INDONESIA_PILL_SOURCE_ID, ...INDONESIA_OTHER_SOURCE_IDS];

// Everything an Indonesian borrower pays to get USDC into their Moodeng wallet: topping up rupiah,
// buying the USDC, and the exchange's fee to send it out on Base. (Cashing out to a bank afterwards
// isn't part of repaying, so it's left out.) Checked 2026-09-30 against each exchange's own pages:
// - Tokocrypto: bank/VA deposit covered by Tokocrypto, QRIS/e-wallet 2%; buy USDC/IDR 0.2222% all-in
//   (support.tokocrypto.com fee details); Base withdrawal 0.2 USDC, min 3 (tokocrypto.com/en/fees/newschedule).
// - Reku: bank/VA deposit free, QRIS 0.7%, e-wallet 1.665%; Lightning-mode buy free + 0.0111% CFX;
//   Base withdrawal 0.5 USDC, min 2, plus 0.042 when confirming by SMS (reku.id/fees/crypto).
// - Pintu: rupiah deposit free; no trading commission (its quoted price includes the spread); Base
//   withdrawal 1 USDC (pintu.co.id/en/limit-and-fees).
// - Indodax: BCA transfer free (min Rp100k), virtual accounts Rp1,665–3,330; buy with IDR ~0.21% all-in;
//   Base withdrawal 1.06 USDC — Indodax only shows this in its app (read there on 2026-09-30).
// feeLabel is the rounded fee on a typical ~$20 repayment, shown in the source's tag; buyRate and
// withdrawUsdc drive the "buy about $X" figure, which uses the borrower's real shortfall.
type SourceFeeBreakdown = {
   feeLabel: string;
   buyRate: number;
   withdrawUsdc: number;
   depositTip: string | null;
};

const SOURCE_FEE_BREAKDOWN: Partial<Record<FundSourceId, SourceFeeBreakdown>> = {
   tokocrypto: {
      feeLabel: '~$0.25',
      buyRate: 0.002222,
      withdrawUsdc: 0.2,
      depositTip: 'Top up by bank transfer — QRIS or e-wallet adds 2%.'
   },
   reku: {
      feeLabel: '~$0.50',
      buyRate: 0.000111,
      withdrawUsdc: 0.5,
      depositTip: 'Top up by bank transfer — QRIS adds 0.7%, e-wallet 1.7%.'
   },
   pintu: { feeLabel: '~$1', buyRate: 0, withdrawUsdc: 1, depositTip: null },
   indodax: {
      feeLabel: '~$1',
      buyRate: 0.0021,
      withdrawUsdc: 1.06,
      depositTip: 'Top up by BCA transfer — virtual accounts add Rp1,665 or more.'
   }
};

// How much USDC to buy so `amount` still lands after fees: the amount, the flat send fee, and the
// buy fee on top, rounded UP to the next 10 cents so the borrower never ends up a few cents short.
const getAmountToBuy = (breakdown: SourceFeeBreakdown, amount: number) =>
   Math.ceil((amount + breakdown.withdrawUsdc) * (1 + breakdown.buyRate) * 10) / 10;

// Big logos for the step-by-step repay's app tiles (GCrypto lives inside GCash, so it shows GCash's).
const TILE_LOGO_SRC: Partial<Record<FundSourceId, string>> = {
   gcrypto: '/bank-logos/gcash.webp',
   pdax: '/bank-logos/pdax.webp',
   coinsph: '/bank-logos/coinsph.webp'
};

// Real app icons (from each exchange's App Store listing) for the Indonesian sources.
const SOURCE_LOGO_SRC: Partial<Record<FundSourceId, string>> = {
   reku: '/icons/exchanges/reku.png',
   tokocrypto: '/icons/exchanges/tokocrypto.png',
   indodax: '/icons/exchanges/indodax.png',
   pintu: '/icons/exchanges/pintu.png'
};

// Only the free/not-free distinction is shown to users now (0 = free, anything else = a small
// fee). The exact cents are no longer displayed — they vary and the exchange shows the real
// figure at withdrawal — but the values are kept here as the free-vs-small-fee signal.
const FUND_SOURCE_FEES: Record<FundSourceId, number | null> = {
   moneybees: null,
   coinsph: null,
   gcrypto: 0.08,
   pdax: 0.08,
   binance: 0.2,
   reku: 0.5,
   tokocrypto: 0.2,
   indodax: 1.06,
   pintu: 1
};

// Short pitch shown under the hero (primary) source so the recommendation explains itself.
// Only the hero's subtitle is ever rendered (PDAX or Coins.ph, or Reku for Indonesian borrowers);
// the moneybees entry is unused, kept from before it left the hero slot.
const SOURCE_SUBTITLE: Partial<Record<FundSourceId, string>> = {
   coinsph: 'Recommended · lowest fees · buy USDC with PHP, cash out to bank or GCash',
   pdax: 'Recommended · buy USDC with PHP, cash out to bank, GCash or Maya',
   moneybees: "External option · you follow Moneybees' own process",
   tokocrypto: 'Recommended · top up by bank transfer (QRIS/e-wallet cost 2%)'
};

// Step-by-step path shown to the user. The exchanges are self-service apps; Moneybees is an
// external OTC service with no Moodeng integration — users drive Moneybees' own process
// directly from moneybees.ph.
const FUND_SOURCE_PATHS: Record<FundSourceId, string> = {
   moneybees: 'Visit moneybees.ph → follow their own process → share your wallet address → pay only after they confirm',
   coinsph: 'Transfer → Send Crypto → USDC → External Wallet → paste address → Base network → confirm',
   gcrypto: 'GCash → GCrypto → Top Up pesos → Trade → Buy USDC (Base) → Send → paste address → MAX',
   pdax: 'Wallet → USDCBASE → Withdraw → Paste wallet address',
   binance: 'Wallet → Withdraw → USDC → Network: Base → Paste wallet address',
   reku: 'Wallet → USDC → Send → External wallet → Network: Base → paste address → confirm',
   tokocrypto: 'Wallet → Withdraw → Crypto → USDC → Network: Base → paste address → confirm',
   indodax: 'Wallet → USDC → Withdraw → Address → Network: Base → paste address',
   pintu: 'Wallet → USDC → Send → Network: Base → paste address → confirm'
};

const renderSourceLogo = (id: FundSourceId, isSelected = false) => {
   const logoSrc = SOURCE_LOGO_SRC[id];
   if (logoSrc) {
      return <img src={logoSrc} alt="" aria-hidden="true" className="h-[18px] w-[18px] shrink-0 rounded-[5px]" />;
   }
   if (id === 'moneybees') {
      // Yellow hexagon stays readable on both white and purple backgrounds
      return (
         <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
               d="M10 1L17.5 5.25V13.75L10 18L2.5 13.75V5.25L10 1Z"
               fill="#F7B700"
               stroke={isSelected ? 'rgba(255,255,255,0.4)' : '#111'}
               strokeWidth="1.8"
               strokeLinejoin="round"
            />
            <path d="M10 5.5L14 7.75L10 10L6 7.75L10 5.5Z" fill="white" />
            <path d="M6 7.75V11.75L10 14V10L6 7.75Z" fill="#e5a800" />
            <path d="M14 7.75V11.75L10 14V10L14 7.75Z" fill={isSelected ? 'rgba(0,0,0,0.35)' : '#1a1a1a'} />
         </svg>
      );
   }
   if (id === 'gcrypto') {
      return (
         <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="9" cy="10" r="8.5" stroke={isSelected ? 'rgba(255,255,255,0.6)' : '#00AEEF'} strokeWidth="1.5" fill="none" />
            <path
               d="M14 8.5H10V10.5H12.5C12.1 11.8 10.9 12.5 9.5 12.5C7.6 12.5 6 11 6 9C6 7 7.6 5.5 9.5 5.5C10.4 5.5 11.3 5.9 11.9 6.5L13.3 5.1C12.3 4.2 10.9 3.5 9.5 3.5C6.5 3.5 4 6 4 9C4 12 6.5 14.5 9.5 14.5C12.5 14.5 15 12 15 9V8.5H14Z"
               fill={isSelected ? 'white' : '#0050A0'}
            />
         </svg>
      );
   }
   if (id === 'pdax') {
      return (
         <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            {!isSelected && <circle cx="10" cy="10" r="10" fill="#1B2A4A" />}
            <path d="M5 14.5L7.8 5.5H10.2L7.4 14.5H5Z" fill={isSelected ? 'white' : '#00D097'} />
            <path d="M9.8 14.5L12.6 5.5H15L12.2 14.5H9.8Z" fill={isSelected ? 'white' : '#00D097'} />
         </svg>
      );
   }
   if (id === 'coinsph') {
      // Gold ring + blue circle + white C — colors stay distinct on both white and purple backgrounds
      return (
         <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="10" fill="#E9A200" />
            <circle cx="10" cy="10" r="8" fill="#3B60C4" />
            <path d="M13.2 6.2 A5 5 0 1 0 13.2 13.8" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
         </svg>
      );
   }
   if (id === 'binance') {
      // Black circle + yellow BNB diamond mark
      return (
         <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="12" fill="#0B0E11" />
            <path
               fill="#F3BA2F"
               d="m16.624 13.92 2.717 2.716-7.353 7.353-7.352-7.352 2.717-2.717 4.636 4.66 4.635-4.66zm4.637-4.636L24 12l-2.715 2.716L18.568 12l2.693-2.716zm-9.272 0 2.716 2.692-2.717 2.717L9.272 12l2.716-2.715zm-9.273 0L5.41 12l-2.692 2.692L0 12l2.716-2.716zM11.99.01l7.352 7.33-2.717 2.715-4.636-4.636-4.635 4.66-2.717-2.716L11.989.011z"
            />
         </svg>
      );
   }
   return null;
};

const getRemainingAmount = (loan: Loan): number => Math.max(0, toNumber(loan.totalRepaymentAmount) - toNumber(loan.repaidAmount));

const getProgressPercent = (loan: Loan): number => {
   const total = toNumber(loan.totalRepaymentAmount);
   if (total <= 0) return 0;

   return Math.min(100, Math.round((toNumber(loan.repaidAmount) / total) * 100));
};

// The loan is due until the end of its due day in the borrower's zone (src/lib/loanDeadline.ts), so
// the countdown runs to that moment, not to midnight UTC (8 AM Manila on the due day).
const getLoanDeadline = (loan: Loan): Date => getDueDayEnd(loan.dueDate, getLoanTimezone(loan));

const getDueCountdownCopy = (loan: Loan): string => {
   const totalMinutes = Math.round((getLoanDeadline(loan).getTime() - Date.now()) / (1000 * 60));

   if (totalMinutes <= 0) return 'overdue now';

   const days = Math.floor(totalMinutes / (60 * 24));
   const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
   const minutes = totalMinutes % 60;

   if (days > 0) {
      return hours > 0 ? `${days}d ${hours}h left` : `${days}d left`;
   }

   if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m left` : `${hours}h left`;
   }

   return `${minutes}m left`;
};

// The calendar due date, read as stored (midnight UTC), so it never slips a day on a device set west
// of UTC. No clock time: "Due Sep 30" means by the end of Sep 30 where the borrower is.
const getDueDateShortCopy = (loan: Loan): string =>
   parseDateSafely(loan.dueDate).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
   });

const isLoanOverdue = (loan: Loan): boolean => isPastDueDay(loan.dueDate, getLoanTimezone(loan));

const isLoanDueSoon = (loan: Loan): boolean => {
   const totalHours = (getLoanDeadline(loan).getTime() - Date.now()) / (1000 * 60 * 60);
   return totalHours > 0 && totalHours < 24;
};

// Round down to whole cents (with a tiny epsilon so 5.00 stays 5.00 despite float noise).
const floorToCents = (value: number): number => Math.floor(value * 100 + 1e-6) / 100;

const getEstimatedTrustPoints = (loan: Loan, repaymentAmount: number): number => {
   if (repaymentAmount <= 0) return 0;

   const remainingAmount = getRemainingAmount(loan);
   if (remainingAmount <= 0) return 0;

   // Mirrors private.award_repayment_pandesal: only a full, on-time payoff earns points
   // (10). Partial payments and late payoffs earn nothing, so never promise them.
   if (repaymentAmount < remainingAmount - 0.005) return 0;
   if (isLoanOverdue(loan)) return 0;
   return 10;
};

const createPreviewLoan = (overrides: Partial<Loan>): Loan => ({
   id: 'preview-loan-1',
   trackingId: 'PREVIEW-001',
   borrowerWallet: '0x0000000000000000000000000000000000000000',
   lenderWallet: '0x0000000000000000000000000000000000000000',
   borrowerUser: 'preview-borrower',
   lenderUser: 'preview-lender',
   loanAmount: 100,
   repaidAmount: 0,
   totalRepaymentAmount: 120,
   reason: 'Medical appointment',
   loanStatus: 'Lent',
   repaymentStatus: 'Unpaid',
   dueDate: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
   coin: 'USDC',
   hash: [],
   createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
   updatedAt: new Date().toISOString(),
   fundedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
   ...overrides
});

const previewLoans: Loan[] = [
   createPreviewLoan({
      id: 'preview-loan-1',
      trackingId: 'PREVIEW-001',
      reason: 'Medical appointment',
      loanAmount: 100,
      repaidAmount: 0,
      totalRepaymentAmount: 121,
      dueDate: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString()
   }),
   createPreviewLoan({
      id: 'preview-loan-2',
      trackingId: 'PREVIEW-002',
      reason: 'Vaccination bills',
      loanAmount: 100,
      repaidAmount: 40,
      totalRepaymentAmount: 120,
      dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString()
   })
];

const shouldUsePreviewLoans = (search: string, pathname: string): boolean => {
   if (typeof window === 'undefined') return false;

   const isPreviewHost = ['127.0.0.1', 'localhost'].includes(window.location.hostname) || window.location.hostname.endsWith('.vercel.app');
   if (!isPreviewHost) return false;

   if (pathname === '/repay-preview') return true;

   const params = new URLSearchParams(search);
   if (params.get('previewLoans') === '1') {
      window.sessionStorage.setItem('moodeng-repay-preview-loans', '1');
      return true;
   }

   return window.sessionStorage.getItem('moodeng-repay-preview-loans') === '1';
};

function FundedCelebration({ amount }: { amount: number }) {
   const [barWidth, setBarWidth] = useState(0);
   useEffect(() => {
      const raf1 = requestAnimationFrame(() => {
         const raf2 = requestAnimationFrame(() => setBarWidth(100));
         return () => cancelAnimationFrame(raf2);
      });
      return () => cancelAnimationFrame(raf1);
   }, []);

   return (
      <div className="px-4 py-5">
         <div className="mb-3.5 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dcfce7] dark:bg-[#052e16]">
               <Check className="h-5 w-5 text-[#16a34a]" aria-hidden="true" />
            </span>
            <div>
               <p className="text-[15px] font-semibold text-[#14532d] dark:text-[#86efac]">Received ${formatCurrency(amount)} USDC</p>
               <p className="text-[12px] text-[#6b6090] dark:text-[#a095c8]">Taking you to pay now…</p>
            </div>
         </div>
         <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#dcfce7] dark:bg-[#052e16]">
            <div className="h-full rounded-full bg-[#16a34a]" style={{ width: `${barWidth}%`, transition: 'width 1.8s ease-in-out' }} />
         </div>
      </div>
   );
}

export default function Repay() {
   const navigate = useNavigate();
   const location = useLocation();
   const dispatch = useDispatch<AppDispatch>();
   const { showToast, showToastByConfig } = useToast();
   const { payUsdc } = useWallet();
   const account = useAccount();
   // Openfort-locked borrowers send via their embedded wallet; everyone else keeps wallet/Base.
   const activePaymentMethod = useActivePaymentMethod();
   const { status: connectStatus } = useConnect();
   const { switchChainAsync } = useSwitchChain();

   const user = useSelector((state: RootState) => state.auth.user);
   // Read the store directly after the repay awaits: updateLoanStatus refetches the user (with any
   // new credit limit) inside the thunk, and the selector closure above is stale by then.
   const reduxStore = useStore<RootState>();
   const loans = useSelector((state: RootState) => state.loans.loans.gloans);
   const usePreviewLoans = shouldUsePreviewLoans(location.search, location.pathname);

   // A Base-Account borrower inside Facebook's in-app browser can't complete the Base wallet's
   // popup + passkey handshake, so repayment dead-spinners on "Sending payment…". Detect it and
   // swap the form for an escape hatch that opens the repay page in a real browser. Only Base
   // users are affected — embedded (Openfort) wallets work inside Facebook. Skipped in preview.
   const inApp = useMemo(() => detectInAppBrowser(), []);
   const blockForInAppBase = shouldBlockRepayForInAppBrowser({
      info: inApp,
      isBaseWallet: isBaseWalletProvider(user?.walletProvider),
      isPreview: usePreviewLoans
   });
   const { allowed: geoAllowed, countryCode: geoCountryCode, loading: geoLoading } = useGeoCheck(usePreviewLoans);
   const { locale } = useLocalization();
   // Preview mode skips the geo lookup; ?country=ID (or PH, US, …) stands in for it.
   const previewCountry = usePreviewLoans ? (new URLSearchParams(location.search).get('country')?.toUpperCase() ?? null) : null;
   // Geo no longer gates the page — anyone (including Filipinos abroad) can repay. The local
   // rails (Coins.ph, Moneybees, GCrypto, PDAX) are always shown; `inPhilippines` only decides
   // whether Binance is ALSO offered (it's excluded specifically for users detected IN the
   // Philippines, where Binance doesn't operate — see the fundSources comment above). We don't
   // assume a location while the check is still resolving — the source list shows a loader
   // until `geoLoading` clears.
   const inPhilippines = previewCountry ? previewCountry === 'PH' : geoAllowed;
   // Indonesian borrowers get Indonesian exchanges up front (see the fundSources comment). The app
   // language counts too, so an Indonesian on a VPN or abroad still sees their own exchanges.
   const inIndonesia = (previewCountry ?? geoCountryCode) === 'ID' || locale === 'id';
   const heroSourceId = inIndonesia ? INDONESIA_HERO_SOURCE_ID : HERO_SOURCE_ID;
   // Indonesia-track borrowers (users.market = 'ID') pay from Walt straight to Moodeng (WaltRepaySteps); the
   // exchanges stay under "Cara lain". Preview: ?market=id.
   const { isIndo: isIdTrackUser } = useIdOnboarding();
   const isWaltRepay = usePreviewLoans ? new URLSearchParams(location.search).get('market') === 'id' : isIdTrackUser;
   const [showOtherWays, setShowOtherWays] = useState(false);
   // The 5-minute job recorded their Walt payment: reload the loans so the page shows it paid.
   const refreshAfterWaltRepay = useCallback(() => {
      if (user?.id) void dispatch(getUserLoans({ userId: user.id }));
   }, [dispatch, user?.id]);
   const repayLoans = usePreviewLoans ? previewLoans : loans;
   const { hasFetched: hasCheckedRepayLoans, isLoading: isCheckingRepayLoans } = useLoanData({
      userId: user.id,
      enabled: Boolean(user.id) && !usePreviewLoans
   });

   const activeLoans = useMemo(
      () =>
         repayLoans
            // gloans also holds loans this user funded as lender — only their own borrowed loans are repayable
            .filter((loan) => usePreviewLoans || loan.borrowerUser === user.id)
            .filter((loan) => loan.loanStatus === 'Lent' && loan.repaymentStatus !== 'Paid' && getRemainingAmount(loan) > 0)
            .sort((a, b) => parseDateSafely(a.dueDate).getTime() - parseDateSafely(b.dueDate).getTime()),
      [repayLoans, usePreviewLoans, user.id]
   );

   const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
   const [repaymentAmount, setRepaymentAmount] = useState('');
   const [isProcessing, setIsProcessing] = useState(false);
   const [completion, setCompletion] = useState<{
      reason: string;
      paidAmount: number;
      coin: string;
      trustPoints: number;
      creditLevelUp?: { toLevel: number; newLimit: number } | null;
   } | null>(() =>
      // Preview: ?paid=1 shows the "you're paid" screen (screenshots / design review).
      usePreviewLoans && new URLSearchParams(location.search).get('paid') === '1'
         ? { reason: 'Medical appointment', paidAmount: 121, coin: 'USDC', trustPoints: 10, creditLevelUp: { toLevel: 3, newLimit: 40 } }
         : null
   );
   const [showCompletionDetails, setShowCompletionDetails] = useState(false);
   // Acknowledge a partial payment inline (the loan stays active). Shown until the borrower's
   // next interaction so there's no timer to leak; full payoffs use `completion` instead.
   const [partialPaid, setPartialPaid] = useState<{ paidAmount: number; remaining: number; coin: string } | null>(null);
   // The on-chain transfer hash, set the moment Transfer resolves. Drives the "Sending" →
   // "Confirming" copy on the in-card processing overlay and the explorer link.
   const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);
   // Top-of-screen, non-custodial "add funds" helper, surfaced only when the borrower is
   // short on USDC. It shows their own Base Account address and watches their public
   // on-chain balance — Moodeng never receives or forwards the money.
   const [showAddFunds, setShowAddFunds] = useState(true);
   const [payLess, setPayLess] = useState(false);
   const { value: phpRate } = useUsdcRate('php');
   // Filipinos think in pesos: show the peso amount big and the USDC small.
   const showPesos = !inIndonesia;
   const toPesos = (usd: number) => `₱${Math.round(Math.max(0, usd) * phpRate).toLocaleString('en-PH')}`;
   // Preview: ?step=source|send|pay opens that step (screenshots / design review).
   const [wizardStep, setWizardStep] = useState<WizardStep>(() => {
      const fromUrl = usePreviewLoans ? new URLSearchParams(location.search).get('step') : null;
      return (WIZARD_STEPS as readonly string[]).includes(fromUrl ?? '') ? (fromUrl as WizardStep) : 'amount';
   });
   const [fundSource, setFundSource] = useState<FundSourceId>(heroSourceId);
   const [showCoinsPaused, setShowCoinsPaused] = useState(false);
   const selectFundSource = (id: FundSourceId) => {
      if (isPausedSource(id)) {
         setShowCoinsPaused(true);
         return;
      }
      setShowCoinsPaused(false);
      setFundSource(id);
   };
   const [copiedAddress, setCopiedAddress] = useState(false);
   const [showHowToVideo, setShowHowToVideo] = useState(false);
   // The two recommended sources (Moneybees, Coins.ph) show by default; GCrypto/PDAX stay
   // collapsed so a first-timer isn't asked to evaluate four exchanges at once.
   const [showMoreSources, setShowMoreSources] = useState(false);
   // Records which loan crossed short→funded so we can show an explicit "money arrived"
   // confirmation. Tying it to the loan id (rather than a bare boolean) means it clears
   // itself on loan switch and never flags borrowers who already had enough on arrival.
   // In preview mode, ?funded=1 mocks a fully-funded wallet so the repay-ready state is visible.
   const previewFunded = usePreviewLoans && new URLSearchParams(location.search).get('funded') === '1';
   const previewArriving = usePreviewLoans && new URLSearchParams(location.search).get('arriving') === '1';
   const previewEmpty = usePreviewLoans && new URLSearchParams(location.search).get('empty') === '1';
   // Tracks when the borrower was previously short so we can detect the short→funded transition
   // and show a brief "funds received" celebration before revealing the repay section.
   // shortLoanIdRef pins the detection to a specific loan so switching to a different loan
   // (one they already have enough for) doesn't misfire the celebration.
   const wasShortRef = useRef(false);
   const shortLoanIdRef = useRef<string | null>(null);
   const [justFunded, setJustFunded] = useState<number | null>(null);
   const effectiveJustFunded = previewArriving ? 121 : justFunded;
   const activeSource = fundSources.find((source) => source.id === fundSource) ?? fundSources[0];

   // Fee tag next to each source's name: the rounded fee for sources we have figures for, otherwise
   // the generic "Small fee".
   const getFeeTagLabel = (id: FundSourceId) => {
      const breakdown = SOURCE_FEE_BREAKDOWN[id];
      return breakdown ? `${breakdown.feeLabel} fee` : 'Small fee';
   };

   // Compact source button used for Coins.ph and the "Other options" exchanges.
   // Fee tag sits next to the label; selection is conveyed by border + fill alone (no checkmark).
   const renderSourcePill = (source: (typeof fundSources)[number]) => {
      const isSelected = fundSource === source.id;
      const sourceFee = FUND_SOURCE_FEES[source.id];
      const paused = isPausedSource(source.id);

      return (
         <button
            type="button"
            key={source.id}
            onClick={() => selectFundSource(source.id)}
            aria-pressed={isSelected}
            aria-disabled={paused || undefined}
            style={{ touchAction: 'manipulation' }}
            className={`flex min-h-[44px] w-full cursor-pointer items-center gap-2 rounded-2xl px-3.5 py-1.5 text-md-b2 font-semibold transition active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-300 ${paused ? 'opacity-50 grayscale ' : ''}${
               isSelected
                  ? 'border-2 border-[#6c3fe0] bg-[#f3effe] text-[#1a1240] dark:bg-[#2a1740] dark:text-white'
                  : 'border border-[#e9e3f8] bg-white text-[#6b6090] hover:border-md-primary-300 dark:border-[#3d2a60] dark:bg-[#1e1535] dark:text-[#a095c8]'
            }`}
         >
            {renderSourceLogo(source.id, false)}
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
               {source.label}
               {paused ? (
                  <span className="whitespace-nowrap rounded-full bg-[#ede9f8] px-1.5 py-0.5 text-[10px] font-bold text-[#6b6090] dark:bg-[#2a1f4f] dark:text-[#a095c8]">
                     Paused
                  </span>
               ) : sourceFee === 0 ? (
                  <span className="rounded-full bg-[#dcfce7] px-1.5 py-0.5 text-[10px] font-bold text-[#16a34a] dark:bg-[#052e16]">
                     Free
                  </span>
               ) : (
                  <span className="whitespace-nowrap rounded-full bg-[#ede9f8] px-1.5 py-0.5 text-[10px] font-bold text-[#6b6090] dark:bg-[#2a1f4f] dark:text-[#a095c8]">
                     {getFeeTagLabel(source.id)}
                  </span>
               )}
            </span>
         </button>
      );
   };

   // Prominent, full-width primary source — HERO_SOURCE_ID (Coins.ph, or PDAX while it's suspended), for everyone.
   // Fee badge sits inline with the name; selection is conveyed by border + fill alone (no checkmark).
   const renderHeroSource = (source: (typeof fundSources)[number]) => {
      const isSelected = fundSource === source.id;
      const sourceFee = FUND_SOURCE_FEES[source.id];
      const subtitle = SOURCE_SUBTITLE[source.id];

      return (
         <button
            type="button"
            onClick={() => selectFundSource(source.id)}
            aria-pressed={isSelected}
            style={{ touchAction: 'manipulation' }}
            className={`flex w-full cursor-pointer items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-300 ${
               isSelected
                  ? 'border-2 border-[#6c3fe0] bg-[#f3effe] dark:bg-[#2a1740]'
                  : 'border border-[#e9e3f8] bg-white hover:border-md-primary-300 dark:border-[#3d2a60] dark:bg-[#1e1535]'
            }`}
         >
            {renderSourceLogo(source.id, false)}
            <span className="min-w-0 flex-1">
               <span className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-[#1a1240] dark:text-white">{source.label}</span>
                  {sourceFee === 0 ? (
                     <span className="rounded-full bg-[#dcfce7] px-1.5 py-0.5 text-[10px] font-bold text-[#16a34a]">Free</span>
                  ) : (
                     <span className="whitespace-nowrap rounded-full bg-[#ede9f8] px-1.5 py-0.5 text-[10px] font-bold text-[#6b6090]">
                        {getFeeTagLabel(source.id)}
                     </span>
                  )}
               </span>
               {subtitle ? <span className="block text-[11px] font-medium text-[#6c3fe0]">{subtitle}</span> : null}
            </span>
         </button>
      );
   };
   const amountInputRef = useRef<HTMLInputElement>(null);
   // Synchronous re-entrancy guard. `isProcessing` is React state, so on a fast double-tap
   // both calls read the stale `false` and each fires its own Transfer — opening a second
   // Base Account signing popup that errors ("Something went wrong") since the request is
   // already in flight. A ref flips immediately, so the second tap is dropped.
   const repayInFlightRef = useRef(false);
   // Set when the borrower taps "Cancel" on the pre-broadcast overlay so they aren't stranded
   // on the spinner (e.g. they closed the wallet popup). The in-flight promise can't be aborted,
   // so this guards the full-screen success takeover if it resolves late; a payment that did
   // broadcast is still recorded (and left to the reconciler if the DB write is behind).
   const cancelledRef = useRef(false);

   useEffect(() => {
      if (activeLoans.length === 0) {
         setSelectedLoanId(null);
         return;
      }

      setSelectedLoanId((currentId) => (currentId && activeLoans.some((loan) => loan.id === currentId) ? currentId : activeLoans[0].id));
   }, [activeLoans]);

   // Focus the amount field when the active loan changes so the borrower can type straight
   // away. On iOS a programmatic focus highlights the field without forcing the keyboard up,
   // so this speeds up the common case without hijacking the viewport.
   useEffect(() => {
      if (selectedLoanId && !isProcessing) {
         amountInputRef.current?.focus();
      }
      // Only re-run when the selected loan changes, not on every processing toggle.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [selectedLoanId]);

   const selectedLoan = activeLoans.find((loan) => loan.id === selectedLoanId) ?? activeLoans[0];
   const selectedRemaining = selectedLoan ? getRemainingAmount(selectedLoan) : 0;
   // The remaining balance is displayed rounded to cents, so validate against the rounded
   // value. Otherwise a remaining of e.g. 0.469 shows as "$0.47" but rejects a 0.47 "Full"
   // payment as exceeding the maximum, leaving the borrower unable to clear the loan.
   const selectedRemainingRounded = Math.round(selectedRemaining * 100) / 100;
   // Indonesia rupiah peg: they owe fixed rupiah; the USD left (selectedRemaining) is the server's
   // price for it today (total_repayment_amount is re-priced by the server).
   const selectedRemainingIdr = remainingIdr(selectedLoan);
   const parsedRepaymentAmount = toNumber(repaymentAmount);
   const repaySliderPercent =
      selectedRemainingRounded > 0
         ? Math.min(100, (Math.min(parsedRepaymentAmount, selectedRemainingRounded) / selectedRemainingRounded) * 100)
         : 0;
   const validPreviewPayment = selectedLoan && parsedRepaymentAmount > 0 ? Math.min(parsedRepaymentAmount, selectedRemainingRounded) : 0;
   const estimatedTrustPoints = selectedLoan ? getEstimatedTrustPoints(selectedLoan, validPreviewPayment) : 0;
   const selectedQuickFraction =
      selectedLoan && validPreviewPayment > 0
         ? quickRepaymentFractions.find((option) => Math.abs(validPreviewPayment - selectedRemaining * option.value) < 0.01)?.value
         : null;
   const amountError =
      selectedLoan && repaymentAmount
         ? parsedRepaymentAmount <= 0
            ? 'Enter an amount greater than 0.'
            : parsedRepaymentAmount > selectedRemainingRounded
              ? `Maximum repayment is $${formatCurrency(selectedRemainingRounded)}.`
              : null
         : null;

   const paymentCtaAmount = repaymentAmount ? `$${formatCurrency(parsedRepaymentAmount)}` : 'loan';
   // Surface the figure on the button itself so the borrower confirms the amount at the
   // moment of commitment; fall back to a plain label when there's no valid amount yet.
   const hasValidPayAmount = Boolean(repaymentAmount) && !amountError && parsedRepaymentAmount > 0;
   const payNowLabel = hasValidPayAmount ? `Pay $${formatCurrency(parsedRepaymentAmount)}` : 'Pay Now';
   const explorerBaseUrl = account.chain?.blockExplorers?.default?.url;
   const explorerTxUrl = pendingTxHash && explorerBaseUrl ? `${explorerBaseUrl}/tx/${pendingTxHash}` : null;
   // Pay Now is a single intent: it requires a valid amount whether or not the wallet is
   // connected. If disconnected, tapping it connects first and then auto-resumes the payment.
   const isRepayDisabled =
      isProcessing || connectStatus === 'pending' || !repaymentAmount || Boolean(amountError) || parsedRepaymentAmount <= 0;
   const baseWalletLock = getBaseWalletLockStatus(user);
   const isWorldIdVerified = isUserVerified(user);
   const { modal: verifyModal } = useVerifyYourself('repay');
   const journey = useVerificationJourney();
   const hasCompletedBaseWalletSetup = baseWalletLock.isConfirmedBorrowerWallet;
   const emptyRepayState = !selectedLoan
      ? !isWorldIdVerified
         ? // Not verified: their next step on the way to a first loan (wallet → Messenger → bio → call →
           // apply, with the ID check at the end of the request) — same as everywhere else.
           {
              actionLabel: journey.cta,
              body: `${journey.body} Repayments will show here after a moo-lender funds your first loan.`,
              onAction: journey.go,
              title: journey.onboarding && journey.step ? `Step ${journey.step} of 3: ${journey.title}` : journey.title
           }
         : !hasCompletedBaseWalletSetup
           ? {
                actionLabel: 'Add Wallet',
                body: 'You are verified. Set up your Instant Wallet (or connect a Base Account) so loans and repayments can stay tied to your Moodeng account.',
                onAction: () => navigate('/onboarding/wallet', { state: { returnTo: 'repay' } }),
                title: 'Add a wallet to borrow'
             }
           : {
                actionLabel: 'Request a loan',
                body: 'Your repayment activity will appear here once a moo-lender funds your first loan.',
                onAction: () => navigate('/request-board', { state: { openLoanRequest: true } }),
                title: 'No repayments yet'
             }
      : null;

   const handleSelectLoan = (loanId: string, e: React.MouseEvent<HTMLButtonElement>) => {
      (e.currentTarget as HTMLButtonElement).blur();
      setSelectedLoanId(loanId);
      setWizardStep('amount');
      setPayLess(false);
      setRepaymentAmount('');
      setCompletion(null);
      setPartialPaid(null);
   };

   const setQuickAmount = (fraction: number) => {
      if (!selectedLoan) return;
      setRepaymentAmount(formatCurrency(getRemainingAmount(selectedLoan) * fraction));
      setPartialPaid(null);
   };

   const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
      setRepaymentAmount(event.target.value);
      setPartialPaid(null);
   };

   // The Base Account a top-up should land in. Prefer the locked Base wallet (repayments must
   // come from it) and fall back to whatever is connected. In the local/preview host there's
   // no real wallet, so use a sample address purely so the add-funds card can be previewed.
   const PREVIEW_ADDRESS = '0x1234aBCd5678Ef901234abcd5678ef901234ABcd';
   const repayWalletAddress = baseWalletLock.address ?? account.address ?? (usePreviewLoans ? PREVIEW_ADDRESS : '');

   const handleCopyAddress = useCallback(async () => {
      if (!repayWalletAddress) return;

      const markCopied = () => {
         setCopiedAddress(true);
         window.setTimeout(() => setCopiedAddress(false), 1800);
      };

      // The async Clipboard API only works in a secure, focused context — it throws inside
      // some in-app browsers and iframes. Fall back to a hidden <textarea> + execCommand so
      // copy still succeeds there before we ever surface an error.
      try {
         if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(repayWalletAddress);
            markCopied();
            return;
         }
      } catch {
         // fall through to the legacy path
      }

      try {
         const textarea = document.createElement('textarea');
         textarea.value = repayWalletAddress;
         textarea.setAttribute('readonly', '');
         textarea.style.position = 'fixed';
         textarea.style.opacity = '0';
         document.body.appendChild(textarea);
         textarea.select();
         const ok = document.execCommand('copy');
         document.body.removeChild(textarea);
         if (ok) {
            markCopied();
            return;
         }
      } catch {
         // fall through to the error toast
      }

      showToast(TOAST_TYPES.ERROR, 'Copy failed', 'Could not copy your wallet address. Copy it manually.', undefined, undefined);
   }, [repayWalletAddress, showToast]);

   // Watch the borrower's own Base Account USDC balance so we can tell them when their
   // top-up has landed. This reads a public on-chain balance — it is not custody. Only poll
   // while the funding helper is open to avoid hammering the RPC for everyone.
   const { data: usdcBalanceRaw, refetch: refetchBalance } = useReadContract({
      abi: erc20Abi,
      address: BASE_USDC_ADDRESS,
      functionName: 'balanceOf',
      args: repayWalletAddress ? [repayWalletAddress as `0x${string}`] : undefined,
      chainId: ALLOWED_CHAIN_ID,
      query: {
         enabled: Boolean(repayWalletAddress) && Boolean(selectedLoan) && !usePreviewLoans,
         refetchInterval: 30000 // backstop if WebSocket misses an event
      }
   });
   // USDC has 6 decimals. In the preview host, mock the balance: ?funded=1 gives enough to
   // cover the loan (triggers the green handoff card); default shows a partial balance so the
   // add-funds steps and progress bar are visible without a real wallet. ?empty=1 mocks a $0 wallet.
   const usdcBalance = usePreviewLoans
      ? previewFunded
         ? 130
         : previewEmpty
           ? 0
           : 18.4
      : typeof usdcBalanceRaw === 'bigint'
        ? Number(usdcBalanceRaw) / 1e6
        : null;
   const fundingShortfall = usdcBalance !== null ? Math.max(0, Math.round((selectedRemaining - usdcBalance) * 100) / 100) : null;
   const hasEnoughToRepay = usdcBalance !== null && usdcBalance >= selectedRemaining - 0.005;
   const isShortOnFunds = fundingShortfall !== null && fundingShortfall > 0;
   const hasPartialFunds = usdcBalance !== null && usdcBalance > 0 && isShortOnFunds;
   // Under a cent counts as empty: exchanges leave dust like 0.0047 behind after a send.
   const isWalletEmpty = usdcBalance !== null && usdcBalance < 0.01 && isShortOnFunds;
   // True only for the loan that just crossed short→funded — drives the success handoff.
   // Subscribe to incoming USDC Transfer events on Base so the UI updates within ~1-2s
   // of the deposit landing — no polling delay. Only active while short on funds.
   useWatchContractEvent({
      address: BASE_USDC_ADDRESS,
      abi: erc20Abi,
      eventName: 'Transfer',
      args: repayWalletAddress ? { to: repayWalletAddress as `0x${string}` } : undefined,
      chainId: ALLOWED_CHAIN_ID,
      enabled: Boolean(repayWalletAddress) && Boolean(selectedLoan) && !usePreviewLoans && isShortOnFunds,
      onLogs: () => {
         refetchBalance();
      }
   });

   // Keep the selected source valid once geo resolves: Binance is excluded specifically for
   // users detected IN the Philippines (Binance doesn't operate there), so fall back to the
   // recommended local rail if it was selected. Abroad, we do NOT force a switch to Binance —
   // Coins.ph and the other local rails work fine for a Filipino traveling or living outside
   // the Philippines, so the user's own default choice is left alone. Skipped during loading
   // so we don't flip away from the default before geo resolves.
   useEffect(() => {
      if (geoLoading) return;
      if (geoAllowed) {
         setFundSource((current) => (current === 'binance' ? heroSourceId : current));
      }
   }, [geoAllowed, geoLoading, heroSourceId]);

   // The Indonesian layout is only known once geo resolves (or the language changes). Indonesian
   // and non-Indonesian borrowers are offered different sources, so a selection that isn't offered
   // in the current layout falls back to its hero; a source still on offer is left alone.
   useEffect(() => {
      setFundSource((current) => (INDONESIA_SOURCE_IDS.includes(current) === inIndonesia ? current : heroSourceId));
   }, [heroSourceId, inIndonesia]);

   // When we learn the borrower doesn't hold enough USDC to repay, surface the add-funds
   // helper automatically so the next step is visible without hunting for it. Runs only
   // when the shortfall state flips or the loan changes, so a manual close stays closed.
   useEffect(() => {
      if (isShortOnFunds) {
         wasShortRef.current = true;
         shortLoanIdRef.current = selectedLoanId;
         setShowAddFunds(true);
      } else if (wasShortRef.current && shortLoanIdRef.current === selectedLoanId && hasEnoughToRepay && usdcBalance !== null) {
         // Same loan went short→funded: balance arrived — show celebration
         wasShortRef.current = false;
         shortLoanIdRef.current = null;
         setJustFunded(usdcBalance);
         const t = setTimeout(() => setJustFunded(null), 2000);
         return () => clearTimeout(t);
      } else if (wasShortRef.current && shortLoanIdRef.current !== selectedLoanId) {
         // User switched to a different loan — reset without celebrating
         wasShortRef.current = false;
         shortLoanIdRef.current = null;
      }
   }, [isShortOnFunds, hasEnoughToRepay, usdcBalance, selectedLoanId]);

   // Once the borrower's top-up lands, pre-fill the amount so the bottom nav Pay button
   // arms itself — they just tap once. Full amount when fully funded; partial balance when
   // only some USDC has arrived. Only when the add-funds helper is open and they haven't
   // already typed an amount.
   useEffect(() => {
      // The step-by-step repay starts at "Full" instead (below).
      if (!isWaltRepay) return;
      if (!showAddFunds || repaymentAmount) return;
      if (hasEnoughToRepay) {
         setRepaymentAmount(formatCurrency(selectedRemaining));
      } else if (hasPartialFunds && usdcBalance !== null) {
         // Round down: toFixed(2) can round a 4.996 balance up to 5.00, which exceeds it.
         setRepaymentAmount(formatCurrency(floorToCents(usdcBalance)));
      }
   }, [isWaltRepay, showAddFunds, hasEnoughToRepay, hasPartialFunds, usdcBalance, repaymentAmount, selectedRemaining]);

   // After a part payment, the amount resets to what's still owed (ready for "Pay the rest").
   useEffect(() => {
      if (!isWaltRepay && partialPaid) setRepaymentAmount(formatCurrency(partialPaid.remaining));
   }, [isWaltRepay, partialPaid]);

   // Step-by-step repay: each loan starts at its full amount ("Full" chip), which they can lower —
   // unless they were part-way through it in the last day (left for GCash/PDAX, page reloaded):
   // then it picks up on the same step, app and amount.
   const [restoredLoanId, setRestoredLoanId] = useState<string | null>(null);
   useEffect(() => {
      if (isWaltRepay || !selectedLoanId || selectedRemaining <= 0) return;
      const urlStep = usePreviewLoans && new URLSearchParams(location.search).get('step');
      const saved = urlStep ? null : readStep<RepayMemory>(repayMemoryKey(selectedLoanId));
      if (saved && (WIZARD_STEPS as readonly string[]).includes(saved.step)) {
         setWizardStep(saved.step);
         if (fundSources.some((source) => source.id === saved.source) && !isPausedSource(saved.source)) setFundSource(saved.source);
         setRepaymentAmount(saved.amount || formatCurrency(selectedRemaining));
      } else {
         setRepaymentAmount(formatCurrency(selectedRemaining));
      }
      setRestoredLoanId(selectedLoanId);
      // Only when the loan changes, not as they edit the amount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [selectedLoanId, isWaltRepay]);

   // Save where they are (after the restore above has run for this loan).
   useEffect(() => {
      if (isWaltRepay || !selectedLoanId || restoredLoanId !== selectedLoanId) return;
      writeStep<RepayMemory>(repayMemoryKey(selectedLoanId), { step: wizardStep, source: fundSource, amount: repaymentAmount });
   }, [isWaltRepay, selectedLoanId, restoredLoanId, wizardStep, fundSource, repaymentAmount]);

   // Paid in full: forget the saved step and the app's card.
   useEffect(() => {
      if (!completion || !selectedLoanId) return;
      clearStep(repayMemoryKey(selectedLoanId));
      clearStep(repayGuideMemoryKey(selectedLoanId, fundSource));
   }, [completion, selectedLoanId, fundSource]);

   // One event per step, so PostHog shows where people stop. `funded` = already had the USDC (one-tap Pay).
   const wizardFunded =
      usdcBalance !== null && parsedRepaymentAmount > 0 && usdcBalance + 0.005 >= Math.min(parsedRepaymentAmount, selectedRemainingRounded);
   useEffect(() => {
      if (isWaltRepay || !selectedLoanId || usdcBalance === null) return;
      trackRepay('repay_step', { step: wizardStep, funded: wizardFunded, source: wizardStep === 'amount' ? null : fundSource });
      // Once per step change (not on every balance tick).
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [wizardStep, selectedLoanId, usdcBalance === null]);

   const handleRepay = useCallback(async () => {
      if (!selectedLoan || isProcessing || repayInFlightRef.current) {
         return;
      }
      // A repayment already approved for this loan but not yet recorded: paying again would overpay.
      if (hasPendingPaymentForLoan(selectedLoan.id)) {
         showToast(
            TOAST_TYPES.INFO,
            'Payment still confirming',
            'Your last payment for this loan is still confirming. It will update here shortly. Please don’t pay again.'
         );
         return;
      }

      // In Facebook's in-app browser a Base-Account borrower can't complete the wallet handshake,
      // so never start the (doomed) flow — the screen shows RepayInAppBrowserGate instead. This also
      // covers the global bottom-nav Pay button, which is registered before that gate's early return.
      if (blockForInAppBase) {
         return;
      }

      // The borrower must have finished Base wallet setup. That wallet is their identity and
      // the address lenders send loans TO (the receiving wallet) — it is NOT enforced as the
      // paying wallet, because Base Pay lets them sign in with any Base Account and only reveals
      // the payer after the fact. See [[base-pay-migration]].
      if (!baseWalletLock.hasStoredWallet) {
         setCompletion(null);
         navigate('/onboarding/wallet', { state: { returnTo: 'repay' } });
         return;
      }

      if (amountError || parsedRepaymentAmount <= 0) {
         return;
      }

      // Already connected a wallet → pay from it in one signature. Otherwise Base Pay: a single
      // popup that fuses Base Account sign-in and the USDC send, so repayment is one tap even
      // from a cold start. An Openfort-locked borrower sends gaslessly from their embedded wallet.
      const method: PaymentMethod = activePaymentMethod;

      // Not enough USDC in the Moodeng wallet: say so plainly and open the add-funds steps,
      // instead of letting the wallet popup fail with a vague "insufficient funds". Skipped when
      // a different wagmi wallet is connected (its balance isn't the one we read) and while the
      // balance is still loading (null).
      const payerIsMoodengWallet = method !== 'wallet' || areWalletAddressesEqual(account.address, repayWalletAddress);
      if (payerIsMoodengWallet && usdcBalance !== null && usdcBalance + 0.005 < parsedRepaymentAmount) {
         const have = usdcBalance < 0.01 ? 0 : usdcBalance;
         showToast(
            TOAST_TYPES.WARNING,
            have === 0 ? 'Your wallet is empty' : 'Not enough in your wallet',
            `Your Moodeng wallet has $${formatCurrency(have)} USDC. Add $${formatCurrency(parsedRepaymentAmount - have)} more first. The steps are on this page.`
         );
         setShowAddFunds(true);
         return;
      }

      // Claimed before the first await, so a quick double-tap can't start a second payment.
      repayInFlightRef.current = true;

      // Only the wagmi path needs the chain guard up front; Base Pay switches to Base itself.
      if (method === 'wallet' && !(await ensureAllowedChain(account.chainId, switchChainAsync))) {
         repayInFlightRef.current = false;
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.NETWORK_REQUIRED));
         return;
      }

      cancelledRef.current = false;
      setIsProcessing(true);

      // Set once the transfer has a hash: from that point on, an error means "money moved but the
      // DB write is behind", which must not be reported as a failed transaction.
      let paidTxHash: string | null = null;

      try {
         // Never transfer more than is actually owed — the input is validated against the
         // rounded balance, so a "Full" payment can be a hair above the true remaining.
         // Round to USDC's 6 decimals so floating-point noise never reaches the transfer
         // as an unparseable string like "0.4699999999998".
         const remaining = getRemainingAmount(selectedLoan);
         const effectiveRepayment = Math.round(Math.min(parsedRepaymentAmount, remaining) * 1e6) / 1e6;
         const newRepaidAmount = toNumber(selectedLoan.repaidAmount) + effectiveRepayment;
         const isFullyRepaid = newRepaidAmount >= toNumber(selectedLoan.totalRepaymentAmount) - 0.005;
         const newRepaymentStatus = isFullyRepaid ? 'Paid' : 'Partial';
         const transferCoin = selectedLoan.coin?.trim() || 'USDC';
         const earnedTrustPoints = getEstimatedTrustPoints(selectedLoan, effectiveRepayment);

         // Preview/demo (localhost or a vercel preview URL): never open a real Base Pay popup or
         // write to the DB against mock loans — simulate the same success UI.
         if (usePreviewLoans) {
            setPendingTxHash('0xpreview');
            await new Promise((resolve) => setTimeout(resolve, 800));
            setRepaymentAmount('');
            if (isFullyRepaid) {
               // Demo the level-up so the celebration is visible in preview/video runs.
               const demoNext = getNextCreditTier(reduxStore.getState().auth.user?.cs || 15);
               setShowCompletionDetails(false);
               setCompletion({
                  reason: selectedLoan.reason || 'your loan',
                  paidAmount: toNumber(selectedLoan.totalRepaymentAmount),
                  coin: transferCoin,
                  trustPoints: earnedTrustPoints,
                  creditLevelUp: { toLevel: getCreditLevelNumber(demoNext), newLimit: demoNext }
               });
            } else {
               const remainingAfter = Math.max(0, toNumber(selectedLoan.totalRepaymentAmount) - newRepaidAmount);
               setPartialPaid({ paidAmount: effectiveRepayment, remaining: remainingAfter, coin: transferCoin });
            }
            return;
         }

         // No lender wallet on file means nowhere to send it: say so instead of a generic failure.
         if (!selectedLoan.lenderWallet?.trim()) {
            showToast(
               TOAST_TYPES.ERROR,
               'Moo-lender wallet missing',
               "We can't find where to send this repayment. Please contact support and we'll sort it out."
            );
            return;
         }

         // Recipient is always the lender's on-file funding wallet — chosen by us, never by the
         // payer's wallet choice — so the lender receives at the address they funded from.
         const outcome = await payUsdc({
            method,
            to: selectedLoan.lenderWallet || '',
            usdAmount: effectiveRepayment.toString(),
            loanId: selectedLoan.id,
            coin: transferCoin,
            // On Base Pay approval (before confirmation): flip the overlay to "Confirming" and arm
            // reconciliation so an approved-but-unconfirmed repayment still records later.
            onSubmitted: (id) => {
               setPendingTxHash(id);
               registerPendingBasePayment({
                  kind: 'repay',
                  id,
                  loanId: selectedLoan.id,
                  userId: user.id,
                  repaidAmount: newRepaidAmount,
                  repaymentStatus: newRepaymentStatus
               });
            },
            // Approved in the wallet after we stopped waiting: still record the repayment.
            onLateWalletHash: (hash) => {
               registerPendingBasePayment({
                  kind: 'repay',
                  id: hash,
                  loanId: selectedLoan.id,
                  userId: user.id,
                  repaidAmount: newRepaidAmount,
                  repaymentStatus: newRepaymentStatus,
                  method: 'wallet'
               });
            }
         });

         if (!outcome) {
            return;
         }

         // The wagmi and Openfort paths have no onSubmitted: the money is in flight from here, so
         // arm reconciliation now — a DB confirm that fails below gets retried instead of the
         // repayment silently never recording. Openfort settles on-chain like a wallet transfer.
         if (method === 'wallet' || method === 'openfort') {
            registerPendingBasePayment({
               kind: 'repay',
               id: outcome.hash,
               loanId: selectedLoan.id,
               userId: user.id,
               repaidAmount: newRepaidAmount,
               repaymentStatus: newRepaymentStatus,
               method: toSettlementMethod(method)
            });
         }

         // Relaxed lock: we no longer block a repayment that isn't from the borrower's locked
         // Base wallet (Base Pay can't pre-guarantee the payer). Record whoever actually paid
         // and just log a mismatch so we can watch how often it happens before deciding whether
         // to re-tighten.
         const payer = outcome.payer?.trim() || account.address?.trim();
         if (payer && baseWalletLock.address && !areWalletAddressesEqual(payer, baseWalletLock.address)) {
            console.warn('[repay] paid from a wallet other than the locked Base Account', {
               loanId: selectedLoan.id,
               payer,
               lockedWallet: baseWalletLock.address
            });
         }

         // Payment cleared: surface the hash so the overlay flips from "Sending" to "Confirming"
         // while the DB catches up.
         paidTxHash = outcome.hash;
         setPendingTxHash(outcome.hash);

         // Server verifies the on-chain transfer before writing status — it returns the
         // authoritative loan row (repaid amount / status derived from the real transfer).
         const confirmResult = await dispatch(
            confirmLoanPayment({
               loanId: selectedLoan.id,
               hash: outcome.hash,
               method: toSettlementMethod(method),
               action: 'repay'
            })
         );
         const confirmedLoan = unwrapResult(confirmResult);
         // The server says whether THIS repayment raised the limit (a full-limit loan, repaid in full).
         const serverLevelUp = confirmLoanPayment.fulfilled.match(confirmResult) ? confirmResult.meta.creditLevelUp : null;
         // DB write landed — the reconciler has nothing left to finish for this payment.
         clearPendingBasePayment(outcome.hash);
         await dispatch(getUserLoans({ userId: user.id })).unwrap();
         setRepaymentAmount('');
         const serverFullyRepaid = confirmedLoan.repaymentStatus === 'Paid';
         // Success event so PostHog can compute repayment success rate BY BROWSER (esp. in-app vs
         // real browser) — the "did the fix actually help" gauge. No-op unless PostHog is live.
         if (import.meta.env.PROD) {
            posthog.capture('repay_succeeded', {
               method,
               in_app_browser: inApp.isInApp,
               in_app_name: inApp.appName ?? null,
               fully_repaid: serverFullyRepaid
            });
         }
         if (cancelledRef.current) {
            // Borrower backed out of the overlay — the payment still recorded above, but don't
            // slam the full-screen payoff / partial UI over them. The success toast still confirms it.
         } else if (serverFullyRepaid) {
            setShowCompletionDetails(false);
            setCompletion({
               reason: selectedLoan.reason || 'your loan',
               paidAmount: toNumber(selectedLoan.totalRepaymentAmount),
               coin: transferCoin,
               trustPoints: earnedTrustPoints,
               creditLevelUp: serverLevelUp
                  ? { toLevel: getCreditLevelNumber(serverLevelUp.toLimit), newLimit: serverLevelUp.toLimit }
                  : null
            });
         } else {
            // Partial payment: the loan stays active, so acknowledge it inline instead of
            // the full-payoff screen.
            // The server's total (a rupiah-pegged loan is re-priced when a part payment lands).
            const remainingAfter = Math.max(
               0,
               toNumber(confirmedLoan.totalRepaymentAmount ?? selectedLoan.totalRepaymentAmount) - toNumber(confirmedLoan.repaidAmount)
            );
            setPartialPaid({ paidAmount: effectiveRepayment, remaining: remainingAfter, coin: transferCoin });
         }
         // A short success buzz on devices that support it makes the payoff feel tactile.
         if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(serverFullyRepaid ? [12, 40, 12] : 12);
         }
         showToastByConfig('repayment_success');
      } catch (error) {
         // A 202 = payment sent but not yet confirmed on-chain. Don't cry failure: the reconciler
         // (armed in onSubmitted / after the wagmi hash) will finish the DB write once it settles.
         if ((error as { name?: string } | null)?.name === 'PaymentNotConfirmedError') {
            showToast(
               TOAST_TYPES.INFO,
               'Still confirming',
               'Your payment was sent and is taking a moment to confirm. This will update automatically.'
            );
         } else if (paidTxHash) {
            // The transfer itself succeeded — only the DB write behind it failed, and the pending
            // entry registered above keeps retrying it. Don't tell the borrower their payment
            // "failed"; that invites a double-send.
            console.error('[CRITICAL] Repayment transaction succeeded but database update failed:', error);
            showToast(
               TOAST_TYPES.WARNING,
               'Payment Sent, Still Recording',
               'Your payment went through but we could not record it yet. We will keep retrying automatically — contact support if it does not update.'
            );
         } else {
            console.error('Repayment failed:', error);
            showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.TRANSACTION_FAILED));
         }
      } finally {
         setIsProcessing(false);
         setPendingTxHash(null);
         repayInFlightRef.current = false;
      }
   }, [
      selectedLoan,
      isProcessing,
      amountError,
      parsedRepaymentAmount,
      activePaymentMethod,
      account.isConnected,
      account.address,
      account.chainId,
      switchChainAsync,
      navigate,
      baseWalletLock.address,
      baseWalletLock.hasStoredWallet,
      showToast,
      showToastByConfig,
      payUsdc,
      dispatch,
      user.id,
      usePreviewLoans,
      blockForInAppBase,
      usdcBalance,
      repayWalletAddress
   ]);

   const handleRepayRef = useRef(handleRepay);

   useEffect(() => {
      handleRepayRef.current = handleRepay;
   }, [handleRepay]);

   const handleBottomNavRepay = useCallback(() => {
      void handleRepayRef.current();
   }, []);

   const bottomNavRepayAction = useMemo(
      () =>
         selectedLoan && !completion
            ? {
                 ariaLabel: account.isConnected ? `Pay now ${paymentCtaAmount}` : `Connect and pay ${paymentCtaAmount}`,
                 disabled: isRepayDisabled,
                 icon: 'dollar-circle.svg',
                 id: 'repay-pay-now',
                 isProcessing,
                 label: connectStatus === 'pending' ? 'Connecting' : payNowLabel,
                 onClick: handleBottomNavRepay,
                 path: '/repay'
              }
            : null,
      [
         account.isConnected,
         completion,
         connectStatus,
         handleBottomNavRepay,
         isProcessing,
         isRepayDisabled,
         paymentCtaAmount,
         payNowLabel,
         selectedLoan
      ]
   );

   // The step-by-step repay has its own gold Pay button on the last step.
   useBottomNavPrimaryAction(isWaltRepay ? bottomNavRepayAction : null);

   // ── Shared pieces (the step-by-step wizard and the Indonesia "other ways" page both use them) ──
   const renderLoanPicker = () =>
      activeLoans.length > 1 ? (
         <section aria-labelledby="loan-picker-title">
            <p id="loan-picker-title" className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6b6090] dark:text-[#a095c8]">
               Pick a loan
            </p>
            <div className="flex gap-3">
               {activeLoans.map((loan) => {
                  const isSelected = loan.id === selectedLoan?.id;

                  return (
                     <button
                        type="button"
                        key={loan.id}
                        onClick={(e) => handleSelectLoan(loan.id, e)}
                        aria-pressed={isSelected}
                        className={`min-w-0 flex-1 rounded-2xl p-4 text-left transition active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-md-primary-300 ${
                           isSelected
                              ? 'border-2 border-[#6c3fe0] bg-[#f8f6fe] dark:bg-[#2a1740]'
                              : 'border-[1.5px] border-[#e9e3f8] bg-white hover:border-md-primary-300 dark:border-[#3d2a60] dark:bg-[#1e1535]'
                        }`}
                     >
                        <div className="mb-2 flex items-start justify-between">
                           <span
                              title={loan.reason || 'Active loan'}
                              className={`line-clamp-1 min-h-[1.25rem] min-w-0 pr-2 text-xs font-semibold leading-snug ${isSelected ? 'text-[#6c3fe0]' : 'text-[#6b6090] dark:text-[#a095c8]'}`}
                           >
                              {loan.reason || 'Active loan'}
                           </span>
                           <div
                              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                                 isSelected
                                    ? 'border-[#6c3fe0] bg-[#6c3fe0]'
                                    : 'border-[#d1c4e9] bg-white dark:border-[#3d2a60] dark:bg-[#1e1535]'
                              }`}
                              aria-hidden="true"
                           >
                              {isSelected ? <div className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                           </div>
                        </div>
                        <p className="mb-1.5 text-xs text-[#6b6090] dark:text-[#a095c8]">Remaining</p>
                        <p className="text-lg font-bold text-[#1a1240] dark:text-white">${formatCurrency(getRemainingAmount(loan))}</p>
                        <div className="mt-2">
                           <div className="h-1 overflow-hidden rounded-full bg-[#f0ebff] dark:bg-[#2a1f4f]">
                              <div
                                 className="h-full rounded-full bg-[#6c3fe0] transition-[width] duration-300"
                                 style={{ width: `${getProgressPercent(loan)}%` }}
                              />
                           </div>
                           {getProgressPercent(loan) > 0 ? (
                              <p className="mt-1 text-[10px] font-medium text-[#6b6090] dark:text-[#a095c8]">
                                 {getProgressPercent(loan)}% paid
                              </p>
                           ) : (
                              <p className="mt-1 text-[10px] font-medium text-[#6b6090] dark:text-[#a095c8]">Not yet paid</p>
                           )}
                        </div>
                     </button>
                  );
               })}
            </div>
         </section>
      ) : null;

   const renderSourcePicker = () =>
      geoLoading ? (
         <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#6b6090] dark:text-[#a095c8]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading your options…
         </div>
      ) : (
         <>
            <p className="mb-3 text-xs text-[#6b6090]">
               Pick where you'll buy or withdraw USDC.{' '}
               <span className="font-semibold text-[#6c3fe0]">{getFundSource(heroSourceId).label}</span> works well for most people
               {inIndonesia ? (
                  <>
                     {' '}
                     in Indonesia. <span className="font-semibold text-[#6c3fe0]">Reku</span> works too; Pintu and Indodax are under "Other
                     options".
                  </>
               ) : !inPhilippines ? (
                  <>
                     {' '}
                     — and works the same whether you're in the Philippines or traveling.{' '}
                     <span className="font-semibold text-[#6c3fe0]">Binance</span> is also available under "Other options".
                  </>
               ) : (
                  '.'
               )}
            </p>

            {renderHeroSource(getFundSource(heroSourceId))}

            <div className="mt-1.5">{renderSourcePill(inIndonesia ? getFundSource(INDONESIA_PILL_SOURCE_ID) : fundSources[1])}</div>

            {(() => {
               // Local rails always show. Binance is added here ONLY for users detected
               // outside the Philippines (see the fundSources comment above for why) — it's
               // an added option abroad, never a replacement for the local rails.
               // Whichever of Coins.ph/PDAX isn't the hero lives here; a suspended
               // Coins.ph shows greyed out rather than disappearing.
               // Indonesian borrowers get only Pintu/Indodax here (see the fundSources comment).
               const otherSources = inIndonesia
                  ? INDONESIA_OTHER_SOURCE_IDS.map(getFundSource)
                  : fundSources
                       .filter(
                          (source) =>
                             source.id !== HERO_SOURCE_ID &&
                             (source.id === 'gcrypto' ||
                                source.id === 'pdax' ||
                                source.id === 'coinsph' ||
                                (source.id === 'binance' && !inPhilippines))
                       )
                       .sort((a, b) => Number(isPausedSource(a.id)) - Number(isPausedSource(b.id)));
               const otherSelected = otherSources.some((source) => source.id === fundSource);
               const expanded = showMoreSources || otherSelected;

               return (
                  <>
                     <button
                        type="button"
                        onClick={() => setShowMoreSources((value) => !value)}
                        aria-expanded={expanded}
                        className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1 cursor-pointer text-xs font-semibold text-[#6b6090] transition hover:text-[#6c3fe0] dark:text-[#a095c8]"
                        style={{ touchAction: 'manipulation' }}
                     >
                        {expanded ? 'Fewer options' : 'Other options'}
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                     </button>

                     {expanded ? (
                        <div className="mt-1.5 grid grid-cols-2 gap-1.5">{otherSources.map((source) => renderSourcePill(source))}</div>
                     ) : null}
                     {expanded && showCoinsPaused ? (
                        <div
                           role="status"
                           className="mt-2 rounded-xl border border-[#e9e3f8] bg-[#f8f6fd] px-3.5 py-3 dark:border-[#3d2a60] dark:bg-[#1e1535]"
                        >
                           <p className="text-xs font-semibold text-[#1a1240] dark:text-white">{COINS_PH_SUSPENDED_TITLE}</p>
                           <p className="mt-0.5 text-[11px] leading-relaxed text-[#6b6090] dark:text-[#a095c8]">
                              {COINS_PH_SUSPENDED_MESSAGE}
                           </p>
                        </div>
                     ) : null}
                  </>
               );
            })()}
            {inPhilippines && fundSource !== 'gcrypto' ? (
               <button
                  type="button"
                  onClick={() => {
                     setFundSource('gcrypto');
                     setShowMoreSources(true);
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#ffbe1a] bg-[#fff6d6] px-3 py-2.5 text-xs font-semibold text-[#4a2a00] dark:bg-[#3a2e10] dark:text-[#ffe27a]"
                  style={{ touchAction: 'manipulation' }}
               >
                  Using GCash? See GCrypto steps with pictures
               </button>
            ) : null}
            <p className="mt-2 text-xs text-[#6b6090] dark:text-[#a095c8]">
               You can repay from a wallet, an exchange, a P2P platform, or a local crypto service — whatever is available in your country.{' '}
               <button
                  type="button"
                  onClick={() => navigate('/support/guides/repaying-your-loan')}
                  className="font-semibold text-[#6c3fe0] underline underline-offset-2"
               >
                  Learn more
               </button>
            </p>
         </>
      );

   const renderAddressCard = () => (
      <>
         <button
            type="button"
            onClick={handleCopyAddress}
            className={`w-full rounded-2xl p-4 text-left transition-colors duration-200 active:scale-[0.99] ${
               copiedAddress
                  ? 'bg-[#dcfce7] ring-2 ring-[#16a34a] dark:bg-[#052e16]'
                  : 'bg-[#f5f4fa] ring-2 ring-[#6c3fe0]/30 dark:bg-[#2a1740] dark:ring-[#6c3fe0]/40'
            }`}
         >
            <div className="flex items-center justify-between gap-2">
               <p className={`text-xs font-semibold ${copiedAddress ? 'text-[#16a34a]' : 'text-[#6c3fe0] dark:text-[#c4b5fd]'}`}>
                  {copiedAddress ? 'Copied!' : 'Tap to copy your wallet address'}
               </p>
               <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${copiedAddress ? 'bg-[#16a34a]' : 'bg-[#6c3fe0]'}`}
               >
                  {copiedAddress ? (
                     <Check className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                  ) : (
                     <Copy className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                  )}
               </span>
            </div>
            <p className="mt-1.5 truncate font-mono text-[22px] font-extrabold leading-tight text-[#1a1240] dark:text-white">
               {formatWalletAddressShort(repayWalletAddress)}
            </p>
            {copiedAddress && (
               <p className="mt-1.5 text-[12px] font-medium text-[#16a34a]">
                  {activeSource.id === 'moneybees' ? 'Now open Moneybees below →' : 'Now paste it into the app below →'}
               </p>
            )}
         </button>
         {/* Wrong-network sends lose funds and can't be recovered — make BASE unmissable
                                        at the exact moment the borrower copies the address to paste as a destination. */}
         <div className="mt-3 rounded-xl bg-[#fef2f2] p-3 ring-1 ring-[#fca5a5] dark:bg-[#3a1414] dark:ring-[#7f1d1d]">
            <p className="text-[13px] font-extrabold leading-snug text-[#b91c1c] dark:text-[#fca5a5]">⚠️ Send on the BASE network only</p>
            <p className="mt-0.5 text-[12px] font-medium leading-snug text-[#b91c1c] dark:text-[#fca5a5]">
               USDC sent on Ethereum, Polygon, or any other network goes to this address on the wrong chain and is lost forever — it cannot
               be recovered. When {activeSource.label} asks which network, choose <span className="font-extrabold underline">Base</span>.
            </p>
         </div>
      </>
   );

   const renderSendSteps = (shortfall: number | null) => (
      <>
         {/* Instruction card */}
         {activeSource.id === 'moneybees' ? (
            <div className="mb-3 rounded-xl bg-[#f3effe] px-4 py-3.5 dark:bg-[#1e1535]">
               <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-[#6c3fe0]">How it works</p>
               <div className="space-y-2">
                  {(
                     ['Visit moneybees.ph and follow their own process', 'They handle ID checks and the rate directly with you'] as const
                  ).map((step, i) => (
                     <div key={i} className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full bg-[#6c3fe0] text-[9px] font-bold leading-none text-white">
                           {String.fromCharCode(97 + i)}
                        </span>
                        <span className="text-[12px] font-medium leading-snug text-[#3d1a8a] dark:text-[#c4b5fd]">{step}</span>
                     </div>
                  ))}
                  <div className="flex items-start gap-2.5">
                     <span className="mt-0.5 flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full bg-[#6c3fe0] text-[9px] font-bold leading-none text-white">
                        c
                     </span>
                     <span className="text-[12px] font-medium leading-snug text-[#3d1a8a] dark:text-[#c4b5fd]">
                        Share your address —{' '}
                        <button
                           type="button"
                           onClick={handleCopyAddress}
                           className="inline-flex items-center gap-1 font-semibold text-[#6c3fe0] underline underline-offset-2 active:opacity-70"
                        >
                           {copiedAddress ? (
                              <>
                                 <Check className="inline h-3 w-3" /> Copied!
                              </>
                           ) : (
                              <>
                                 <Copy className="inline h-3 w-3" /> copy it here
                              </>
                           )}
                        </button>{' '}
                        · pay only after they confirm
                     </span>
                  </div>
               </div>
               <p className="mt-2.5 text-[11px] leading-snug text-[#6b6090] dark:text-[#a095c8]">
                  Moneybees is an external service — you transact with them directly; Moodeng isn&rsquo;t part of the transaction.
               </p>
            </div>
         ) : (
            <div className="mb-3 rounded-xl bg-[#f3effe] px-4 py-3.5 dark:bg-[#1e1535]">
               <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#6c3fe0]">In {activeSource.label}</p>
               <p className="text-[12px] font-semibold leading-relaxed text-[#1a1240] dark:text-white">
                  {FUND_SOURCE_PATHS[activeSource.id]}
               </p>
               <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-[#ede9f8] px-2.5 py-1.5 dark:bg-[#2a1f4f]">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#6c3fe0]" aria-hidden="true" />
                  {activeSource.id === 'binance' ||
                  activeSource.id === 'reku' ||
                  activeSource.id === 'coinsph' ||
                  activeSource.id === 'tokocrypto' ||
                  activeSource.id === 'indodax' ||
                  activeSource.id === 'pintu' ? (
                     <span className="text-[11px] font-semibold text-[#4a1fb8] dark:text-[#a78bfa]">
                        Select <strong>Base</strong> network — not Ethereum or Polygon
                     </span>
                  ) : (
                     <span className="text-[11px] font-semibold text-[#4a1fb8] dark:text-[#a78bfa]">
                        Look for <strong>USDCBASE</strong> — not USDC or other tokens
                     </span>
                  )}
               </div>
               {activeSource.id === 'pdax' ? (
                  <div className="mt-3 overflow-hidden rounded-lg">
                     <iframe
                        className="w-full"
                        height="195"
                        src="https://www.youtube.com/embed/tuHmz4J7I2o"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="How to withdraw USDC from PDAX to your wallet"
                     />
                  </div>
               ) : null}
               {activeSource.id === 'gcrypto' ? <GcryptoPictureSteps shortfall={shortfall} /> : null}
            </div>
         )}

         {/* Indonesian sources: "buy a little extra" before they leave for the exchange */}
         {(() => {
            const breakdown = SOURCE_FEE_BREAKDOWN[activeSource.id];
            if (!breakdown) return null;
            const amount = shortfall ?? 0;
            const amountToBuy = getAmountToBuy(breakdown, amount);
            return (
               <div className="mb-3 rounded-xl bg-[#fff8e6] px-3.5 py-3 ring-1 ring-[#fcd34d] dark:bg-[#2a2210] dark:ring-[#854d0e]">
                  <p className="text-[13px] font-extrabold text-[#1a1240] dark:text-white">Buy a little extra to cover the fee</p>
                  <p className="mt-1 text-[13px] font-semibold leading-snug text-[#1a1240] dark:text-white">
                     You need ${formatCurrency(amount)} → buy about{' '}
                     <span className="font-extrabold text-[#6c3fe0] dark:text-[#c4b5fd]">${formatCurrency(amountToBuy)}</span> of USDC
                  </p>
                  <p className="mt-1.5 text-[12px] leading-snug text-[#6b6090] dark:text-[#a095c8]">
                     {activeSource.label} takes about {breakdown.feeLabel.replace('~', '')} to send your USDC. If you only buy $
                     {formatCurrency(amount)}, less than that arrives and your repayment falls short.
                  </p>
                  {breakdown.depositTip ? (
                     <p className="mt-1.5 text-[12px] leading-snug text-[#6b6090] dark:text-[#a095c8]">{breakdown.depositTip}</p>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between border-t border-[#fde68a] pt-2 text-[12px] dark:border-[#854d0e]">
                     <span className="flex items-center gap-2 text-[#6b6090] dark:text-[#a095c8]">
                        <ShieldCheck className="h-3.5 w-3.5 text-[#6c3fe0]" aria-hidden="true" />
                        Moodeng fee
                     </span>
                     <span className="whitespace-nowrap rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-bold text-[#16a34a] dark:bg-[#052e16]">
                        Free ✓
                     </span>
                  </div>
               </div>
            );
         })()}

         {/* CTA button */}
         <button
            type="button"
            onClick={() => {
               if (!activeSource.deepLink) {
                  window.open(activeSource.href, '_blank', 'noopener,noreferrer');
                  return;
               }
               // Try app scheme; if app not installed the location change is a no-op,
               // so fall back to the web URL after 1.5 s.
               window.location.href = activeSource.deepLink;
               setTimeout(() => {
                  window.open(activeSource.href, '_blank', 'noopener,noreferrer');
               }, 1500);
            }}
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-[18px] bg-[linear-gradient(180deg,#ffe27a_0%,#ffbe1a_100%)] text-[17px] font-extrabold text-[#4a2a00] shadow-[0_4px_0_#d99a00] active:translate-y-[2px] active:shadow-[0_2px_0_#d99a00]"
         >
            {activeSource.action}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
         </button>

         {/* Fee attribution — only for paid sources */}
         {(() => {
            const fee = FUND_SOURCE_FEES[activeSource.id];
            if (fee === 0) return null;
            const breakdown = SOURCE_FEE_BREAKDOWN[activeSource.id];
            if (breakdown) return null;
            return (
               <div className="mt-2.5 rounded-xl bg-[#f8f7fb] px-3.5 py-3 dark:bg-[#1e1535]">
                  <div className="flex items-center justify-between text-[12px]">
                     <span className="flex items-center gap-2 text-[#6b6090] dark:text-[#a095c8]">
                        {renderSourceLogo(activeSource.id, false)}
                        {activeSource.label}'s fee
                     </span>
                     <span className="whitespace-nowrap rounded-full bg-[#ede9f8] px-2 py-0.5 text-[10px] font-bold text-[#6b6090] dark:bg-[#2a1f4f] dark:text-[#a095c8]">
                        Small fee
                     </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-[#ede9f8] pt-2 text-[12px] dark:border-[#2a1f4f]">
                     <span className="flex items-center gap-2 text-[#6b6090] dark:text-[#a095c8]">
                        <ShieldCheck className="h-3.5 w-3.5 text-[#6c3fe0]" aria-hidden="true" />
                        Moodeng fee
                     </span>
                     <span className="whitespace-nowrap rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-bold text-[#16a34a] dark:bg-[#052e16]">
                        Free ✓
                     </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-[#6b6090] dark:text-[#a095c8]">
                     Send a little extra to cover {activeSource.label}'s fee — Moodeng never charges to repay.
                  </p>
               </div>
            );
         })()}
      </>
   );

   const renderAmountPicker = (loan: Loan) => (
      <>
         {isLoanOverdue(loan) ? (
            <div className="mb-3 flex items-start gap-2.5 rounded-md-input border border-[#f4d2d2] bg-[#fff7f7] px-3 py-2.5 text-left dark:border-[#68303a] dark:bg-[#3c171e]">
               <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-md-red-600" aria-hidden="true" />
               <p className="text-md-b3 font-medium text-md-red-600">
                  Paying less than the full ${formatCurrency(selectedRemaining)} reduces what you owe, but your account stays restricted
                  until this loan is fully repaid.
               </p>
            </div>
         ) : null}

         {selectedRemainingIdr !== null ? (
            // Rupiah peg: the rupiah left is what they owe; the USDT is today's price for it.
            <div className="mb-4 rounded-md-input border border-[#e9e3f8] bg-[#f7f4ff] px-3 py-3 dark:border-[#2a1f4f] dark:bg-[#1e1535]">
               <p className="text-xs font-medium text-[#6b6090] dark:text-[#a095c8]">{locale === 'en' ? 'Left to pay' : 'Sisa'}</p>
               <p className="text-3xl font-bold tracking-tight text-[#1a1240] dark:text-white">{formatIdr(selectedRemainingIdr)}</p>
               <p className="mt-0.5 text-xs text-[#6b6090] dark:text-[#a095c8]">
                  ≈ {formatCurrency(selectedRemaining)} USDT {locale === 'en' ? 'today' : 'hari ini'}
               </p>
            </div>
         ) : null}

         <p className="mb-1.5 text-xs font-medium text-[#6b6090] dark:text-[#a095c8]">You're paying</p>
         <div className="flex items-end justify-center gap-2 mb-1">
            {/* Invisible mirror of the unit so the big number is OPTICALLY centered,
                            not just the number+unit group (which pulls the number left). */}
            <span className="invisible mb-0.5 text-sm font-semibold" aria-hidden="true">
               {loan.coin || 'USDC'}
            </span>
            {/* Dashed underline signals the amount is tappable/editable — without it
                            the input reads as static display text and the feature goes undiscovered. */}
            <div className="flex items-end border-b border-dashed border-[#c9bdf0] pb-0.5">
               <span
                  className={`text-4xl font-bold tracking-tight leading-none ${repaymentAmount ? 'text-[#1a1240] dark:text-white' : 'text-[#1a1240]/30 dark:text-white/30'}`}
               >
                  $
               </span>
               <span className="relative inline-block leading-none">
                  <span className="invisible whitespace-pre text-4xl font-bold tracking-tight leading-none" aria-hidden="true">
                     {repaymentAmount || '0.00'}
                  </span>
                  <input
                     ref={amountInputRef}
                     id="repayment-amount"
                     type="text"
                     inputMode="decimal"
                     value={repaymentAmount}
                     onChange={handleAmountChange}
                     placeholder="0.00"
                     aria-label="Repay amount"
                     className="absolute inset-0 w-full border-0 bg-transparent p-0 text-4xl font-bold tracking-tight leading-none text-[#1a1240] caret-md-primary-1100 outline-none placeholder:text-[#1a1240]/30 dark:text-white dark:placeholder:text-white/30"
                  />
               </span>
            </div>
            <span className="mb-0.5 text-sm font-semibold text-[#6b6090]">{loan.coin || 'USDC'}</span>
         </div>
         {validPreviewPayment <= 0 ? (
            <p className="text-xs text-[#6b6490]">of ${formatCurrency(selectedRemaining)} remaining</p>
         ) : validPreviewPayment >= selectedRemainingRounded ? (
            <p className="text-xs font-semibold text-md-green-900">Clears this loan ✓</p>
         ) : (
            <p className="text-xs text-[#6b6090]">
               leaves{' '}
               <span className="font-semibold text-[#6010d2]">${formatCurrency(Math.max(0, selectedRemaining - validPreviewPayment))}</span>{' '}
               remaining
            </p>
         )}
         {validPreviewPayment > 0 && !isLoanOverdue(loan) && estimatedTrustPoints > 0 ? (
            <span className="trust-badge mt-3 mb-2 inline-flex items-center gap-1.5 rounded-md-pill border border-[#e9e3f8] bg-[#f0ebff] px-3 py-1 text-md-b3 font-semibold text-[#6c3fe0]">
               <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />+{estimatedTrustPoints} Pandesal points
            </span>
         ) : null}

         <div className="relative mb-4 mt-3">
            <input
               type="range"
               min={0}
               max={selectedRemainingRounded}
               step={0.01}
               value={Math.min(parsedRepaymentAmount, selectedRemainingRounded)}
               onChange={(event) => {
                  setRepaymentAmount(formatCurrency(Number(event.target.value)));
                  setPartialPaid(null);
               }}
               aria-label="Adjust repay amount"
               className="repay-slider h-2 w-full cursor-pointer appearance-none rounded-full"
               style={{
                  background: `linear-gradient(to right, #6010d2 ${repaySliderPercent}%, #ede8fb ${repaySliderPercent}%)`
               }}
            />
         </div>

         <div className="mb-5 flex gap-2">
            {quickRepaymentFractions.map((option) => {
               const isQuickSelected = selectedQuickFraction === option.value;
               const quickAmount = selectedRemaining * option.value;

               return (
                  <button
                     type="button"
                     key={option.label}
                     onClick={() => setQuickAmount(option.value)}
                     aria-pressed={isQuickSelected}
                     style={{ touchAction: 'manipulation' }}
                     className={`flex min-h-[44px] flex-1 cursor-pointer flex-col items-center justify-center rounded-xl transition active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-md-primary-300 ${
                        isQuickSelected
                           ? 'border-2 border-[#6c3fe0] bg-[#f3effe]'
                           : 'border border-[#e9e3f8] bg-white hover:border-md-primary-300'
                     }`}
                  >
                     <span className={`text-xs font-bold leading-none ${isQuickSelected ? 'text-[#1a1240]' : 'text-[#6b6090]'}`}>
                        {option.label}
                     </span>
                     <span
                        className={`mt-0.5 text-[10px] font-medium leading-none ${isQuickSelected ? 'text-[#6c3fe0]' : 'text-[#9a93b8]'}`}
                     >
                        ${formatCurrency(quickAmount)}
                     </span>
                  </button>
               );
            })}
         </div>

         {amountError ? (
            <p role="alert" className="mb-2 text-md-b3 font-semibold text-md-red-600">
               {amountError}
            </p>
         ) : null}
      </>
   );

   const shouldShowLoanCheckLoading =
      !usePreviewLoans && Boolean(user.id) && activeLoans.length === 0 && (!hasCheckedRepayLoans || isCheckingRepayLoans);

   if (shouldShowLoanCheckLoading) {
      return (
         <main className="repay-page min-h-screen bg-md-neutral-200 px-5 pb-28 pt-8">
            <div className="mx-auto flex w-full max-w-[400px] flex-col gap-4">
               <div className="h-16 rounded-md-xl bg-md-neutral-300" />
               <div className="h-44 rounded-md-xl bg-md-neutral-300" />
               <div className="h-80 rounded-md-xl bg-md-neutral-300" />
            </div>
         </main>
      );
   }

   // A lender with nothing of their own to repay (e.g. typed /repay) goes back to their dashboard
   if (!usePreviewLoans && user.userRole === 'lender' && activeLoans.length === 0 && !completion) {
      return <Navigate to="/lender/dashboard" replace />;
   }

   // In Facebook's in-app browser a Base-Account borrower can't complete the wallet handshake, so
   // replace the (doomed) repay form with the escape hatch. Not shown once a repayment succeeded.
   if (blockForInAppBase && !completion) {
      return (
         <main className="repay-page min-h-screen bg-md-neutral-200 px-4 pb-28 pt-10">
            <RepayInAppBrowserGate info={inApp} />
         </main>
      );
   }

   if (completion) {
      const hasMoreLoans = activeLoans.length > 0;

      // Step-by-step repay: a big, clear "you're paid" with the next thing to do.
      if (!isWaltRepay) {
         return (
            <main className="repay-page min-h-screen bg-[#fffaf0] px-4 pb-32 pt-8 text-[#2b2116] dark:bg-[#100d17] dark:text-[#f5efe3]">
               <div className="mx-auto flex w-full max-w-[440px] flex-col items-center gap-4 text-center">
                  <img src={CONNECT_HIPPOS.approved} alt="" aria-hidden="true" className="h-[170px] w-auto select-none" draggable={false} />
                  <h1 className="text-[30px] font-extrabold leading-[34px] tracking-[-0.02em]">You’re paid! 🎉</h1>
                  <div className="flex flex-col items-center">
                     <span className="text-[40px] font-extrabold leading-[44px]">
                        {showPesos ? toPesos(completion.paidAmount) : `$${formatCurrency(completion.paidAmount)}`}
                     </span>
                     {showPesos ? (
                        <span className="text-[16px] font-bold text-[#7a6a4f] dark:text-[#bfb29a]">
                           ${formatCurrency(completion.paidAmount)} {completion.coin}
                        </span>
                     ) : null}
                  </div>
                  <div className="flex w-full flex-col gap-2 text-left">
                     {completion.creditLevelUp ? <DoneRow>New limit: ${completion.creditLevelUp.newLimit}</DoneRow> : null}
                     {completion.trustPoints > 0 ? <DoneRow>+{completion.trustPoints} Pandesal points</DoneRow> : null}
                  </div>
                  <div className="flex w-full flex-col gap-3">
                     {hasMoreLoans ? (
                        <GoldButton onClick={() => setCompletion(null)}>Pay next loan</GoldButton>
                     ) : (
                        <GoldButton onClick={() => navigate('/request-board', { state: { openLoanRequest: true } })}>
                           Borrow again
                        </GoldButton>
                     )}
                     <SoftButton onClick={() => navigate('/dashboard')}>Home</SoftButton>
                  </div>
               </div>
            </main>
         );
      }

      return (
         <main className="repay-page min-h-screen bg-md-neutral-200 px-4 pb-32 pt-5 text-md-heading sm:px-6">
            <div className="mx-auto flex w-full max-w-[400px] flex-col gap-3">
               <section className="repay-success-section flex flex-col items-center rounded-md-xl border border-md-neutral-300 bg-md-neutral-100 px-5 pb-6 pt-8 text-center animate-[repaySuccessIn_0.35s_cubic-bezier(0.16,1,0.3,1)]">
                  <span className="repay-success-icon flex h-14 w-14 items-center justify-center rounded-md-pill bg-md-green-100 text-md-green-900 animate-[repaySuccessPop_0.45s_cubic-bezier(0.16,1,0.3,1)]">
                     <Check className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <h1 className="mt-4 text-md-h4 font-semibold text-md-heading">Loan repaid</h1>
                  <p className="mt-4 text-[30px] font-semibold leading-none tracking-[-0.03em] text-md-heading">
                     ${formatCurrency(completion.paidAmount)} <span className="text-md-b2 font-semibold">{completion.coin}</span>
                  </p>
                  <p className="mt-2 text-md-b2 font-medium text-md-neutral-1200">Paid in full</p>

                  {completion.trustPoints > 0 ? (
                     <span className="mt-4 inline-flex items-center gap-1.5 rounded-md-pill bg-md-green-100 px-3 py-1.5 text-md-b3 font-semibold text-md-green-900">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        Pandesal points +{completion.trustPoints}
                     </span>
                  ) : null}

                  {completion.creditLevelUp ? (
                     <div className="mt-6 flex w-full items-center gap-3 rounded-md-lg bg-md-primary-100 px-4 py-4 text-left animate-[repaySuccessIn_0.4s_cubic-bezier(0.16,1,0.3,1)_0.2s_both]">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md-pill bg-md-primary-1200 text-md-neutral-100">
                           <TrendingUp className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                           <p className="text-md-b3 font-semibold text-md-primary-1500">New borrowing limit</p>
                           <p className="mt-0.5 text-md-b2 font-semibold text-md-heading">
                              Credit Level {completion.creditLevelUp.toLevel} unlocked
                           </p>
                        </div>
                        <div className="shrink-0 text-right">
                           <p className="text-md-h4 font-semibold text-md-primary-1500">${completion.creditLevelUp.newLimit}</p>
                           <p className="text-md-b3 font-medium text-md-neutral-1200">limit</p>
                        </div>
                     </div>
                  ) : null}

                  <div className="mt-5 w-full border-y border-md-neutral-400">
                     <button
                        type="button"
                        onClick={() => setShowCompletionDetails((visible) => !visible)}
                        aria-expanded={showCompletionDetails}
                        className="flex min-h-[52px] w-full items-center justify-between gap-3 text-left text-md-b2 font-semibold text-md-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-md-primary-900"
                     >
                        <span>{showCompletionDetails ? 'Hide repayment details' : 'Show repayment details'}</span>
                        <ChevronDown
                           className={`h-4 w-4 text-md-primary-900 transition-transform duration-200 ${
                              showCompletionDetails ? 'rotate-180' : ''
                           }`}
                           aria-hidden="true"
                        />
                     </button>
                     {showCompletionDetails ? (
                        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 pb-4 text-left text-md-b3">
                           <dt className="font-medium text-md-neutral-1200">Loan</dt>
                           <dd className="min-w-0 break-words text-right font-medium text-md-heading">{completion.reason}</dd>
                           <dt className="font-medium text-md-neutral-1200">Amount</dt>
                           <dd className="text-right font-medium text-md-heading">
                              ${formatCurrency(completion.paidAmount)} {completion.coin}
                           </dd>
                        </dl>
                     ) : null}
                  </div>

                  <div className="mt-5 flex w-full flex-col gap-1">
                     <button
                        type="button"
                        onClick={() => {
                           if (hasMoreLoans) {
                              setCompletion(null);
                              return;
                           }
                           navigate('/dashboard');
                        }}
                        className="inline-flex min-h-[54px] items-center justify-center rounded-[16px] bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 active:scale-[0.99]"
                     >
                        {hasMoreLoans ? 'Repay next loan' : 'Done'}
                     </button>
                     <button
                        type="button"
                        onClick={() => navigate('/history')}
                        className="inline-flex min-h-[48px] items-center justify-center rounded-[16px] px-md-4 py-md-2 text-md-b2 font-semibold text-md-primary-1200 active:bg-md-primary-100"
                     >
                        View repayment history
                     </button>
                  </div>
               </section>
            </div>
         </main>
      );
   }

   const repayPageCss = `
            .repay-page input.repay-slider::-webkit-slider-thumb {
               -webkit-appearance: none;
               appearance: none;
               width: 18px;
               height: 18px;
               border-radius: 9999px;
               background: #ffffff;
               border: 2px solid #6010d2;
               box-shadow: 0 2px 6px rgba(96, 16, 210, 0.25);
               cursor: pointer;
            }
            .repay-page input.repay-slider::-moz-range-thumb {
               width: 18px;
               height: 18px;
               border-radius: 9999px;
               background: #ffffff;
               border: 2px solid #6010d2;
               box-shadow: 0 2px 6px rgba(96, 16, 210, 0.25);
               cursor: pointer;
            }
            @keyframes trust-badge-in {
               from { opacity: 0; transform: scale(0.82) translateY(6px); }
               to   { opacity: 1; transform: scale(1)    translateY(0); }
            }
            .repay-page .trust-badge {
               animation: trust-badge-in 0.2s cubic-bezier(0.34,1.56,0.64,1) both;
            }
            @media (prefers-reduced-motion: reduce) {
               .repay-page .trust-badge { animation: none; }
            }
            /* Indeterminate "watching" bar: a segment bounces left↔right, grayer toward its
               trailing (right) edge. */
            .repay-page .repay-watch-bar {
               width: 32%;
               background: linear-gradient(90deg, #6010d2 0%, #b3a7d6 100%);
               animation: repay-watch 1.7s ease-in-out infinite;
               will-change: transform;
            }
            @keyframes repay-watch {
               0% { transform: translateX(0); }
               50% { transform: translateX(212%); }
               100% { transform: translateX(0); }
            }
            @media (prefers-reduced-motion: reduce) {
               .repay-page .repay-watch-bar { animation: none; }
            }
            @media (prefers-reduced-motion: reduce) {
               .repay-page .repay-success-section { animation: none; }
               .repay-page .repay-success-icon { animation: none; }
            }
         `;

   const howToVideoModal = showHowToVideo ? (
      <div
         className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
         role="dialog"
         aria-modal="true"
         aria-label="How to repay"
         onClick={() => setShowHowToVideo(false)}
      >
         <div className="relative w-full max-w-[360px]" onClick={(e) => e.stopPropagation()}>
            <button
               type="button"
               onClick={() => setShowHowToVideo(false)}
               className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/60"
               aria-label="Close video"
            >
               <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="overflow-hidden rounded-2xl bg-black shadow-md-card" style={{ aspectRatio: '9 / 16' }}>
               <iframe
                  src="https://www.youtube.com/embed/Eu9JzDMOSmw?autoplay=1"
                  title="How to repay a Moodeng loan"
                  className="h-full w-full"
                  style={{ border: 0 }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
               />
            </div>
         </div>
      </div>
   ) : null;

   // ── Step-by-step repay (Philippines and everyone else; Indonesia-track borrowers use Walt above) ──
   if (!isWaltRepay && selectedLoan) {
      const payAmount = hasValidPayAmount ? Math.min(parsedRepaymentAmount, selectedRemainingRounded) : 0;
      const amountShortfall = usdcBalance !== null ? Math.max(0, Math.round((payAmount - usdcBalance) * 100) / 100) : null;
      const amountFunded = usdcBalance !== null && payAmount > 0 && usdcBalance + 0.005 >= payAmount;
      const clearsLoan = payAmount >= selectedRemainingRounded;
      // Enough USDC already: one screen, one tap (no steps).
      const quickPay = wizardStep === 'amount' && amountFunded;
      // Paying off a full-limit loan moves them up a tier ([[credit-leveling-rule]]).
      // Same rule the server applies when the loan is marked Paid (src/lib/creditLeveling.ts mirrors
      // supabase/functions/_shared/creditAndPoints.ts): a full-limit loan repaid in full → next tier.
      const progression = evaluateCreditProgression({
         currentLimit: user.cs,
         isVerified: isWorldIdVerified,
         repaidAmount: toNumber(selectedLoan.repaidAmount) + payAmount,
         totalRepaymentAmount: toNumber(selectedLoan.totalRepaymentAmount),
         loanAmount: toNumber(selectedLoan.loanAmount),
         dueDate: selectedLoan.dueDate,
         paidAt: new Date().toISOString()
      });
      const currentLimit = user.cs || STARTING_CREDIT_LIMIT;
      const nextLimit = progression.shouldLevelUp ? progression.nextLimit : currentLimit;
      const goTo = (next: WizardStep) => {
         setWizardStep(next);
         window.scrollTo({ top: 0, behavior: 'smooth' });
      };
      const appName = activeSource.label;
      const openSourceApp = () => {
         if (!activeSource.deepLink) {
            window.open(activeSource.href, '_blank', 'noopener,noreferrer');
            return;
         }
         // Try the app; if it isn't installed nothing happens, so open the website after 1.5 s.
         window.location.href = activeSource.deepLink;
         setTimeout(() => window.open(activeSource.href, '_blank', 'noopener,noreferrer'), 1500);
      };
      const buyTip = (() => {
         if (amountShortfall === null || amountShortfall <= 0) return null;
         if (activeSource.id === 'gcrypto') return `Buy $${formatCurrency(suggestedGcryptoBuyAmount(amountShortfall))} USDC`;
         // PDAX: they type the pesos, so show pesos. PDAX's price runs ~2% over the market rate and
         // sending out costs a little USDC, so round up with a buffer.
         if (activeSource.id === 'pdax') {
            return `Type ₱${(Math.ceil(((amountShortfall + 0.5) * phpRate * 1.03) / 10) * 10).toLocaleString('en-PH')}`;
         }
         const breakdown = SOURCE_FEE_BREAKDOWN[activeSource.id];
         if (breakdown) return `Buy $${formatCurrency(getAmountToBuy(breakdown, amountShortfall))} USDC`;
         return `Buy a bit more than $${formatCurrency(amountShortfall)} USDC`;
      })();
      const backLink = (to: WizardStep) => (
         <button
            type="button"
            onClick={() => goTo(to)}
            className="mx-auto mt-1 text-[15px] font-bold text-[#8a7a5a] underline-offset-2 hover:underline dark:text-[#c9b98f]"
         >
            ← Back
         </button>
      );
      const dueLine = (
         <span
            className={`inline-flex items-center gap-1.5 text-[15px] font-bold ${
               isLoanOverdue(selectedLoan) || isLoanDueSoon(selectedLoan)
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-[#7a6a4f] dark:text-[#bfb29a]'
            }`}
         >
            <Clock className="size-4 shrink-0" aria-hidden="true" />
            {isLoanOverdue(selectedLoan) ? 'Past due' : `Due ${getDueDateShortCopy(selectedLoan)} · ${getDueCountdownCopy(selectedLoan)}`}
         </span>
      );
      // Pesos big, dollars small (Indonesian-geo borrowers just see dollars).
      const bigMoney = (usd: number) => (
         <div className="flex flex-col items-center">
            <span className="text-[44px] font-extrabold leading-[48px] tracking-[-0.02em]">
               {showPesos ? toPesos(usd) : `$${formatCurrency(usd)}`}
            </span>
            {showPesos ? (
               <span className="text-[16px] font-bold text-[#7a6a4f] dark:text-[#bfb29a]">${formatCurrency(usd)} USDC</span>
            ) : null}
         </div>
      );
      const rewardChip = clearsLoan ? (
         <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff1c2] px-3 py-1.5 text-[15px] font-extrabold text-[#6b4a00] dark:bg-[#3a2e10] dark:text-[#ffe27a]">
            🎁 {nextLimit > currentLimit ? `Next loan: up to $${nextLimit}` : 'Borrow again right after'}
         </span>
      ) : null;
      // Two or more loans: simple tiles (name + amount), the picked one in gold.
      const loanTiles =
         activeLoans.length > 1 ? (
            <div className="grid grid-cols-2 gap-3">
               {activeLoans.map((loan) => {
                  const picked = loan.id === selectedLoan.id;
                  return (
                     <button
                        key={loan.id}
                        type="button"
                        aria-pressed={picked}
                        onClick={(e) => handleSelectLoan(loan.id, e)}
                        className={`flex min-h-[84px] flex-col items-start justify-center gap-1 rounded-[18px] border-2 bg-white px-4 text-left transition active:scale-[0.98] dark:bg-[#1a1524] ${
                           picked ? 'border-[#ffbe1a] shadow-[0_3px_0_#d99a00]' : 'border-[#f0e6c8] dark:border-[#2e2638]'
                        }`}
                     >
                        <span className="line-clamp-1 text-[14px] font-bold text-[#7a6a4f] dark:text-[#bfb29a]">
                           {loan.reason || 'Loan'}
                        </span>
                        <span className="text-[22px] font-extrabold leading-none">
                           {showPesos ? toPesos(getRemainingAmount(loan)) : `$${formatCurrency(getRemainingAmount(loan))}`}
                        </span>
                     </button>
                  );
               })}
            </div>
         ) : null;
      // How much: full by default; "Pay less" opens a small box.
      const amountCard = (
         <>
            <Card className="items-center !gap-2 py-5 text-center">
               {bigMoney(payAmount)}
               {clearsLoan ? (
                  <span className="text-[15px] font-bold text-[#1f7a3d] dark:text-[#8fe3a8]">Clears your loan ✓</span>
               ) : (
                  <span className="text-[15px] font-bold text-[#7a6a4f] dark:text-[#bfb29a]">
                     {showPesos ? toPesos(selectedRemaining - payAmount) : `$${formatCurrency(selectedRemaining - payAmount)}`} left after
                  </span>
               )}
               {dueLine}
            </Card>
            {payLess ? (
               <Card>
                  <label htmlFor="repay-less" className="text-[15px] font-bold">
                     Amount (USDC)
                  </label>
                  <div className="flex items-center gap-2">
                     <span className="text-[22px] font-extrabold">$</span>
                     <input
                        id="repay-less"
                        type="text"
                        inputMode="decimal"
                        value={repaymentAmount}
                        onChange={handleAmountChange}
                        className="min-h-[48px] min-w-0 flex-1 rounded-[12px] border-2 border-[#ecdfb8] bg-white px-3 text-[22px] font-extrabold outline-none focus:border-[#ffbe1a] dark:border-[#4a3d1c] dark:bg-[#1a1524]"
                     />
                     <button
                        type="button"
                        onClick={() => {
                           setRepaymentAmount(formatCurrency(selectedRemaining));
                           setPayLess(false);
                        }}
                        className="min-h-[48px] rounded-[12px] bg-[#fff1c2] px-4 text-[15px] font-extrabold text-[#6b4a00] dark:bg-[#3a2e10] dark:text-[#ffe27a]"
                     >
                        Full
                     </button>
                  </div>
                  {amountError ? <p className="text-[14px] font-bold text-md-red-600">{amountError}</p> : null}
               </Card>
            ) : (
               <button
                  type="button"
                  onClick={() => setPayLess(true)}
                  className="mx-auto text-[15px] font-bold text-[#8a7a5a] underline underline-offset-2 dark:text-[#c9b98f]"
               >
                  Pay less
               </button>
            )}
         </>
      );
      const partialPaidRow = partialPaid ? (
         <DoneRow>
            Paid ${formatCurrency(partialPaid.paidAmount)}
            <span className="block text-[14px] font-semibold opacity-80">${formatCurrency(partialPaid.remaining)} left</span>
         </DoneRow>
      ) : null;
      const overdueNote =
         isLoanOverdue(selectedLoan) && !clearsLoan ? (
            <p className="rounded-[14px] bg-[#fff7f7] px-3 py-2.5 text-[15px] font-bold text-md-red-600 dark:bg-[#3c171e]">
               Pay it all to unlock your account.
            </p>
         ) : null;
      // The gold Pay button, or "Sending… / Confirming…" while it runs.
      const payControls = isProcessing ? (
         <>
            <WaitRow>
               {pendingTxHash ? 'Confirming…' : activePaymentMethod === 'openfort' ? 'Sending…' : 'Approve it in your wallet'}
            </WaitRow>
            {explorerTxUrl ? (
               <a
                  href={explorerTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mx-auto text-[14px] font-bold text-[#6b4a00] underline dark:text-[#ffd36b]"
               >
                  View transaction
               </a>
            ) : null}
            {!pendingTxHash ? (
               <button
                  type="button"
                  onClick={() => {
                     cancelledRef.current = true;
                     repayInFlightRef.current = false;
                     setIsProcessing(false);
                     setPendingTxHash(null);
                  }}
                  className="mx-auto text-[14px] font-bold text-[#8a7a5a] underline underline-offset-2"
               >
                  Cancel
               </button>
            ) : null}
         </>
      ) : (
         <GoldButton disabled={isRepayDisabled} onClick={() => void handleRepay()}>
            {connectStatus === 'pending' ? 'Connecting…' : `Pay ${showPesos ? toPesos(payAmount) : `$${formatCurrency(payAmount)}`}`}
         </GoldButton>
      );
      // Tap-to-copy address with a one-line Base warning.
      const addressCard = repayWalletAddress ? (
         <div className="flex flex-col gap-2">
            <button
               type="button"
               onClick={handleCopyAddress}
               className={`flex min-h-[64px] w-full items-center justify-between gap-3 rounded-[16px] border-2 px-4 text-left transition active:scale-[0.99] ${
                  copiedAddress
                     ? 'border-[#2f9e44] bg-[#eafbef] dark:bg-[#12301e]'
                     : 'border-dashed border-[#e0c97a] bg-[#fffaf0] dark:border-[#4a3d1c] dark:bg-[#100d17]'
               }`}
            >
               <span className="truncate font-mono text-[22px] font-extrabold">{formatWalletAddressShort(repayWalletAddress)}</span>
               <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[15px] font-extrabold ${
                     copiedAddress ? 'bg-[#2f9e44] text-white' : 'bg-[#ffd75a] text-[#4a2a00]'
                  }`}
               >
                  {copiedAddress ? (
                     <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                  ) : (
                     <Copy className="size-4" aria-hidden="true" />
                  )}
                  {copiedAddress ? 'Copied' : 'Copy'}
               </span>
            </button>
            <p className="text-center text-[15px] font-extrabold text-[#b91c1c] dark:text-[#fca5a5]">⚠️ Base network only</p>
         </div>
      ) : null;
      // Last card of the app guide: watch their wallet until the money lands.
      const arrivalCheck =
         usdcBalance === null ? (
            <WaitRow>Checking your wallet…</WaitRow>
         ) : amountFunded ? (
            <>
               {effectiveJustFunded !== null ? (
                  <div className="overflow-hidden rounded-[20px] border border-[#16a34a] bg-white dark:bg-[#1a1524]">
                     <FundedCelebration amount={effectiveJustFunded} />
                  </div>
               ) : null}
               <DoneRow>${formatCurrency(usdcBalance)} USDC arrived</DoneRow>
               <GoldButton onClick={() => goTo('pay')}>Next · Pay</GoldButton>
            </>
         ) : (
            <Card>
               <StepHead image={CONNECT_HIPPOS.waiting} title="Waiting for your USDC" subtitle="Shows here by itself." />
               {usdcBalance >= 0.01 ? (
                  <div>
                     <div className="mb-2 flex items-center justify-between text-[15px] font-bold">
                        <span>${formatCurrency(usdcBalance)} arrived</span>
                        <span className="text-[#7a6a4f] dark:text-[#bfb29a]">of ${formatCurrency(payAmount)}</span>
                     </div>
                     <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#efe6cc] dark:bg-[#2a2335]">
                        <div
                           className="h-full rounded-full bg-[#2f9e44] transition-all duration-500"
                           style={{ width: `${Math.min(99, (usdcBalance / payAmount) * 100)}%` }}
                        />
                     </div>
                  </div>
               ) : null}
               <WaitRow>{usdcBalance >= 0.01 ? 'Waiting for the rest…' : 'Watching your wallet…'}</WaitRow>
               {usdcBalance >= 0.01 ? (
                  <SoftButton
                     onClick={() => {
                        setRepaymentAmount(formatCurrency(floorToCents(usdcBalance)));
                        goTo('pay');
                     }}
                  >
                     Pay ${formatCurrency(floorToCents(usdcBalance))} now instead
                  </SoftButton>
               ) : null}
            </Card>
         );
      // App tiles: logo + name, one tap picks it and moves on. (Moneybees left out: barely tapped,
      // no repayment traced to it — Nov 2026.)
      const tileIds: FundSourceId[] = inIndonesia
         ? [...INDONESIA_SOURCE_IDS]
         : (['gcrypto', 'pdax', 'coinsph', 'binance'] as const).filter((id) => !isPausedSource(id) && (id !== 'binance' || !inPhilippines));
      const tileLabel = (id: FundSourceId) => (id === 'gcrypto' ? 'GCash' : getFundSource(id).label);
      const tileLogo = (id: FundSourceId) => {
         const src = TILE_LOGO_SRC[id] ?? SOURCE_LOGO_SRC[id];
         return src ? (
            <img src={src} alt="" aria-hidden="true" className="size-12 rounded-[12px] object-contain" />
         ) : (
            <span className="grid size-12 place-items-center [&>svg]:size-9">{renderSourceLogo(id)}</span>
         );
      };

      return (
         <main className="repay-page min-h-screen bg-[#fffaf0] px-4 pb-32 pt-4 text-[#2b2116] dark:bg-[#100d17] dark:text-[#f5efe3]">
            <style>{repayPageCss}</style>
            <div className="mx-auto flex w-full max-w-[440px] flex-col gap-4">
               <header className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                     <button
                        type="button"
                        onClick={() => navigate(-1)}
                        aria-label="Go back"
                        className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[#6b4a00] shadow-[0_2px_0_#f0e6c8] dark:bg-[#1a1524] dark:text-[#ffd36b] dark:shadow-none"
                     >
                        <ArrowLeft className="size-5" aria-hidden="true" />
                     </button>
                     <span className="truncate text-[20px] font-extrabold tracking-[-0.01em]">Repay</span>
                  </div>
                  <button
                     type="button"
                     onClick={() => setShowHowToVideo(true)}
                     className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#ecdfb8] bg-white px-3 py-1.5 text-[13px] font-bold text-[#6b4a00] dark:border-[#4a3d1c] dark:bg-[#1c1710] dark:text-[#ffd36b]"
                  >
                     <PlayCircle className="size-4" aria-hidden="true" />
                     Watch how
                  </button>
               </header>

               {/* One progress bar at a time: the app guide shows its own. */}
               {quickPay || wizardStep === 'send' ? null : <RepayTrail step={wizardStep} onPick={goTo} />}

               {/* ── Enough USDC already: pay in one tap ───────────────────── */}
               {quickPay ? (
                  <>
                     {partialPaidRow}
                     <DoneRow>${formatCurrency(usdcBalance ?? 0)} USDC in your wallet</DoneRow>
                     {loanTiles}
                     {amountCard}
                     {rewardChip ? <div className="flex justify-center">{rewardChip}</div> : null}
                     {overdueNote}
                     {payControls}
                  </>
               ) : null}

               {/* ── 1. How much ─────────────────────────────────────────── */}
               {wizardStep === 'amount' && !quickPay ? (
                  <>
                     {partialPaidRow}
                     <StepHead image={CONNECT_HIPPOS.cashout} title="You pay" />
                     {loanTiles}
                     {amountCard}
                     <GoldButton disabled={!hasValidPayAmount} onClick={() => goTo('source')}>
                        Next
                     </GoldButton>
                  </>
               ) : null}

               {/* ── 2. Pick the app they'll get USDC from ──────────────── */}
               {wizardStep === 'source' ? (
                  <>
                     <DoneRow>Paying ${formatCurrency(payAmount)}</DoneRow>
                     <StepHead image="/hippos/thinking.png" title="Which app do you use?" />
                     {geoLoading ? (
                        <WaitRow>Loading…</WaitRow>
                     ) : (
                        <div className="grid grid-cols-2 gap-3">
                           {tileIds.map((id) => (
                              <button
                                 key={id}
                                 type="button"
                                 onClick={() => {
                                    selectFundSource(id);
                                    goTo('send');
                                 }}
                                 className="flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-[#f0e6c8] bg-white text-[17px] font-extrabold shadow-[0_3px_0_#f0e6c8] transition active:translate-y-[2px] active:shadow-none dark:border-[#2e2638] dark:bg-[#1a1524] dark:shadow-none"
                              >
                                 {tileLogo(id)}
                                 {tileLabel(id)}
                              </button>
                           ))}
                        </div>
                     )}
                     {backLink('amount')}
                  </>
               ) : null}

               {/* ── 3. Follow the app's steps, one card at a time ─────────── */}
               {wizardStep === 'send' ? (
                  <>
                     <StepHead
                        image="/hippos/hippo-wallet.png"
                        title={
                           amountShortfall !== null && amountShortfall > 0 ? `Add $${formatCurrency(amountShortfall)} USDC` : 'Add USDC'
                        }
                     />
                     {amountFunded ? (
                        arrivalCheck
                     ) : (
                        <AppGuideSteps
                           key={activeSource.id}
                           appId={activeSource.id}
                           appName={appName}
                           appLogo={renderSourceLogo(activeSource.id)}
                           path={FUND_SOURCE_PATHS[activeSource.id]}
                           buyTip={buyTip}
                           money={inIndonesia ? 'rupiah' : activeSource.id === 'binance' ? 'your money' : 'pesos'}
                           openApp={openSourceApp}
                           addressCard={addressCard}
                           finalStep={arrivalCheck}
                           memoryKey={repayGuideMemoryKey(selectedLoan.id, activeSource.id)}
                           onStep={(index, key) => trackRepay('repay_guide_step', { app: activeSource.id, step: key, index })}
                        />
                     )}
                     {backLink('source')}
                  </>
               ) : null}

               {/* ── 4. Pay the moo-lender ─────────────────────────────── */}
               {wizardStep === 'pay' ? (
                  <>
                     {partialPaid ? (
                        <>
                           {partialPaidRow}
                           <GoldButton
                              onClick={() => {
                                 setPartialPaid(null);
                                 setRepaymentAmount(formatCurrency(selectedRemaining));
                                 goTo('amount');
                              }}
                           >
                              Pay the rest
                           </GoldButton>
                        </>
                     ) : (
                        <>
                           <DoneRow>${formatCurrency(usdcBalance ?? 0)} USDC in your wallet</DoneRow>
                           <StepHead image={CONNECT_HIPPOS.approved} title="Pay your loan" />
                           <Card className="items-center !gap-2 py-5 text-center">
                              {bigMoney(payAmount)}
                              {clearsLoan ? (
                                 <span className="text-[15px] font-bold text-[#1f7a3d] dark:text-[#8fe3a8]">Clears your loan ✓</span>
                              ) : null}
                              <span className="text-[15px] font-bold text-[#7a6a4f] dark:text-[#bfb29a]">Moodeng fee: ₱0</span>
                           </Card>
                           {rewardChip ? <div className="flex justify-center">{rewardChip}</div> : null}
                           {overdueNote}
                           {usdcBalance !== null && !amountFunded ? (
                              <SoftButton onClick={() => goTo('source')}>Add ${formatCurrency(amountShortfall ?? 0)} first</SoftButton>
                           ) : (
                              payControls
                           )}
                           {!isProcessing ? backLink('amount') : null}
                        </>
                     )}
                  </>
               ) : null}

               <button
                  type="button"
                  onClick={() => openSupportChat('Repay')}
                  className="mx-auto mt-2 inline-flex items-center gap-1.5 text-[15px] font-bold text-[#8a7a5a] dark:text-[#c9b98f]"
               >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Stuck? Chat with us
               </button>
               {verifyModal}
            </div>
            {howToVideoModal}
         </main>
      );
   }

   return (
      <main className="repay-page min-h-screen bg-[linear-gradient(180deg,#fbfafd_0%,#ffffff_44%,#fbfafd_100%)] px-4 pb-32 pt-5 text-md-heading sm:px-6">
         {/* Custom range thumb for the repay-amount slider etc. (scoped to this page). */}
         <style>{repayPageCss}</style>
         <div className="mx-auto flex w-full max-w-[400px] flex-col gap-3">
            <header className="flex items-start justify-between gap-4">
               <div className="flex items-start gap-3">
                  <button
                     type="button"
                     onClick={() => navigate(-1)}
                     className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md-pill bg-md-neutral-100 text-md-primary-1200 shadow-md-card transition hover:bg-md-primary-100 focus:outline-none focus:ring-2 focus:ring-md-primary-500"
                     aria-label="Go back"
                  >
                     <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <div>
                     <h1 className="text-md-h3 font-semibold text-md-heading">Repay</h1>
                     <p className="mt-1 text-md-b2 text-md-neutral-1200">Choose a loan and enter an amount.</p>
                     <button
                        type="button"
                        onClick={() => setShowHowToVideo(true)}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-md-pill border border-md-primary-300 bg-md-primary-100 px-3 py-1.5 text-md-b3 font-semibold text-md-primary-1200 transition hover:bg-md-primary-300/40 focus:outline-none focus:ring-2 focus:ring-md-primary-300"
                     >
                        <PlayCircle className="h-4 w-4" aria-hidden="true" />
                        Watch how to repay
                     </button>
                  </div>
               </div>
               <UserAvatar alt={user.displayName ?? user.username ?? 'Profile'} size={48} className="shadow-md-card" />
            </header>

            {renderLoanPicker()}

            {selectedLoan && (isShortOnFunds || effectiveJustFunded !== null) ? (
               <section
                  className={`overflow-hidden rounded-md-xl border bg-white shadow-[0_12px_30px_rgba(79,70,229,0.10)] dark:bg-[#1a1240] ${effectiveJustFunded !== null ? 'border-[#16a34a]' : 'border-md-primary-300'}`}
               >
                  {effectiveJustFunded !== null ? (
                     <FundedCelebration amount={effectiveJustFunded} />
                  ) : (
                     <>
                        <button
                           type="button"
                           onClick={() => setShowAddFunds((open) => !open)}
                           aria-expanded={showAddFunds}
                           className="flex w-full items-center gap-3 bg-[linear-gradient(135deg,#f4f1ff_0%,#ffffff_60%)] px-4 py-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-300 dark:bg-none dark:bg-[#1e1535]"
                        >
                           <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md-pill bg-[linear-gradient(135deg,#7c5cff_0%,#4f46e5_100%)] text-white shadow-[0_4px_12px_rgba(79,70,229,0.35)]">
                              <Wallet className="h-5 w-5" aria-hidden="true" />
                           </span>
                           <span className="min-w-0 flex-1">
                              <span className="block text-md-b1 font-semibold text-md-heading">
                                 {isWalletEmpty ? 'Your wallet is empty' : 'Add funds to repay'}
                              </span>
                              <span className="mt-0.5 block text-md-b3 text-md-neutral-1200">
                                 {isWalletEmpty ? (
                                    <>
                                       Your Moodeng wallet has <span className="font-semibold text-[#d97706]">$0 USDC</span>. Add{' '}
                                       <span className="font-semibold text-md-primary-1200">
                                          ${formatCurrency(fundingShortfall ?? 0)} USDC
                                       </span>{' '}
                                       to repay.
                                    </>
                                 ) : hasPartialFunds ? (
                                    <>
                                       You have <span className="font-semibold text-[#d97706]">${formatCurrency(usdcBalance!)} USDC</span> —
                                       still need{' '}
                                       <span className="font-semibold text-md-primary-1200">
                                          ${formatCurrency(fundingShortfall ?? 0)} more
                                       </span>
                                       .
                                    </>
                                 ) : (
                                    <>
                                       You need{' '}
                                       <span className="font-semibold text-md-primary-1200">
                                          ${formatCurrency(fundingShortfall ?? 0)} more USDC
                                       </span>{' '}
                                       to repay.
                                    </>
                                 )}
                              </span>
                           </span>
                           <ChevronDown
                              className={`h-5 w-5 shrink-0 text-md-neutral-1200 transition-transform ${showAddFunds ? 'rotate-180' : ''}`}
                              aria-hidden="true"
                           />
                        </button>

                        {showAddFunds ? (
                           <div className="space-y-5 px-4 pb-5 pt-2">
                              {isWaltRepay ? (
                                 <>
                                    <WaltRepaySteps
                                       isPreview={usePreviewLoans}
                                       rupiahLeft={selectedRemainingIdr}
                                       usdLeft={selectedRemaining}
                                       onRecorded={refreshAfterWaltRepay}
                                    />
                                    <button
                                       type="button"
                                       onClick={() => setShowOtherWays((open) => !open)}
                                       aria-expanded={showOtherWays}
                                       className="flex w-full items-center justify-center gap-1 border-t border-[#ede9f8] pt-3 text-[13px] font-semibold text-[#6c3fe0] dark:border-[#2a1f4f]"
                                    >
                                       {locale === 'en' ? 'Other ways' : 'Cara lain'}
                                       <ChevronDown
                                          className={`h-4 w-4 transition-transform ${showOtherWays ? 'rotate-180' : ''}`}
                                          aria-hidden="true"
                                       />
                                    </button>
                                 </>
                              ) : null}
                              {!isWaltRepay || showOtherWays ? (
                                 <>
                                    {/* ── Step 1: Choose your source ────────────────── */}
                                    <div>
                                       <div className="mb-2 flex items-center gap-2">
                                          <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#6c3fe0] text-[11px] font-bold text-white">
                                             1
                                          </span>
                                          <p className="text-sm font-semibold text-[#1a1240] dark:text-white">Choose your source</p>
                                       </div>
                                       {renderSourcePicker()}
                                    </div>

                                    {/* ── Step 2: Copy your wallet address ─────────── */}
                                    {repayWalletAddress ? (
                                       <div>
                                          <div className="mb-2 flex items-center gap-2">
                                             <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#6c3fe0] text-[11px] font-bold text-white">
                                                2
                                             </span>
                                             <p className="text-sm font-semibold text-[#1a1240] dark:text-white">
                                                Copy your wallet address
                                             </p>
                                          </div>
                                          <p className="mb-3 text-xs text-[#6b6090] dark:text-[#a095c8]">
                                             {activeSource.id === 'moneybees' ? (
                                                <>
                                                   This is the same wallet your loan was sent to. Copy it — you'll share it with Moneybees
                                                   so they send your USDC here.
                                                </>
                                             ) : (
                                                <>
                                                   This is the same wallet your loan was sent to. Copy it — you'll paste it into{' '}
                                                   {activeSource.label} as the destination.
                                                </>
                                             )}
                                          </p>
                                          {renderAddressCard()}
                                       </div>
                                    ) : null}

                                    {/* ── Step 3: Open app and send ─────────────────── */}
                                    {repayWalletAddress && !geoLoading ? (
                                       <div>
                                          <div className="mb-2 flex items-center gap-2">
                                             <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#6c3fe0] text-[11px] font-bold text-white">
                                                3
                                             </span>
                                             <p className="text-sm font-semibold text-[#1a1240] dark:text-white">{activeSource.action}</p>
                                          </div>

                                          {renderSendSteps(fundingShortfall)}
                                       </div>
                                    ) : null}

                                    {/* ── Transfer status card ──────────────────────── */}
                                    {usdcBalance === null ? (
                                       <div className="flex items-center gap-3 rounded-xl bg-[#f3effe] px-4 py-3 dark:bg-[#1e1535]">
                                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#6c3fe0]" aria-hidden="true" />
                                          <span className="text-sm font-semibold text-[#3d1a8a] dark:text-[#c4b5fd]">
                                             Checking your balance…
                                          </span>
                                       </div>
                                    ) : hasEnoughToRepay ? (
                                       <div className="flex items-center gap-3 rounded-xl bg-[#dcfce7] px-4 py-3 dark:bg-[#052e16]">
                                          <Check className="h-4 w-4 shrink-0 text-[#16a34a]" aria-hidden="true" />
                                          <span className="text-sm font-semibold text-[#14532d] dark:text-[#86efac]">Funds ready</span>
                                       </div>
                                    ) : hasPartialFunds ? (
                                       <div className="rounded-xl bg-[#f3effe] px-4 py-3.5 dark:bg-[#1e1535]">
                                          <div className="mb-2 flex items-center justify-between text-[12px]">
                                             <span className="font-semibold text-[#3d1a8a] dark:text-[#c4b5fd]">
                                                ${formatCurrency(usdcBalance!)} USDC received
                                             </span>
                                             <span className="text-[#6b6090] dark:text-[#a095c8]">
                                                ${formatCurrency(selectedRemaining)} needed
                                             </span>
                                          </div>
                                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e0d9f8] dark:bg-[#2a1f4f]">
                                             <div
                                                className="h-full rounded-full bg-[#6c3fe0] transition-all duration-500"
                                                style={{ width: `${Math.min(99, (usdcBalance! / selectedRemaining) * 100)}%` }}
                                             />
                                          </div>
                                          <p className="mt-2.5 text-[11px] text-[#6b6090] dark:text-[#a095c8]">
                                             Tap{' '}
                                             <span className="font-semibold text-[#4a1fb8] dark:text-[#a78bfa]">
                                                Pay ${formatCurrency(usdcBalance!)}
                                             </span>{' '}
                                             below to pay now, or keep waiting for the rest to arrive.
                                          </p>
                                       </div>
                                    ) : (
                                       <div className="flex items-center gap-3 rounded-xl bg-[#f3effe] px-4 py-3.5 dark:bg-[#1e1535]">
                                          <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                                             <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#6c3fe0] opacity-25" />
                                             <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#6c3fe0]" />
                                          </div>
                                          <div>
                                             <p className="text-sm font-semibold text-[#3d1a8a] dark:text-[#c4b5fd]">
                                                Watching for your transfer
                                             </p>
                                             <p className="text-[11px] text-[#6b6090] dark:text-[#a095c8]">
                                                Detects automatically — usually under a minute
                                             </p>
                                          </div>
                                       </div>
                                    )}
                                 </>
                              ) : null}

                              {/* ── Help link ────────────────────────────────── */}
                              <div className="flex items-center justify-end px-0.5 text-[12px]">
                                 <button
                                    type="button"
                                    onClick={() => navigate('/support')}
                                    className="font-semibold text-[#6c3fe0] underline-offset-2 transition hover:underline"
                                 >
                                    Get help
                                 </button>
                              </div>
                           </div>
                        ) : null}
                     </>
                  )}
               </section>
            ) : null}

            {selectedLoan ? (
               <>
                  <section className="relative overflow-hidden rounded-md-xl border border-[#ede8fb] bg-white shadow-[0_8px_24px_rgba(96,16,210,0.07)] dark:border-[#3d2a60] dark:bg-[#1a1240]">
                     {isProcessing ? (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/85 px-6 text-center backdrop-blur-sm">
                           <Loader2 className="h-8 w-8 animate-spin text-md-primary-1200" aria-hidden="true" />
                           <div>
                              <p className="text-md-b1 font-semibold text-md-heading">
                                 {pendingTxHash ? 'Confirming on Base…' : 'Sending payment…'}
                              </p>
                              <p className="mt-1 text-md-b3 text-md-neutral-1200">
                                 {pendingTxHash
                                    ? 'Recording your repayment — hang tight.'
                                    : activePaymentMethod === 'openfort'
                                      ? 'Sending from your Instant Wallet — no confirmation needed.'
                                      : 'Approve the transaction in your wallet.'}
                              </p>
                           </div>
                           {explorerTxUrl ? (
                              <a
                                 href={explorerTxUrl}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="text-md-b3 font-semibold text-md-primary-1200 underline"
                              >
                                 View transaction
                              </a>
                           ) : null}
                           {/* Cancel only before broadcast (no hash yet): once it's confirming
                               on-chain the money has left and can't be recalled from here. */}
                           {!pendingTxHash ? (
                              <button
                                 type="button"
                                 onClick={() => {
                                    cancelledRef.current = true;
                                    repayInFlightRef.current = false;
                                    setIsProcessing(false);
                                    setPendingTxHash(null);
                                 }}
                                 className="mt-1 text-md-b3 font-semibold text-md-neutral-1200 underline underline-offset-2"
                              >
                                 Cancel
                              </button>
                           ) : null}
                        </div>
                     ) : null}
                     {partialPaid ? (
                        <div className="mb-3 flex items-center gap-2.5 rounded-md-input border border-md-green-100 bg-md-green-100/60 px-3 py-2.5">
                           <Check className="h-4 w-4 shrink-0 text-md-green-900" aria-hidden="true" />
                           <p className="text-md-b3 font-medium text-md-green-900">
                              Paid ${formatCurrency(partialPaid.paidAmount)} {partialPaid.coin} — ${formatCurrency(partialPaid.remaining)}{' '}
                              to go.
                           </p>
                        </div>
                     ) : null}

                     <div className="px-5 pt-5 pb-2 text-center">{renderAmountPicker(selectedLoan)}</div>

                     <div
                        className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-t px-5 pb-3 pt-3 text-md-b3 ${
                           isLoanOverdue(selectedLoan) || isLoanDueSoon(selectedLoan)
                              ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400'
                              : 'border-[#f5f3ff] text-md-neutral-1200'
                        }`}
                     >
                        <span
                           className={`inline-flex items-center gap-1.5 font-semibold ${isLoanDueSoon(selectedLoan) ? 'animate-pulse' : ''}`}
                        >
                           <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                           {isLoanOverdue(selectedLoan) ? 'Past due' : `${getDueCountdownCopy(selectedLoan)}`}
                        </span>
                        <span>Due {getDueDateShortCopy(selectedLoan)}</span>
                     </div>
                  </section>
               </>
            ) : (
               <section className="flex min-h-[430px] flex-col items-center justify-center px-6 text-center">
                  <h2 className="text-md-h5 font-semibold text-[#040033]">{emptyRepayState?.title ?? 'No repayments yet'}</h2>
                  <p className="mt-3 max-w-[320px] text-md-b2 font-medium leading-[21px] text-md-neutral-1000">
                     {emptyRepayState?.body ?? 'Your repayment activity will appear here once a moo-lender funds your first loan.'}
                  </p>
                  {emptyRepayState?.actionLabel && emptyRepayState.onAction ? (
                     <button
                        type="button"
                        onClick={emptyRepayState.onAction}
                        className="mt-5 inline-flex min-h-[56px] items-center justify-center rounded-[16px] bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 active:scale-[0.99]"
                     >
                        {emptyRepayState.actionLabel}
                     </button>
                  ) : null}
               </section>
            )}
            {verifyModal}
         </div>

         {howToVideoModal}
      </main>
   );
}
