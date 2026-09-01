import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AlertTriangle, ArrowLeft, Check, ChevronDown, Clock, Copy, ExternalLink, Loader2, ShieldCheck, TrendingUp, Wallet } from 'lucide-react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { erc20Abi } from 'viem';
import { useAccount, useConnect, useReadContract, useSwitchChain, useWatchContractEvent } from 'wagmi';

import { useBottomNavPrimaryAction } from '@/components/BottomNavActionContext';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { TOAST_TYPES } from '@/components/ToastSystem/types';
import UserAvatar from '@/components/UserAvatar';
import { useVerifyYourself } from '@/components/verification/VerifyYourselfModal';

import { useGeoCheck } from '@/hooks/useGeoCheck';
import { useLoanData } from '@/hooks/useLoanData';
import useWallet, { type PaymentMethod, toSettlementMethod, useActivePaymentMethod } from '@/hooks/useWallet';

import { parseDateSafely } from '@/utils/dateFormatters';
import { formatCurrency, toNumber } from '@/utils/decimalHelpers';

import { ALLOWED_CHAIN_ID, BASE_USDC_ADDRESS } from '@/config/wagmiConfig';
import { clearPendingBasePayment, registerPendingBasePayment } from '@/lib/basePayReconciliation';
import { ensureAllowedChain } from '@/lib/ensureAllowedChain';
import { getCreditLevelNumber, getNextCreditTier } from '@/config/creditTiers';
import { isUserVerified } from '@/lib/isUserVerified';
import { areWalletAddressesEqual, formatWalletAddressShort, getBaseWalletLockStatus } from '@/lib/walletProvider';
import { confirmLoanPayment, getUserLoans, PaymentNotConfirmedError } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { ERROR_CODES } from '@/types/errorCodes';
import { getToastKeyFromErrorCode } from '@/types/errorToastMapping';
import type { Loan } from '@/types/loanTypes';

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
   }
] as const;

type FundSourceId = (typeof fundSources)[number]['id'];

// Only the free/not-free distinction is shown to users now (0 = free, anything else = a small
// fee). The exact cents are no longer displayed — they vary and the exchange shows the real
// figure at withdrawal — but the values are kept here as the free-vs-small-fee signal.
const FUND_SOURCE_FEES: Record<FundSourceId, number | null> = {
   moneybees: null,
   coinsph: null,
   gcrypto: 0.08,
   pdax: 0.08,
   binance: 0.2
};

// Short pitch shown under the hero (primary) source so the recommendation explains itself.
// coinsph is the only entry that's ever actually rendered (renderHeroSource is only ever
// called with fundSources[0], i.e. coinsph) — the other entries are unused, kept from before
// Binance was removed from the hero slot.
const SOURCE_SUBTITLE: Partial<Record<FundSourceId, string>> = {
   coinsph: 'Recommended · lowest fees · buy USDC with PHP, cash out to bank or GCash',
   moneybees: "External option · you follow Moneybees' own process"
};

// Step-by-step path shown to the user. The exchanges are self-service apps; Moneybees is an
// external OTC service with no Moodeng integration — users drive Moneybees' own process
// directly from moneybees.ph.
const FUND_SOURCE_PATHS: Record<FundSourceId, string> = {
   moneybees: 'Visit moneybees.ph → follow their own process → share your wallet address → pay only after they confirm',
   coinsph: 'Transfer → Send Crypto → USDC → External Wallet → paste address → Base network → confirm',
   gcrypto: 'GCash app → GCrypto → USDCBASE → Withdraw',
   pdax: 'Wallet → USDCBASE → Withdraw → Paste wallet address',
   binance: 'Wallet → Withdraw → USDC → Network: Base → Paste wallet address'
};

const renderSourceLogo = (id: FundSourceId, isSelected = false) => {
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

const getDueCountdownCopy = (loan: Loan): string => {
   const dueDate = parseDateSafely(loan.dueDate);
   const totalMinutes = Math.round((dueDate.getTime() - Date.now()) / (1000 * 60));

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

const getDueDateShortCopy = (loan: Loan): string =>
   parseDateSafely(loan.dueDate).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
   });

