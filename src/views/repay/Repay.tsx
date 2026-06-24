import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AlertTriangle, ArrowLeft, Check, ChevronDown, Clock, Copy, ExternalLink, Loader2, ShieldCheck, Wallet } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { erc20Abi } from 'viem';
import { useAccount, useConnect, useReadContract } from 'wagmi';

import { useBottomNavPrimaryAction } from '@/components/BottomNavActionContext';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { TOAST_TYPES } from '@/components/ToastSystem/types';
import UserAvatar from '@/components/UserAvatar';
import { useVerifyYourself } from '@/components/verification/VerifyYourselfModal';

import { useLoanData } from '@/hooks/useLoanData';
import useWallet from '@/hooks/useWallet';

import { parseDateSafely } from '@/utils/dateFormatters';
import { formatCurrency, toNumber } from '@/utils/decimalHelpers';

import { ALLOWED_CHAIN_ID, BASE_USDC_ADDRESS } from '@/config/wagmiConfig';
import {
   formatWalletAddressShort,
   getBaseAccountConnector,
   getBaseWalletLockStatus,
   isBaseWalletReadyForRepayment,
   isConnectedToLockedBaseWallet
} from '@/lib/walletProvider';
import { isUserVerified } from '@/lib/isUserVerified';
import { getUserLoans, updateLoanStatus } from '@/store/slices/loanSlice';
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
const fundSources = [
   { id: 'binance', label: 'Binance', action: 'Open Binance', href: 'https://www.binance.com/en/my/wallet/account/main/withdrawal/crypto/USDC' },
   { id: 'pdax', label: 'PDAX', action: 'Open PDAX', href: 'https://www.pdax.ph' },
   { id: 'moneybees', label: 'Moneybees', action: 'Find Moneybees', href: 'https://www.moneybees.ph' }
] as const;

type FundSourceId = (typeof fundSources)[number]['id'];