const getDueTimeUtcCopy = (loan: Loan): string => {
   const dueDate = parseDateSafely(loan.dueDate);
   const hours = dueDate.getUTCHours();
   const minutes = dueDate.getUTCMinutes().toString().padStart(2, '0');
   const ampm = hours >= 12 ? 'PM' : 'AM';
   const displayHours = hours % 12 || 12;

   return `${displayHours}:${minutes} ${ampm} UTC`;
};

const isLoanOverdue = (loan: Loan): boolean => parseDateSafely(loan.dueDate).getTime() <= Date.now();

const isLoanDueSoon = (loan: Loan): boolean => {
   const totalHours = (parseDateSafely(loan.dueDate).getTime() - Date.now()) / (1000 * 60 * 60);
   return totalHours > 0 && totalHours < 24;
};

const getEstimatedTrustPoints = (loan: Loan, repaymentAmount: number): number => {
   if (repaymentAmount <= 0) return 0;

   const remainingAmount = getRemainingAmount(loan);
   if (remainingAmount <= 0) return 0;

   return Math.max(1, Math.round((Math.min(repaymentAmount, remainingAmount) / remainingAmount) * 10));
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
   const { allowed: geoAllowed, loading: geoLoading } = useGeoCheck(usePreviewLoans);
   const repayLoans = usePreviewLoans ? previewLoans : loans;
   const { hasFetched: hasCheckedRepayLoans, isLoading: isCheckingRepayLoans } = useLoanData({
      userId: user.id,
      enabled: Boolean(user.id) && !usePreviewLoans
   });

   const activeLoans = useMemo(
      () =>
         repayLoans
            .filter((loan) => loan.loanStatus === 'Lent' && loan.repaymentStatus !== 'Paid' && getRemainingAmount(loan) > 0)
            .sort((a, b) => parseDateSafely(a.dueDate).getTime() - parseDateSafely(b.dueDate).getTime()),
      [repayLoans]
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
   } | null>(null);
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
   const [fundSource, setFundSource] = useState<FundSourceId>('coinsph');
   const [copiedAddress, setCopiedAddress] = useState(false);
   // The two recommended sources (Moneybees, Coins.ph) show by default; GCrypto/PDAX stay
   // collapsed so a first-timer isn't asked to evaluate four exchanges at once.
   const [showMoreSources, setShowMoreSources] = useState(false);
   // Records which loan crossed short→funded so we can show an explicit "money arrived"
   // confirmation. Tying it to the loan id (rather than a bare boolean) means it clears
   // itself on loan switch and never flags borrowers who already had enough on arrival.
   // In preview mode, ?funded=1 mocks a fully-funded wallet so the repay-ready state is visible.
   const previewFunded = usePreviewLoans && new URLSearchParams(location.search).get('funded') === '1';
   const previewArriving = usePreviewLoans && new URLSearchParams(location.search).get('arriving') === '1';
   // Tracks when the borrower was previously short so we can detect the short→funded transition
   // and show a brief "funds received" celebration before revealing the repay section.
   // shortLoanIdRef pins the detection to a specific loan so switching to a different loan
   // (one they already have enough for) doesn't misfire the celebration.
   const wasShortRef = useRef(false);
   const shortLoanIdRef = useRef<string | null>(null);
   const [justFunded, setJustFunded] = useState<number | null>(null);
   const effectiveJustFunded = previewArriving ? 121 : justFunded;
   const activeSource = fundSources.find((source) => source.id === fundSource) ?? fundSources[0];

   // Compact source button used for Coins.ph and the "Other options" exchanges.
   // Fee tag sits next to the label; selection is conveyed by border + fill alone (no checkmark).
   const renderSourcePill = (source: (typeof fundSources)[number]) => {
      const isSelected = fundSource === source.id;
      const sourceFee = FUND_SOURCE_FEES[source.id];

      return (
         <button
            type="button"
            key={source.id}
            onClick={() => setFundSource(source.id)}
            aria-pressed={isSelected}
            style={{ touchAction: 'manipulation' }}
            className={`flex min-h-[44px] w-full cursor-pointer items-center gap-2 rounded-2xl px-3.5 py-1.5 text-md-b2 font-semibold transition active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-300 ${
               isSelected
                  ? 'border-2 border-[#6c3fe0] bg-[#f3effe] text-[#1a1240] dark:bg-[#2a1740] dark:text-white'
                  : 'border border-[#e9e3f8] bg-white text-[#6b6090] hover:border-md-primary-300 dark:border-[#3d2a60] dark:bg-[#1e1535] dark:text-[#a095c8]'
            }`}
         >
            {renderSourceLogo(source.id, false)}
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
               {source.label}
               {sourceFee === 0 ? (
                  <span className="rounded-full bg-[#dcfce7] px-1.5 py-0.5 text-[10px] font-bold text-[#16a34a] dark:bg-[#052e16]">
                     Free
                  </span>
               ) : (
                  <span className="whitespace-nowrap rounded-full bg-[#ede9f8] px-1.5 py-0.5 text-[10px] font-bold text-[#6b6090] dark:bg-[#2a1f4f] dark:text-[#a095c8]">
                     Small fee
                  </span>
               )}
            </span>
         </button>
      );
   };

   // Prominent, full-width primary source — always Coins.ph (fundSources[0]), for everyone.
   // Fee badge sits inline with the name; selection is conveyed by border + fill alone (no checkmark).
   const renderHeroSource = (source: (typeof fundSources)[number]) => {
      const isSelected = fundSource === source.id;
      const sourceFee = FUND_SOURCE_FEES[source.id];
      const subtitle = SOURCE_SUBTITLE[source.id];

      return (
         <button
            type="button"
            onClick={() => setFundSource(source.id)}
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
                        Small fee
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
   const { open: openVerify, modal: verifyModal } = useVerifyYourself('repay');
   const hasCompletedBaseWalletSetup = baseWalletLock.isConfirmedBorrowerWallet;
   const emptyRepayState = !selectedLoan
      ? !isWorldIdVerified && !hasCompletedBaseWalletSetup
         ? {
              actionLabel: 'Start Setup',
              body: 'Verify yourself and add a Base Wallet before requesting loans. Repayments will show here after a lender funds your first loan.',
              onAction: () => navigate('/onboarding/welcome', { state: { returnTo: 'repay' } }),
              title: 'Finish setup to start borrowing'
           }
         : !isWorldIdVerified
           ? {
                actionLabel: 'Verify Yourself',
                body: 'Your Base Wallet is added. Complete verification before requesting loans. Repayments will show here after funding.',
                onAction: openVerify,
                title: 'Verify yourself to borrow'
             }
           : !hasCompletedBaseWalletSetup
             ? {
                  actionLabel: 'Add Base Wallet',
                  body: 'You are verified. Add a Base Wallet so loans and repayments can stay tied to your Moodeng account.',
                  onAction: () => navigate('/onboarding/wallet', { state: { returnTo: 'repay' } }),
                  title: 'Add Base Wallet to borrow'
               }
             : {
                  actionLabel: 'Request a loan',
                  body: 'Your repayment activity will appear here once a lender funds your first loan.',
                  onAction: () => navigate('/request-board', { state: { openLoanRequest: true } }),
                  title: 'No repayments yet'
               }
      : null;

   const handleSelectLoan = (loanId: string, e: React.MouseEvent<HTMLButtonElement>) => {
      (e.currentTarget as HTMLButtonElement).blur();
      setSelectedLoanId(loanId);
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
   // add-funds steps and progress bar are visible without a real wallet.
   const usdcBalance = usePreviewLoans
      ? previewFunded
         ? 130
         : 18.4
      : typeof usdcBalanceRaw === 'bigint'
        ? Number(usdcBalanceRaw) / 1e6
        : null;
   const fundingShortfall = usdcBalance !== null ? Math.max(0, Math.round((selectedRemaining - usdcBalance) * 100) / 100) : null;
   const hasEnoughToRepay = usdcBalance !== null && usdcBalance >= selectedRemaining - 0.005;
   const isShortOnFunds = fundingShortfall !== null && fundingShortfall > 0;
   const hasPartialFunds = usdcBalance !== null && usdcBalance > 0 && isShortOnFunds;
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
         setFundSource((current) => (current === 'binance' ? 'coinsph' : current));
      }
   }, [geoAllowed, geoLoading]);

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
      if (!showAddFunds || repaymentAmount) return;
      if (hasEnoughToRepay) {
         setRepaymentAmount(formatCurrency(selectedRemaining));
      } else if (hasPartialFunds && usdcBalance !== null) {
         setRepaymentAmount(formatCurrency(usdcBalance));
      }
   }, [showAddFunds, hasEnoughToRepay, hasPartialFunds, usdcBalance, repaymentAmount, selectedRemaining]);

   const handleRepay = useCallback(async () => {
      if (!selectedLoan || isProcessing || repayInFlightRef.current) {
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

      // Only the wagmi path needs the chain guard up front; Base Pay switches to Base itself.
      if (method === 'wallet' && !(await ensureAllowedChain(account.chainId, switchChainAsync))) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.NETWORK_REQUIRED));
         return;
      }

      repayInFlightRef.current = true;
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

         // Snapshot the credit limit before the repayment so we can tell if this payoff triggered
         // a level-up (updateLoanStatus raises it server-side + refetches the user).
         const prevCreditLimit = reduxStore.getState().auth.user?.cs ?? 0;

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
                  repaidAmount: newRepaidAmount,
                  repaymentStatus: newRepaymentStatus
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
         const confirmedLoan = await dispatch(
            confirmLoanPayment({
               loanId: selectedLoan.id,
               hash: outcome.hash,
               method: toSettlementMethod(method),
               action: 'repay'
            })
         ).unwrap();
         // DB write landed — the reconciler has nothing left to finish for this payment.
         clearPendingBasePayment(outcome.hash);
         await dispatch(getUserLoans({ userId: user.id })).unwrap();
         setRepaymentAmount('');
         const serverFullyRepaid = confirmedLoan.repaymentStatus === 'Paid';
         if (cancelledRef.current) {
            // Borrower backed out of the overlay — the payment still recorded above, but don't
            // slam the full-screen payoff / partial UI over them. The success toast still confirms it.
         } else if (serverFullyRepaid) {
            // confirmLoanPayment refetched the user, so the store now holds any raised limit.
            const newCreditLimit = reduxStore.getState().auth.user?.cs ?? 0;
            const leveledUp = newCreditLimit > prevCreditLimit;
            setShowCompletionDetails(false);
            setCompletion({
               reason: selectedLoan.reason || 'your loan',
               paidAmount: toNumber(selectedLoan.totalRepaymentAmount),
               coin: transferCoin,
               trustPoints: earnedTrustPoints,
               creditLevelUp: leveledUp ? { toLevel: getCreditLevelNumber(newCreditLimit), newLimit: newCreditLimit } : null
            });
         } else {
            // Partial payment: the loan stays active, so acknowledge it inline instead of
            // the full-payoff screen.
            const remainingAfter = Math.max(0, toNumber(selectedLoan.totalRepaymentAmount) - toNumber(confirmedLoan.repaidAmount));
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
         if (error instanceof PaymentNotConfirmedError) {
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
      usePreviewLoans
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

   useBottomNavPrimaryAction(bottomNavRepayAction);

   // Geo no longer gates the page — anyone (including Filipinos abroad) can repay. The local
   // rails (Coins.ph, Moneybees, GCrypto, PDAX) are always shown; `inPhilippines` only decides
   // whether Binance is ALSO offered (it's excluded specifically for users detected IN the
   // Philippines, where Binance doesn't operate — see the fundSources comment above). We don't
   // assume a location while the check is still resolving — the source list shows a loader
   // until `geoLoading` clears.
   const inPhilippines = geoAllowed;

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

   if (completion) {
      const hasMoreLoans = activeLoans.length > 0;

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
                        Trust Points +{completion.trustPoints}
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

   return (
      <main className="repay-page min-h-screen bg-[linear-gradient(180deg,#fbfafd_0%,#ffffff_44%,#fbfafd_100%)] px-4 pb-32 pt-5 text-md-heading sm:px-6">
         {/* Custom range thumb for the repay-amount slider (scoped to this page). */}
         <style>{`
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
         `}</style>
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
                  </div>
               </div>
               <UserAvatar alt={user.displayName ?? user.username ?? 'Profile'} size={48} className="shadow-md-card" />
            </header>

            {activeLoans.length > 1 ? (
               <section aria-labelledby="loan-picker-title">
                  <p
                     id="loan-picker-title"
                     className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6b6090] dark:text-[#a095c8]"
                  >
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
                              <p className="text-lg font-bold text-[#1a1240] dark:text-white">
                                 ${formatCurrency(getRemainingAmount(loan))}
                              </p>
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
            ) : null}

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
                              <span className="block text-md-b1 font-semibold text-md-heading">Add funds to repay</span>
                              <span className="mt-0.5 block text-md-b3 text-md-neutral-1200">
                                 {hasPartialFunds ? (
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
                              {/* ── Step 1: Choose your source ────────────────── */}
                              <div>
                                 <div className="mb-2 flex items-center gap-2">
                                    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#6c3fe0] text-[11px] font-bold text-white">
                                       1
                                    </span>
                                    <p className="text-sm font-semibold text-[#1a1240] dark:text-white">Choose your source</p>
                                 </div>
                                 {geoLoading ? (
                                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#6b6090] dark:text-[#a095c8]">
                                       <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                       Loading your options…
                                    </div>
                                 ) : (
                                    <>
                                       <p className="mb-3 text-xs text-[#6b6090]">
                                          Pick where you'll buy or withdraw USDC.{' '}
                                          <span className="font-semibold text-[#6c3fe0]">Coins.ph</span> works well for most people
                                          {!inPhilippines ? (
                                             <>
                                                {' '}
                                                — and works the same whether you're in the Philippines or traveling.{' '}
                                                <span className="font-semibold text-[#6c3fe0]">Binance</span> is also available under
                                                "Other options".
                                             </>
                                          ) : (
                                             '.'
                                          )}
                                       </p>

                                       {renderHeroSource(fundSources[0])}

                                       <div className="mt-1.5">{renderSourcePill(fundSources[1])}</div>

                                       {(() => {
                                          // Local rails always show. Binance is added here ONLY for users detected
                                          // outside the Philippines (see the fundSources comment above for why) — it's
                                          // an added option abroad, never a replacement for the local rails.
                                          const otherSources = fundSources.filter(
                                             (source) =>
                                                source.id === 'gcrypto' || source.id === 'pdax' || (source.id === 'binance' && !inPhilippines)
                                          );
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
                                                   <ChevronDown
                                                      className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                                                      aria-hidden="true"
                                                   />
                                                </button>

                                                {expanded ? (
                                                   <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                                                      {otherSources.map((source) => renderSourcePill(source))}
                                                   </div>
                                                ) : null}
                                             </>
                                          );
                                       })()}
                                       <p className="mt-2 text-xs text-[#6b6090] dark:text-[#a095c8]">
                                          You can repay from a wallet, an exchange, a P2P platform, or a local crypto service — whatever is
                                          available in your country.{' '}
                                          <button
                                             type="button"
                                             onClick={() => navigate('/support/guides/repaying-your-loan')}
                                             className="font-semibold text-[#6c3fe0] underline underline-offset-2"
                                          >
                                             Learn more
                                          </button>
                                       </p>
                                    </>
                                 )}
                              </div>

                              {/* ── Step 2: Copy your wallet address ─────────── */}
                              {repayWalletAddress ? (
                                 <div>
                                    <div className="mb-2 flex items-center gap-2">
                                       <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#6c3fe0] text-[11px] font-bold text-white">
                                          2
                                       </span>
                                       <p className="text-sm font-semibold text-[#1a1240] dark:text-white">Copy your wallet address</p>
                                    </div>
                                    <p className="mb-3 text-xs text-[#6b6090] dark:text-[#a095c8]">
                                       {activeSource.id === 'moneybees' ? (
                                          <>
                                             This is the same wallet your loan was sent to. Copy it — you'll share it with Moneybees so they
                                             send your USDC here.
                                          </>
                                       ) : (
                                          <>
                                             This is the same wallet your loan was sent to. Copy it — you'll paste it into{' '}
                                             {activeSource.label} as the destination.
                                          </>
                                       )}
                                    </p>
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
                                          <p
                                             className={`text-xs font-semibold ${copiedAddress ? 'text-[#16a34a]' : 'text-[#6c3fe0] dark:text-[#c4b5fd]'}`}
                                          >
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
                                             {activeSource.id === 'moneybees'
                                                ? 'Now open Moneybees below →'
                                                : 'Now paste it into the app below →'}
                                          </p>
                                       )}
                                    </button>
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

                                    {/* Instruction card */}
                                    {activeSource.id === 'moneybees' ? (
                                       <div className="mb-3 rounded-xl bg-[#f3effe] px-4 py-3.5 dark:bg-[#1e1535]">
                                          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-[#6c3fe0]">
                                             How it works
                                          </p>
                                          <div className="space-y-2">
                                             {(
                                                [
                                                   'Visit moneybees.ph and follow their own process',
                                                   'They handle ID checks and the rate directly with you'
                                                ] as const
                                             ).map((step, i) => (
                                                <div key={i} className="flex items-start gap-2.5">
                                                   <span className="mt-0.5 flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full bg-[#6c3fe0] text-[9px] font-bold leading-none text-white">
                                                      {String.fromCharCode(97 + i)}
                                                   </span>
                                                   <span className="text-[12px] font-medium leading-snug text-[#3d1a8a] dark:text-[#c4b5fd]">
                                                      {step}
                                                   </span>
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
                                             Moneybees is an external service — you transact with them directly; Moodeng isn&rsquo;t part of
                                             the transaction.
                                          </p>
                                       </div>
                                    ) : (
                                       <div className="mb-3 rounded-xl bg-[#f3effe] px-4 py-3.5 dark:bg-[#1e1535]">
                                          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#6c3fe0]">
                                             In {activeSource.label}
                                          </p>
                                          <p className="text-[12px] font-semibold leading-relaxed text-[#1a1240] dark:text-white">
                                             {FUND_SOURCE_PATHS[activeSource.id]}
                                          </p>
                                          <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-[#ede9f8] px-2.5 py-1.5 dark:bg-[#2a1f4f]">
                                             <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#6c3fe0]" aria-hidden="true" />
                                             {activeSource.id === 'binance' || activeSource.id === 'coinsph' ? (
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
                                       </div>
                                    )}

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
                                       className="inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-md-xl bg-[linear-gradient(135deg,#5b21d6_0%,#7c3aed_100%)] text-md-b2 font-semibold text-white shadow-[0_4px_14px_rgba(108,63,224,0.35)] active:scale-[0.98]"
                                    >
                                       {activeSource.action}
                                       <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                    </button>

                                    {/* Fee attribution — only for paid sources */}
                                    {(() => {
                                       const fee = FUND_SOURCE_FEES[activeSource.id];
                                       if (fee === 0) return null;
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
                                 </div>
                              ) : null}

                              {/* ── Transfer status card ──────────────────────── */}
                              {usdcBalance === null ? (
                                 <div className="flex items-center gap-3 rounded-xl bg-[#f3effe] px-4 py-3 dark:bg-[#1e1535]">
                                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#6c3fe0]" aria-hidden="true" />
                                    <span className="text-sm font-semibold text-[#3d1a8a] dark:text-[#c4b5fd]">Checking your balance…</span>
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
                                      ? 'Sending from your instant wallet — no confirmation needed.'
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

                     <div className="px-5 pt-5 pb-2 text-center">
                        {isLoanOverdue(selectedLoan) ? (
                           <div className="mb-3 flex items-start gap-2.5 rounded-md-input border border-[#f4d2d2] bg-[#fff7f7] px-3 py-2.5 text-left dark:border-[#68303a] dark:bg-[#3c171e]">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-md-red-600" aria-hidden="true" />
                              <p className="text-md-b3 font-medium text-md-red-600">
                                 Paying less than the full ${formatCurrency(selectedRemaining)} reduces what you owe, but your account stays
                                 restricted until this loan is fully repaid.
                              </p>
                           </div>
                        ) : null}

                        <p className="mb-1.5 text-xs font-medium text-[#6b6090] dark:text-[#a095c8]">You're paying</p>
                        <div className="flex items-end justify-center gap-2 mb-1">
                           {/* Invisible mirror of the unit so the big number is OPTICALLY centered,
                            not just the number+unit group (which pulls the number left). */}
                           <span className="invisible mb-0.5 text-sm font-semibold" aria-hidden="true">
                              {selectedLoan.coin || 'USDC'}
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
                                 <span
                                    className="invisible whitespace-pre text-4xl font-bold tracking-tight leading-none"
                                    aria-hidden="true"
                                 >
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
                           <span className="mb-0.5 text-sm font-semibold text-[#6b6090]">{selectedLoan.coin || 'USDC'}</span>
                        </div>
                        {validPreviewPayment <= 0 ? (
                           <p className="text-xs text-[#6b6490]">of ${formatCurrency(selectedRemaining)} remaining</p>
                        ) : validPreviewPayment >= selectedRemainingRounded ? (
                           <p className="text-xs font-semibold text-md-green-900">Clears this loan ✓</p>
                        ) : (
                           <p className="text-xs text-[#6b6090]">
                              leaves{' '}
                              <span className="font-semibold text-[#6010d2]">
                                 ${formatCurrency(Math.max(0, selectedRemaining - validPreviewPayment))}
                              </span>{' '}
                              remaining
                           </p>
                        )}
                        {validPreviewPayment > 0 && !isLoanOverdue(selectedLoan) && estimatedTrustPoints > 0 ? (
                           <span className="trust-badge mt-3 mb-2 inline-flex items-center gap-1.5 rounded-md-pill border border-[#e9e3f8] bg-[#f0ebff] px-3 py-1 text-md-b3 font-semibold text-[#6c3fe0]">
                              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />+{estimatedTrustPoints} Trust Points
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
                                    <span
                                       className={`text-xs font-bold leading-none ${isQuickSelected ? 'text-[#1a1240]' : 'text-[#6b6090]'}`}
                                    >
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
                     </div>

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
                        <span>
                           Due {getDueDateShortCopy(selectedLoan)} · {getDueTimeUtcCopy(selectedLoan)}
                        </span>
                     </div>
                  </section>
               </>
            ) : (
               <section className="flex min-h-[430px] flex-col items-center justify-center px-6 text-center">
                  <h2 className="text-md-h5 font-semibold text-[#040033]">{emptyRepayState?.title ?? 'No repayments yet'}</h2>
                  <p className="mt-3 max-w-[320px] text-md-b2 font-medium leading-[21px] text-md-neutral-1000">
                     {emptyRepayState?.body ?? 'Your repayment activity will appear here once a lender funds your first loan.'}
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
      </main>
   );
}