const renderSourceLogo = (id: FundSourceId) => {
   if (id === 'binance') {
      return (
         <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" fill="#F0B90B" />
            <path
               d="M5.5 6.5 8 4l2.5 2.5-1 1L8 6 6.5 7.5l-1-1Zm-1.5 1.5L8 4l4 4-1.5 1.5L8 7 5.5 9.5 4 8Zm3.5 3.5L5.5 9.5l1-1L8 10l1.5-1.5 1 1L8 12Z"
               fill="#fff"
            />
         </svg>
      );
   }
   if (id === 'pdax') {
      return <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-md-pill bg-[#0bb5a3] text-[9px] font-bold text-white">P</span>;
   }
   return <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-md-pill bg-[#f5a623] text-[9px] font-bold text-white">M</span>;
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

export default function Repay() {
   const navigate = useNavigate();
   const location = useLocation();
   const dispatch = useDispatch<AppDispatch>();
   const { showToast, showToastByConfig } = useToast();
   const { Transfer } = useWallet();
   const account = useAccount();
   const { connectAsync, connectors, status: connectStatus } = useConnect();

   const user = useSelector((state: RootState) => state.auth.user);
   const loans = useSelector((state: RootState) => state.loans.loans.gloans);
   const usePreviewLoans = shouldUsePreviewLoans(location.search, location.pathname);
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
   const [completion, setCompletion] = useState<{ reason: string; paidAmount: number; coin: string; trustPoints: number } | null>(null);
   // Acknowledge a partial payment inline (the loan stays active). Shown until the borrower's
   // next interaction so there's no timer to leak; full payoffs use `completion` instead.
   const [partialPaid, setPartialPaid] = useState<{ paidAmount: number; remaining: number; coin: string } | null>(null);
   // The on-chain transfer hash, set the moment Transfer resolves. Drives the "Sending" →
   // "Confirming" copy on the in-card processing overlay and the explorer link.
   const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);
   // Top-of-screen, non-custodial "add funds" helper, surfaced only when the borrower is
   // short on USDC. It shows their own Base Account address + QR and watches their public
   // on-chain balance — Moodeng never receives or forwards the money.
   const [showAddFunds, setShowAddFunds] = useState(true);
   const [fundSource, setFundSource] = useState<FundSourceId>('binance');
   const [copiedAddress, setCopiedAddress] = useState(false);
   const activeSource = fundSources.find((source) => source.id === fundSource) ?? fundSources[0];
   const amountInputRef = useRef<HTMLInputElement>(null);
   // Synchronous re-entrancy guard. `isProcessing` is React state, so on a fast double-tap
   // both calls read the stale `false` and each fires its own Transfer — opening a second
   // Base Account signing popup that errors ("Something went wrong") since the request is
   // already in flight. A ref flips immediately, so the second tap is dropped.
   const repayInFlightRef = useRef(false);
   // Set when the borrower taps Pay Now while still disconnected. Once the wallet reports
   // connected, an effect resumes the repayment automatically so connecting and paying are
   // a single intent rather than two separate taps.
   const pendingRepayRef = useRef(false);

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
      selectedRemainingRounded > 0 ? Math.min(100, (Math.min(parsedRepaymentAmount, selectedRemainingRounded) / selectedRemainingRounded) * 100) : 0;
   const validPreviewPayment =
      selectedLoan && parsedRepaymentAmount > 0 ? Math.min(parsedRepaymentAmount, selectedRemainingRounded) : 0;
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
   const baseAccountConnector = useMemo(() => getBaseAccountConnector(connectors), [connectors]);
   const isUsingLockedBaseWallet = isConnectedToLockedBaseWallet({
      connectedAddress: account.address,
      connectorId: account.connector?.id,
      connectorName: account.connector?.name,
      lockedAddress: baseWalletLock.address
   });
   const canRepayWithConnectedBaseWallet = isBaseWalletReadyForRepayment({
      connectedAddress: account.address,
      connectorId: account.connector?.id,
      connectorName: account.connector?.name,
      wallet: user
   });
   const isWorldIdVerified = isUserVerified(user);
   const { open: openVerify, modal: verifyModal } = useVerifyYourself('repay');
   const hasCompletedBaseWalletSetup = baseWalletLock.isConfirmedBase;
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

   const handleSelectLoan = (loanId: string) => {
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
   const { data: usdcBalanceRaw } = useReadContract({
      abi: erc20Abi,
      address: BASE_USDC_ADDRESS,
      functionName: 'balanceOf',
      args: repayWalletAddress ? [repayWalletAddress as `0x${string}`] : undefined,
      chainId: ALLOWED_CHAIN_ID,
      query: {
         enabled: Boolean(repayWalletAddress) && Boolean(selectedLoan) && !usePreviewLoans,
         refetchInterval: 12000
      }
   });
   // USDC has 6 decimals. In the preview host, mock a partial balance so the add-funds card,
   // progress bar, and "need more" state are visible without a real wallet.
   const usdcBalance = usePreviewLoans ? 18.4 : typeof usdcBalanceRaw === 'bigint' ? Number(usdcBalanceRaw) / 1e6 : null;
   const fundingShortfall = usdcBalance !== null ? Math.max(0, Math.round((selectedRemaining - usdcBalance) * 100) / 100) : null;
   const hasEnoughToRepay = usdcBalance !== null && usdcBalance >= selectedRemaining - 0.005;
   const isShortOnFunds = fundingShortfall !== null && fundingShortfall > 0;

   // When we learn the borrower doesn't hold enough USDC to repay, surface the Binance
   // top-up helper automatically so the next step is visible without hunting for it. Runs
   // only when the shortfall state flips or the loan changes, so a manual close stays closed.
   useEffect(() => {
      if (isShortOnFunds) {
         setShowAddFunds(true);
      }
   }, [isShortOnFunds, selectedLoanId]);

   // Once the borrower's top-up lands, pre-fill the full remaining so the existing Pay Now
   // arms itself — they just tap to pay. Only when the add-funds helper is open and they
   // haven't already typed an amount, so partial-payers keep control.
   useEffect(() => {
      if (showAddFunds && hasEnoughToRepay && !repaymentAmount) {
         setRepaymentAmount(formatCurrency(selectedRemaining));
      }
   }, [showAddFunds, hasEnoughToRepay, repaymentAmount, selectedRemaining]);

   const handleRepay = useCallback(async () => {
      if (!selectedLoan || isProcessing || repayInFlightRef.current) {
         return;
      }

      // Connecting the Base wallet is a prerequisite, not a separate task. If the borrower
      // taps Pay Now while disconnected, open the connect popup and arm the auto-continue so
      // the payment resumes by itself once connected — a single intent, not two taps.
      if (!account.isConnected) {
         setCompletion(null);

         if (!baseWalletLock.hasStoredWallet) {
            navigate('/onboarding/wallet', { state: { returnTo: 'repay' } });
            return;
         }

         if (!baseAccountConnector) {
            showToast(
               TOAST_TYPES.ERROR,
               'Base Account unavailable',
               'Moodeng could not open Base Account. Refresh and try again.',
               undefined,
               undefined
            );
            return;
         }

         // Only auto-resume into a payment when there is a valid amount to pay.
         pendingRepayRef.current = !amountError && parsedRepaymentAmount > 0;

         try {
            await connectAsync({ connector: baseAccountConnector });
         } catch {
            // Borrower dismissed or the connection failed — don't auto-pay.
            pendingRepayRef.current = false;
         }
         return;
      }

      if (amountError || parsedRepaymentAmount <= 0) {
         return;
      }

      if (!canRepayWithConnectedBaseWallet) {
         showToast(
            TOAST_TYPES.ERROR,
            baseWalletLock.hasStoredWallet ? 'Connect your locked Base wallet' : 'Add a Base Account',
            baseWalletLock.hasStoredWallet
               ? `Repayments must come from ${formatWalletAddressShort(baseWalletLock.address)} so your repayment history stays tied to the right wallet.`
               : 'Add a Base Account before repaying so your repayment history stays tied to the right wallet.',
            undefined,
            undefined
         );
         return;
      }

      if (!isUsingLockedBaseWallet) {
         showToast(
            TOAST_TYPES.ERROR,
            'Connect your locked Base wallet',
            `Repayments must come from ${formatWalletAddressShort(baseWalletLock.address)} so your repayment history stays tied to the right wallet.`,
            undefined,
            undefined
         );
         return;
      }

      if (account.chain?.id !== ALLOWED_CHAIN_ID) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.NETWORK_REQUIRED));
         return;
      }

      repayInFlightRef.current = true;
      setIsProcessing(true);

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
         const transactionHash = await Transfer(
            selectedLoan.lenderWallet || '',
            effectiveRepayment.toString(),
            selectedLoan.id,
            transferCoin
         );

         if (!transactionHash) {
            return;
         }

         // Transfer has cleared on-chain: surface the hash so the overlay flips from
         // "Sending" to "Confirming" while the DB catches up.
         setPendingTxHash(transactionHash);

         await dispatch(
            updateLoanStatus({
               id: selectedLoan.id,
               repaidAmount: newRepaidAmount,
               repaymentStatus: newRepaymentStatus,
               hash: transactionHash
            })
         ).unwrap();
         await dispatch(getUserLoans({ userId: user.id })).unwrap();
         setRepaymentAmount('');
         if (isFullyRepaid) {
            setCompletion({
               reason: selectedLoan.reason || 'your loan',
               paidAmount: toNumber(selectedLoan.totalRepaymentAmount),
               coin: transferCoin,
               trustPoints: earnedTrustPoints
            });
         } else {
            // Partial payment: the loan stays active, so acknowledge it inline instead of
            // the full-payoff screen.
            const remainingAfter = Math.max(0, toNumber(selectedLoan.totalRepaymentAmount) - newRepaidAmount);
            setPartialPaid({ paidAmount: effectiveRepayment, remaining: remainingAfter, coin: transferCoin });
         }
         // A short success buzz on devices that support it makes the payoff feel tactile.
         if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(isFullyRepaid ? [12, 40, 12] : 12);
         }
         showToastByConfig('repayment_success');
      } catch (error) {
         console.error('Repayment failed:', error);
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.TRANSACTION_FAILED));
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
      account.isConnected,
      account.chain?.id,
      baseAccountConnector,
      navigate,
      baseWalletLock.address,
      baseWalletLock.hasStoredWallet,
      canRepayWithConnectedBaseWallet,
      connectAsync,
      isUsingLockedBaseWallet,
      showToast,
      showToastByConfig,
      Transfer,
      dispatch,
      user.id
   ]);

   const handleRepayRef = useRef(handleRepay);

   useEffect(() => {
      handleRepayRef.current = handleRepay;
   }, [handleRepay]);

   // Auto-continue: once the wallet reports connected, resume the repayment the borrower
   // already initiated. Reading account.isConnected here (not in the connect callback) avoids
   // the state-propagation lag that would otherwise re-trigger the connect popup. Declared
   // after the ref-sync effect so handleRepayRef points at the freshly-connected closure.
   useEffect(() => {
      if (account.isConnected && pendingRepayRef.current) {
         pendingRepayRef.current = false;
         void handleRepayRef.current();
      }
   }, [account.isConnected]);

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
      [account.isConnected, completion, connectStatus, handleBottomNavRepay, isProcessing, isRepayDisabled, paymentCtaAmount, payNowLabel, selectedLoan]
   );

   useBottomNavPrimaryAction(bottomNavRepayAction);

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
         <main className="repay-page min-h-screen bg-[linear-gradient(180deg,#fbfafd_0%,#ffffff_44%,#fbfafd_100%)] px-4 pb-32 pt-5 text-md-heading sm:px-6">
            <div className="mx-auto flex w-full max-w-[400px] flex-col gap-3">
               <section className="flex flex-col items-center rounded-md-xl border border-md-neutral-300 bg-white px-6 py-10 text-center shadow-[0_10px_28px_rgba(31,28,37,0.05)] animate-[repaySuccessIn_0.35s_cubic-bezier(0.16,1,0.3,1)]">
                  <span className="flex h-16 w-16 items-center justify-center rounded-md-pill bg-md-green-100 text-md-green-900 animate-[repaySuccessPop_0.45s_cubic-bezier(0.16,1,0.3,1)]">
                     <Check className="h-8 w-8" aria-hidden="true" />
                  </span>
                  <h1 className="mt-5 text-md-h4 font-semibold text-md-heading">Loan fully repaid</h1>
                  <p className="mt-2 max-w-[320px] text-md-b2 text-md-neutral-1200">
                     You’ve cleared <span className="font-semibold text-md-heading">{completion.reason}</span> — ${formatCurrency(completion.paidAmount)}{' '}
                     {completion.coin} paid in full. Nice work building your repayment history.
                  </p>
                  {completion.trustPoints > 0 ? (
                     <span className="mt-4 inline-flex items-center gap-1.5 rounded-md-pill bg-md-green-100 px-3 py-1.5 text-md-b3 font-semibold text-md-green-900">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />+{completion.trustPoints} Trust Points earned
                     </span>
                  ) : null}
                  <div className="mt-7 flex w-full flex-col gap-2.5">
                     {hasMoreLoans ? (
                        <button
                           type="button"
                           onClick={() => setCompletion(null)}
                           className="inline-flex min-h-[56px] items-center justify-center rounded-[16px] bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 active:scale-[0.99]"
                        >
                           Repay another loan
                        </button>
                     ) : null}
                     <button
                        type="button"
                        onClick={() => navigate('/history')}
                        className="inline-flex min-h-[56px] items-center justify-center rounded-[16px] border border-md-neutral-300 bg-white px-md-4 py-md-3 text-md-b1 font-semibold text-md-primary-1200 active:scale-[0.99]"
                     >
                        View repayment history
                     </button>
                     {!hasMoreLoans ? (
                        <button
                           type="button"
                           onClick={() => navigate('/dashboard')}
                           className="inline-flex min-h-[56px] items-center justify-center rounded-[16px] bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 active:scale-[0.99]"
                        >
                           Back to dashboard
                        </button>
                     ) : null}
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
               width: 22px;
               height: 22px;
               border-radius: 9999px;
               background: #ffffff;
               border: 2.5px solid #6010d2;
               box-shadow: 0 2px 8px rgba(96, 16, 210, 0.3);
               cursor: pointer;
            }
            .repay-page input.repay-slider::-moz-range-thumb {
               width: 22px;
               height: 22px;
               border-radius: 9999px;
               background: #ffffff;
               border: 2.5px solid #6010d2;
               box-shadow: 0 2px 8px rgba(96, 16, 210, 0.3);
               cursor: pointer;
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
                     <p className="mt-1 text-md-b2 text-md-neutral-1200">Choose a loan, enter an amount, and confirm.</p>
                  </div>
               </div>
               <UserAvatar alt={user.displayName ?? user.username ?? 'Profile'} size={48} className="shadow-md-card" />
            </header>

            {selectedLoan && isShortOnFunds ? (
               <section className="overflow-hidden rounded-md-xl border border-md-primary-300 bg-white shadow-[0_12px_30px_rgba(79,70,229,0.10)]">
                  <button
                     type="button"
                     onClick={() => setShowAddFunds((open) => !open)}
                     aria-expanded={showAddFunds}
                     className="flex w-full items-center gap-3 bg-[linear-gradient(135deg,#f4f1ff_0%,#ffffff_60%)] px-4 py-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-300"
                  >
                     <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md-pill bg-[linear-gradient(135deg,#7c5cff_0%,#4f46e5_100%)] text-white shadow-[0_4px_12px_rgba(79,70,229,0.35)]">
                        <Wallet className="h-5 w-5" aria-hidden="true" />
                     </span>
                     <span className="min-w-0 flex-1">
                        <span className="block text-md-b1 font-semibold text-md-heading">Add funds to repay</span>
                        <span className="mt-0.5 block text-md-b3 text-md-neutral-1200">
                           You need <span className="font-semibold text-md-primary-1200">${formatCurrency(fundingShortfall ?? 0)} more USDC</span> for this loan.
                        </span>
                     </span>
                     <ChevronDown
                        className={`h-5 w-5 shrink-0 text-md-neutral-1200 transition-transform ${showAddFunds ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                     />
                  </button>

                  {showAddFunds ? (
                     <div className="px-4 pb-4 pt-1">
                        {/* Source selector — pick where to buy USDC. The repay flow below is the
                            same for all; only the "open" link changes. */}
                        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                           {fundSources.map((source) => {
                              const isSelected = fundSource === source.id;

                              return (
                                 <button
                                    type="button"
                                    key={source.id}
                                    onClick={() => setFundSource(source.id)}
                                    aria-pressed={isSelected}
                                    className={`inline-flex shrink-0 items-center gap-2 rounded-md-pill px-3.5 py-2 text-md-b2 font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-300 ${
                                       isSelected
                                          ? 'bg-md-primary-1200 text-white shadow-[0_4px_12px_rgba(96,16,210,0.25)]'
                                          : 'border border-[#e9e3f8] bg-white text-[#8b80b3] hover:border-md-primary-300'
                                    }`}
                                 >
                                    {renderSourceLogo(source.id)}
                                    {source.label}
                                    {isSelected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                                 </button>
                              );
                           })}
                        </div>

                        {repayWalletAddress ? (
                           <div className="mt-3 rounded-md-xl bg-md-primary-100/40 p-3.5">
                              <div className="flex items-center gap-3">
                                 <div className="min-w-0 flex-1">
                                    <p className="text-md-b3 text-md-neutral-1200">Send USDC on Base to</p>
                                    <p className="mt-1 truncate font-mono text-md-b1 font-semibold text-md-heading">
                                       {formatWalletAddressShort(repayWalletAddress)}
                                    </p>
                                 </div>
                                 <span className="shrink-0 rounded-md-input bg-white p-1.5 shadow-md-card">
                                    <QRCodeSVG value={repayWalletAddress} size={56} level="M" marginSize={0} />
                                 </span>
                              </div>
                              <div className="mt-3 flex gap-3">
                                 <button
                                    type="button"
                                    onClick={handleCopyAddress}
                                    className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-md-xl border border-[#e9e3f8] bg-white text-md-b2 font-semibold text-md-heading active:scale-[0.98]"
                                 >
                                    {copiedAddress ? <Check className="h-4 w-4 text-md-primary-1200" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                                    {copiedAddress ? 'Copied' : 'Copy'}
                                 </button>
                                 <a
                                    href={activeSource.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex min-h-[48px] flex-[2] items-center justify-center gap-1.5 rounded-md-xl bg-[linear-gradient(135deg,#5b21d6_0%,#7c3aed_100%)] text-md-b2 font-semibold text-white shadow-[0_4px_14px_rgba(108,63,224,0.35)] active:scale-[0.98]"
                                 >
                                    {activeSource.action}
                                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                 </a>
                              </div>
                           </div>
                        ) : null}

                        {/* Slim live indicator — the header already states the shortfall, so this
                            only carries what text can't: the system actively watching for the
                            transfer, and the moment it lands. */}
                        <div className="mt-3.5">
                           <div className="relative h-1.5 w-full overflow-hidden rounded-md-pill bg-md-primary-100">
                              {hasEnoughToRepay ? (
                                 <div className="absolute inset-0 rounded-md-pill bg-md-green-900" />
                              ) : (
                                 <div className="repay-watch-bar absolute inset-y-0 left-0 rounded-md-pill" />
                              )}
                           </div>
                           <div className="mt-2 flex items-center justify-end">
                              <span
                                 className={`flex items-center gap-1.5 text-md-b3 font-semibold ${
                                    hasEnoughToRepay ? 'text-md-green-900' : 'text-md-primary-1200'
                                 }`}
                              >
                                 {usdcBalance === null ? (
                                    <>
                                       <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                       Checking…
                                    </>
                                 ) : hasEnoughToRepay ? (
                                    <>
                                       <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                       Funds ready
                                    </>
                                 ) : (
                                    <>
                                       <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                       Watching for your transfer
                                    </>
                                 )}
                              </span>
                           </div>
                        </div>

                        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-md-b3 text-md-neutral-1200">
                           <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-md-primary-1200" aria-hidden="true" />
                           Base network only · Moodeng never holds your money.
                        </p>
                     </div>
                  ) : null}
               </section>
            ) : null}

            {activeLoans.length > 1 ? (
               <section aria-labelledby="loan-picker-title" className="flex flex-col gap-2">
                  <div>
                     <h2 id="loan-picker-title" className="text-md-b3 font-semibold uppercase tracking-widest text-md-neutral-1200">
                        Pick a loan
                     </h2>
                  </div>
                  <div className="flex gap-3">
                     {activeLoans.map((loan) => {
                        const isSelected = loan.id === selectedLoan?.id;

                        return (
                           <button
                              type="button"
                              key={loan.id}
                              onClick={() => handleSelectLoan(loan.id)}
                              aria-pressed={isSelected}
                              className={`min-h-[100px] min-w-0 flex-1 rounded-md-xl p-3.5 text-left transition focus:outline-none focus:ring-2 focus:ring-md-primary-300 ${
                                 isSelected
                                    ? 'border-2 border-md-primary-1200 bg-[#f8f6fe]'
                                    : 'border border-[#e9e3f8] bg-white hover:border-md-primary-300'
                              }`}
                           >
                              <div className="flex items-start justify-between gap-2">
                                 <p className={`min-w-0 text-md-b2 font-semibold leading-snug ${isSelected ? 'text-md-primary-1200' : 'text-[#8b80b3]'}`}>
                                    {loan.reason || 'Active loan'}
                                 </p>
                                 <span
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md-pill ${
                                       isSelected ? 'bg-md-primary-1200' : 'border-2 border-[#d1c4e9]'
                                    }`}
                                    aria-hidden="true"
                                 >
                                    {isSelected ? <span className="h-1.5 w-1.5 rounded-md-pill bg-white" /> : null}
                                 </span>
                              </div>
                              <p className="mt-2 text-md-b3 text-[#8b80b3]">Remaining</p>
                              <p className="text-md-h5 font-bold tracking-[-0.02em] text-md-heading">${formatCurrency(getRemainingAmount(loan))}</p>
                              {getProgressPercent(loan) > 0 ? (
                                 <div className="mt-2">
                                    <div className="h-1.5 overflow-hidden rounded-md-pill bg-[#f0ebff]">
                                       <div className="h-full rounded-md-pill bg-md-primary-1200" style={{ width: `${getProgressPercent(loan)}%` }} />
                                    </div>
                                    <p className="mt-1 text-md-b3 font-medium text-[#a78bfa]">{getProgressPercent(loan)}% paid</p>
                                 </div>
                              ) : null}
                           </button>
                        );
                     })}
                  </div>
               </section>
            ) : null}

            {selectedLoan ? (
               <>
               <section className="relative overflow-hidden rounded-md-xl px-1 pt-1">
                  {isProcessing ? (
                     <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/85 px-6 text-center backdrop-blur-sm">
                        <Loader2 className="h-8 w-8 animate-spin text-md-primary-1200" aria-hidden="true" />
                        <div>
                           <p className="text-md-b1 font-semibold text-md-heading">{pendingTxHash ? 'Confirming on Base…' : 'Sending payment…'}</p>
                           <p className="mt-1 text-md-b3 text-md-neutral-1200">
                              {pendingTxHash ? 'Recording your repayment — hang tight.' : 'Approve the transaction in your wallet.'}
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
                     </div>
                  ) : null}
                  {partialPaid ? (
                     <div className="mb-3 flex items-center gap-2.5 rounded-md-input border border-md-green-100 bg-md-green-100/60 px-3 py-2.5">
                        <Check className="h-4 w-4 shrink-0 text-md-green-900" aria-hidden="true" />
                        <p className="text-md-b3 font-medium text-md-green-900">
                           Paid ${formatCurrency(partialPaid.paidAmount)} {partialPaid.coin} — ${formatCurrency(partialPaid.remaining)} to go.
                        </p>
                     </div>
                  ) : null}

                  <div className="pt-1 pb-2 text-center">
                     <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#8b80b3]">Repay amount</p>

                     {isLoanOverdue(selectedLoan) ? (
                        <div className="mb-3 flex items-start gap-2.5 rounded-md-input border border-[#f4d2d2] bg-[#fff7f7] px-3 py-2.5 text-left dark:border-[#68303a] dark:bg-[#3c171e]">
                           <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-md-red-600" aria-hidden="true" />
                           <p className="text-md-b3 font-medium text-md-red-600">
                              Paying less than the full ${formatCurrency(selectedRemaining)} reduces what you owe, but your account stays
                              restricted until this loan is fully repaid.
                           </p>
                        </div>
                     ) : null}

                     <div className="flex flex-col items-center">
                        <div className="mb-1 flex items-baseline justify-center gap-2">
                           <div className="flex items-baseline text-4xl font-extrabold tracking-tight text-[#1a1240]">
                              <span>$</span>
                              <input
                                 ref={amountInputRef}
                                 id="repayment-amount"
                                 type="text"
                                 inputMode="decimal"
                                 value={repaymentAmount}
                                 onChange={handleAmountChange}
                                 placeholder="0.00"
                                 aria-label="Repay amount"
                                 style={{ width: `${Math.max(3, (repaymentAmount || '0.00').length)}ch` }}
                                 className="bg-transparent text-4xl font-extrabold tracking-tight text-[#1a1240] caret-md-primary-1100 outline-none placeholder:text-md-neutral-500"
                              />
                           </div>
                           <span className="text-sm font-semibold text-[#a78bfa]">{selectedLoan.coin || 'USDC'}</span>
                        </div>
                        <p className="text-xs text-[#8b80b3]">of ${formatCurrency(selectedRemaining)} remaining</p>
                        {validPreviewPayment > 0 && !isLoanOverdue(selectedLoan) && estimatedTrustPoints > 0 ? (
                           <span className="mt-2 inline-flex items-center gap-1.5 rounded-md-pill bg-md-green-100 px-3 py-1 text-md-b3 font-semibold text-md-green-900">
                              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                              +{estimatedTrustPoints} Trust Points
                           </span>
                        ) : null}
                     </div>

                     <div className="relative px-1 mb-5 mt-6">
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
                           className="repay-slider h-1.5 w-full cursor-pointer appearance-none rounded-full"
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
                                 className={`flex flex-1 flex-col items-center justify-center rounded-xl py-2.5 transition focus:outline-none focus:ring-2 focus:ring-md-primary-300 ${
                                    isQuickSelected
                                       ? 'bg-[#6c3fe0] text-white shadow-[0_4px_14px_rgba(108,63,224,0.32)]'
                                       : 'bg-[#f0ebff] text-[#6c3fe0] hover:bg-md-primary-100'
                                 }`}
                              >
                                 <span className="text-xs font-bold leading-none">{option.label}</span>
                                 <span className={`mt-0.5 text-[10px] font-medium leading-none ${isQuickSelected ? 'text-white/75' : 'text-[#a78bfa]'}`}>
                                    ${formatCurrency(quickAmount)}
                                 </span>
                              </button>
                           );
                        })}
                     </div>

                     {amountError ? <p className="mb-2 text-md-b3 font-semibold text-md-red-600">{amountError}</p> : null}
                  </div>

                  <div className="px-5 pb-4 pt-1">
                     <button
                        type="button"
                        onClick={handleRepay}
                        disabled={isRepayDisabled}
                        className="w-full rounded-2xl py-4 text-base font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                        style={{
                           background: 'linear-gradient(135deg, #5b21d6 0%, #7c3aed 100%)',
                           boxShadow: '0 6px 20px rgba(108,63,224,0.38)'
                        }}
                     >
                        {hasValidPayAmount ? `Pay Now · $${formatCurrency(parsedRepaymentAmount)} USDC` : 'Pay Now'}
                     </button>
                  </div>

                  <div
                     className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-5 pb-3 text-md-b3 ${
                        isLoanOverdue(selectedLoan) || isLoanDueSoon(selectedLoan) ? 'text-md-red-600' : 'text-md-neutral-1200'
                     }`}
                  >
                     <span className="inline-flex items-center gap-1.5 font-semibold">
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
