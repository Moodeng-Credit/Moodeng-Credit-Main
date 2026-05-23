import {
   type ChangeEvent,
   type FormEvent,
   type MouseEvent,
   type RefObject,
   useCallback,
   useEffect,
   useLayoutEffect,
   useMemo,
   useRef,
   useState
} from 'react';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, HelpCircle, Menu, Search, Wallet, X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';

import FilterSidebar from '@/components/filters/FilterSidebar';
import GuidedTourPreview from '@/components/GuidedTourPreview';
import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import UserAvatar from '@/components/UserAvatar';
import { ModalNote } from '@/components/worldId/modal/ModalNote';
import { VerificationModalBody } from '@/components/worldId/modal/VerificationModalBody';
import { VerificationModalHeader } from '@/components/worldId/modal/VerificationModalHeader';
import WorldIDVerification from '@/components/worldId/WorldIDVerification';

import { useClickOutside } from '@/hooks/useClickOutside';
import { useIsBorrower } from '@/hooks/useIsBorrower';
import { usePagination } from '@/hooks/usePagination';

import { filterLoans, type LoanFilters } from '@/utils/loanFilters';

import { STARTING_CREDIT_LIMIT } from '@/config/creditTiers';
import { logoImageSrc } from '@/config/navigationConfig';
import { getBorrowerUsedCreditAmount, isRequestBoardLoanVisible } from '@/lib/borrowerCreditUsage';
import { getEffectiveCreditLimit } from '@/lib/creditLeveling';
import { recordGuidedTourEvent } from '@/lib/guidedTourEvents';
import {
   BORROWER_GUIDED_TOUR_ID,
   LENDER_GUIDED_TOUR_ID,
   markGuidedTourCompleted,
   recordGuidedTourShown,
   shouldShowGuidedTour
} from '@/lib/guidedTourStorage';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { getBaseWalletLockStatus, isBaseWalletReadyForRepayment } from '@/lib/walletProvider';
import { formatPointsMajor } from '@/shared/points';
import { fetchUser, fetchUserProfiles } from '@/store/slices/authSlice';
import { createLoan, fetchLoans, getLenderRepaidCount } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { User } from '@/types/authTypes';
import { ERROR_CODES } from '@/types/errorCodes';
import { getToastKeyFromErrorCode } from '@/types/errorToastMapping';
import type { Loan } from '@/types/loanTypes';
import LoanRequestModal, { type AppliedReferralCode } from '@/views/dashboard/components/LoanRequestModal';
import { RequestBoardFilterContextProvider } from '@/views/dashboard/components/RequestBoardFilterContext';
import SuccessModal from '@/views/dashboard/components/SuccessModal';
import UserCard from '@/views/dashboard/components/UserCard';
import LoadMoreButton from '@/views/profile/components/shared/LoadMoreButton';
import { FAQS } from '@/views/support/data/faqs';

const LENDER_NOTE_STORAGE_KEY = 'moodeng_lender_note_dismissed';
const IS_BORROWER_BASE_WALLET_GATE_ENABLED = true;
const VERIFIED_REQUEST_BOARD_TOUR_STEP_COUNT = 5;
const UNVERIFIED_REQUEST_BOARD_TOUR_STEP_COUNT = 4;
const GUEST_REQUEST_BOARD_TOUR_STEP_COUNT = 7;
const DASHBOARD_TOUR_STEP_COUNT = 3;
const TOUR_STEP_EXTRA_DURATION_MS = 3500;
const PUBLIC_COMMON_QUESTIONS = FAQS;
const REFERRAL_TEST_USER: User = {
   id: 'referral-test-user',
   username: 'referral-test',
   email: 'referral-test@moodeng.local',
   walletAddress: '0x0000000000000000000000000000000000000000',
   walletProvider: 'base_wallet',
   isWorldId: 'ACTIVE',
   mal: 3,
   nal: 0,
   cs: 100,
   userRole: 'borrower',
   createdAt: new Date(0).toISOString(),
   updatedAt: new Date(0).toISOString()
};

type RequestBoardTourStep = {
   target: string;
   title: string;
   body: string;
   cardPlacement?: 'top' | 'bottom';
   durationMs?: number;
};

const slowTourStep = (step: RequestBoardTourStep): RequestBoardTourStep => ({
   ...step,
   durationMs: (step.durationMs ?? 6000) + TOUR_STEP_EXTRA_DURATION_MS
});
const LENDER_TOUR_USER: User = {
   id: 'lender-tour-user',
   username: 'lender-tour',
   email: 'lender-tour@moodeng.local',
   walletAddress: '0x1111111111111111111111111111111111111111',
   isWorldId: 'ACTIVE',
   mal: 0,
   nal: 0,
   cs: 320,
   userRole: 'lender',
   createdAt: new Date(0).toISOString(),
   updatedAt: new Date(0).toISOString()
};
const LENDER_TOUR_LOANS: Loan[] = [
   {
      id: 'lender-tour-loan-1',
      trackingId: 'LENDER-TOUR-001',
      borrowerWallet: '0x71c4000000000000000000000000000000009d42',
      lenderWallet: '',
      borrowerUser: 'lender-tour-borrower',
      lenderUser: '',
      loanAmount: 15,
      repaidAmount: 0,
      totalRepaymentAmount: 17,
      reason: 'Emergency groceries',
      loanStatus: 'Requested',
      repaymentStatus: 'Unpaid',
      dueDate: '2026-05-16T00:00:00.000Z',
      coin: 'USDC',
      hash: [],
      createdAt: '2026-05-08T00:00:00.000Z',
      updatedAt: '2026-05-08T00:00:00.000Z'
   }
];

export default function RequestBoard() {
   return (
      <RequestBoardFilterContextProvider>
         <RequestBoard$ />
      </RequestBoardFilterContextProvider>
   );
}

function RequestBoard$() {
   const location = useLocation();
   const pathname = location.pathname;
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const connectedWallet = useAccount();

   const { showToast, showToastByConfig } = useToast();

   const [showModal, setShowModal] = useState(false);
   const [showPurple, setShowPurple] = useState(false);
   const [showBaseWalletGate, setShowBaseWalletGate] = useState(false);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [showFilters, setShowFilters] = useState(false);
   const [showLenderNote, setShowLenderNote] = useState(false);
   const [showPublicQuestions, setShowPublicQuestions] = useState(false);
   const [showGuestWorldIdPreview, setShowGuestWorldIdPreview] = useState(false);
   const [hasWorldIdJustVerified, setHasWorldIdJustVerified] = useState(false);
   const [showWorldIdHighlight, setShowWorldIdHighlight] = useState(false);

   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const isLoading = useSelector((state: RootState) => state.loans.isLoading);
   const requestBoardSearchParams = new URLSearchParams(location.search);
   const isReferralTestMode = import.meta.env.DEV && requestBoardSearchParams.has('referralTest');
   const forceTourPreview = import.meta.env.DEV && requestBoardSearchParams.has('tourPreview');
   const showWorldIdSuccessPreview = import.meta.env.DEV && requestBoardSearchParams.has('worldIdSuccessPreview');
   const holdWorldIdSuccessPreview = import.meta.env.DEV && requestBoardSearchParams.get('worldIdSuccessPreview') === 'hold';
   const showTourPreview = forceTourPreview || requestBoardSearchParams.has('tour');
   const shouldStartTourImmediately = requestBoardSearchParams.get('startTour') === '1';
   const isLenderTourPreview = import.meta.env.DEV && requestBoardSearchParams.has('lenderTourPreview');
   const shouldForceReferralTestUser = isReferralTestMode && showTourPreview;
   const effectiveUser = isLenderTourPreview
      ? LENDER_TOUR_USER
      : isReferralTestMode && (shouldForceReferralTestUser || !(user?.id && username))
        ? REFERRAL_TEST_USER
        : user;
   const isAuthenticated = !!(effectiveUser?.id && (username || isReferralTestMode || isLenderTourPreview));
   const hasSelectedRole = Boolean(effectiveUser?.userRole);
   const needsRoleSelection = isAuthenticated && !hasSelectedRole;
   const isWorldIdVerified = effectiveUser?.isWorldId === 'ACTIVE' || hasWorldIdJustVerified;
   const showVerify = !isWorldIdVerified;
   const storeIsBorrower = useIsBorrower();
   const isBorrower = isLenderTourPreview ? false : isReferralTestMode || storeIsBorrower;
   const { data: lenderPointsData } = useQuery({
      queryKey: ['request-board-user-points', effectiveUser?.id],
      queryFn: async () => {
         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase.from('user_points').select('points_total').eq('user_id', effectiveUser!.id).maybeSingle();
         if (error) throw error;
         return data;
      },
      enabled: !isBorrower && !isLenderTourPreview && Boolean(effectiveUser?.id)
   });
   const lenderIouPoints = isLenderTourPreview ? String(effectiveUser?.cs ?? 0) : formatPointsMajor(lenderPointsData?.points_total ?? 0);
   const tourUserId = effectiveUser?.id;
   const shouldShowBorrowerTour =
      showTourPreview &&
      (!isAuthenticated || isBorrower) &&
      (shouldStartTourImmediately || shouldShowGuidedTour(BORROWER_GUIDED_TOUR_ID, tourUserId, forceTourPreview));
   const shouldShowLenderTour =
      showTourPreview &&
      isLenderTourPreview &&
      isAuthenticated &&
      !isBorrower &&
      shouldShowGuidedTour(LENDER_GUIDED_TOUR_ID, tourUserId, forceTourPreview);
   const isGuestBorrowerTour = shouldShowBorrowerTour && !isAuthenticated;
   const recordedTourViewsRef = useRef<Set<string>>(new Set());
   const rawFloanRequests = useSelector((state: RootState) => state.loans?.loans?.floans);
   const floanRequests = useMemo(() => rawFloanRequests || [], [rawFloanRequests]);
   const [sortedLoans, setSortedLoans] = useState(floanRequests);

   const today = new Date().toISOString().split('T')[0];
   const borrowerUserId = effectiveUser?.id || '';
   const lenderUserId = '';
   const [loanAmount, setLoanAmount] = useState('');
   const [totalRepaymentAmount, setTotalRepaymentAmount] = useState('');
   const [reason, setReason] = useState('');
   const [days, setDays] = useState('');
   const [customAmount, setCustomAmount] = useState('');
   const [searchLoan, setSearchLoan] = useState('');
   const [appliedReferral, setAppliedReferral] = useState<AppliedReferralCode | null>(null);
   const effectiveCreditLimit = isAuthenticated ? getEffectiveCreditLimit(effectiveUser.cs, effectiveUser.isWorldId === 'ACTIVE') : 0;
   const borrowerCreditLoans = useMemo(() => {
      if (!borrowerUserId) return [];

      return floanRequests.filter((loan) => loan.borrowerUser === borrowerUserId);
   }, [borrowerUserId, floanRequests]);
   const usedCreditAmount = useMemo(() => {
      return getBorrowerUsedCreditAmount(borrowerCreditLoans);
   }, [borrowerCreditLoans]);
   const availableCreditLimit = Math.max(effectiveCreditLimit - usedCreditAmount, 0);
   const canUseReferralBoost =
      isReferralTestMode ||
      (isAuthenticated &&
         isBorrower &&
         effectiveUser.isWorldId === 'ACTIVE' &&
         effectiveCreditLimit <= STARTING_CREDIT_LIMIT &&
         borrowerCreditLoans.length === 0);
   const baseWalletLock = getBaseWalletLockStatus(effectiveUser);
   const hasBorrowerBaseWallet =
      !IS_BORROWER_BASE_WALLET_GATE_ENABLED ||
      isBaseWalletReadyForRepayment({
         connectedAddress: connectedWallet.address,
         connectorId: connectedWallet.connector?.id,
         connectorName: connectedWallet.connector?.name,
         wallet: effectiveUser
      });
   const shouldOpenLoanRequest =
      (location.state as { openLoanRequest?: boolean } | null)?.openLoanRequest === true ||
      new URLSearchParams(location.search).get('applyLoan') === '1';

   const loanRequestModalRef = useClickOutside<HTMLDivElement>(() => setShowModal(false), showModal) as RefObject<HTMLDivElement>;
   const successModalRef = useClickOutside<HTMLDivElement>(() => setShowPurple(false), showPurple) as RefObject<HTMLDivElement>;
   const baseWalletGateRef = useClickOutside<HTMLDivElement>(
      () => setShowBaseWalletGate(false),
      showBaseWalletGate
   ) as RefObject<HTMLDivElement>;
   const publicQuestionsRef = useClickOutside<HTMLDivElement>(
      () => setShowPublicQuestions(false),
      showPublicQuestions
   ) as RefObject<HTMLDivElement>;
   const worldIdHighlightRef = useClickOutside<HTMLDivElement>(
      () => setShowWorldIdHighlight(false),
      showWorldIdHighlight
   ) as RefObject<HTMLDivElement>;

   const [filters, setFilters] = useState<LoanFilters>({
      amount: '',
      rate: '',
      date: null,
      loanTime: '',
      borrowType: [],
      network: [],
      search: '',
      sortBy: undefined
   });

   useEffect(() => {
      if (showWorldIdSuccessPreview) {
         setHasWorldIdJustVerified(true);
         setShowWorldIdHighlight(true);
      }
   }, [showWorldIdSuccessPreview]);

   useEffect(() => {
      if (!showWorldIdHighlight) return;
      if (holdWorldIdSuccessPreview) return;

      const timeoutId = window.setTimeout(() => setShowWorldIdHighlight(false), 5000);
      return () => window.clearTimeout(timeoutId);
   }, [holdWorldIdSuccessPreview, showWorldIdHighlight]);

   const clear = () => {
      setTotalRepaymentAmount('');
      setLoanAmount('');
      setReason('');
      setDays('');
      setAppliedReferral(null);
   };

   const goToBorrowerOnboardingStart = useCallback(
      (returnTo?: string) => {
         setShowModal(false);
         setShowBaseWalletGate(false);
         navigate('/onboarding/welcome', returnTo ? { state: { returnTo } } : undefined);
      },
      [navigate]
   );

   const showBorrowerBaseWalletGate = useCallback(() => {
      setShowModal(false);
      setShowBaseWalletGate(true);
   }, []);

   const handleFiltersChange = (newFilters: Partial<LoanFilters>) => {
      setFilters((prev) => {
         const updated = { ...prev, ...newFilters };
         if ('date' in newFilters && newFilters.date !== null) updated.loanTime = '';
         if ('loanTime' in newFilters && newFilters.loanTime !== '') updated.date = null;
         return updated;
      });
   };

   const handleApplyLoanClick = (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();

      if (!isWorldIdVerified && !hasBorrowerBaseWallet) {
         goToBorrowerOnboardingStart('loan-request');
         return;
      }

      if (!hasBorrowerBaseWallet) {
         showBorrowerBaseWalletGate();
         return;
      }

      if (!isWorldIdVerified) {
         setShowModal(true);
         return;
      }

      if ((effectiveUser.nal || 0) >= (effectiveUser.mal || 0)) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_LIMIT_REACHED));
         return;
      }

      if (availableCreditLimit <= 0) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_AMOUNT_EXCEEDS_LIMIT));
         return;
      }
      setShowModal(true);
   };

   const handleCloseModal = useCallback(() => setShowModal(false), []);
   const handleAddBaseWallet = useCallback(() => {
      setShowBaseWalletGate(false);
      navigate('/onboarding/wallet', { state: { returnTo: 'loan-request' } });
   }, [navigate]);
   const handleWorldIdHeaderClick = useCallback(
      (openWorldId: () => void) => {
         if (!hasBorrowerBaseWallet) {
            goToBorrowerOnboardingStart();
            return;
         }

         openWorldId();
      },
      [goToBorrowerOnboardingStart, hasBorrowerBaseWallet]
   );
   const handleRequestBoardTourStepChange = useCallback(
      (index: number) => {
         if (!isAuthenticated) {
            setShowGuestWorldIdPreview(index === 2);
            setShowModal(index === 3);
            setShowPublicQuestions(index === 5);

            if (index === 5) {
               window.setTimeout(() => {
                  const questionsPanel = document.querySelector<HTMLElement>('[data-tour-target="request-common-questions-panel"]');
                  questionsPanel?.scrollTo({ top: questionsPanel.scrollHeight, behavior: 'smooth' });
               }, 180);
            }
            return;
         }

         if (showVerify) {
            setShowModal(index >= 3);
            return;
         }

         if (index >= 2) setShowModal(true);
      },
      [isAuthenticated, showVerify]
   );
   useEffect(() => {
      if (!shouldShowBorrowerTour || forceTourPreview) return;

      const viewKey = `${BORROWER_GUIDED_TOUR_ID}:${tourUserId || 'guest'}`;
      if (recordedTourViewsRef.current.has(viewKey)) return;

      recordedTourViewsRef.current.add(viewKey);
      const shownCount = recordGuidedTourShown(BORROWER_GUIDED_TOUR_ID, tourUserId);
      void recordGuidedTourEvent({
         eventType: 'shown',
         metadata: { path: location.pathname, role: isBorrower ? 'borrower' : 'guest' },
         shownCount,
         tourId: BORROWER_GUIDED_TOUR_ID,
         userId: tourUserId
      });
   }, [forceTourPreview, isBorrower, location.pathname, shouldShowBorrowerTour, tourUserId]);

   useEffect(() => {
      if (!shouldShowLenderTour || forceTourPreview) return;

      const viewKey = `${LENDER_GUIDED_TOUR_ID}:${tourUserId || 'guest'}`;
      if (recordedTourViewsRef.current.has(viewKey)) return;

      recordedTourViewsRef.current.add(viewKey);
      const shownCount = recordGuidedTourShown(LENDER_GUIDED_TOUR_ID, tourUserId);
      void recordGuidedTourEvent({
         eventType: 'shown',
         metadata: { path: location.pathname, role: 'lender' },
         shownCount,
         tourId: LENDER_GUIDED_TOUR_ID,
         userId: tourUserId
      });
   }, [forceTourPreview, location.pathname, shouldShowLenderTour, tourUserId]);

   const requestBoardTourStepCount = !isAuthenticated
      ? GUEST_REQUEST_BOARD_TOUR_STEP_COUNT
      : showVerify
        ? UNVERIFIED_REQUEST_BOARD_TOUR_STEP_COUNT
        : VERIFIED_REQUEST_BOARD_TOUR_STEP_COUNT;
   const borrowerTourTotalSteps =
      isAuthenticated && isBorrower ? requestBoardTourStepCount + DASHBOARD_TOUR_STEP_COUNT : requestBoardTourStepCount;
   const requestedTourStepIndex = Number(requestBoardSearchParams.get('tourStep'));
   const initialBorrowerTourStepIndex =
      Number.isInteger(requestedTourStepIndex) && requestedTourStepIndex >= 0
         ? Math.min(requestedTourStepIndex, Math.max(requestBoardTourStepCount - 1, 0))
         : 0;

   const handleRequestBoardTourFinish = useCallback(
      (reason: 'complete' | 'skip') => {
         setShowModal(false);
         if (reason === 'skip' || !isAuthenticated || !isBorrower) {
            if (!forceTourPreview) {
               markGuidedTourCompleted(BORROWER_GUIDED_TOUR_ID, tourUserId);
               void recordGuidedTourEvent({
                  eventType: 'skipped',
                  metadata: { path: location.pathname, role: isBorrower ? 'borrower' : 'guest' },
                  tourId: BORROWER_GUIDED_TOUR_ID,
                  userId: tourUserId
               });
            }
            return;
         }

         const dashboardTourSearch = new URLSearchParams({
            requestBoardTourSteps: String(requestBoardTourStepCount),
            tour: '1'
         });

         if (import.meta.env.DEV) {
            dashboardTourSearch.set('mockData', 'rich');
            dashboardTourSearch.set('tourPreview', '1');
         }

         navigate(`/dashboard?${dashboardTourSearch.toString()}`);
      },
      [forceTourPreview, isAuthenticated, isBorrower, location.pathname, navigate, requestBoardTourStepCount, tourUserId]
   );
   const handleRequestBoardTourStepNext = useCallback(
      (index: number) => {
         if (!isAuthenticated || !isBorrower || !showVerify || index !== 2) {
            return false;
         }

         setShowModal(false);
         navigate('/verify-world-id', { state: { returnTo: 'request-board-tour' } });
         return true;
      },
      [isAuthenticated, isBorrower, navigate, showVerify]
   );
   const handleLenderTourFinish = useCallback(
      (reason: 'complete' | 'skip') => {
         if (reason === 'skip') {
            if (!forceTourPreview) {
               markGuidedTourCompleted(LENDER_GUIDED_TOUR_ID, tourUserId);
               void recordGuidedTourEvent({
                  eventType: 'skipped',
                  metadata: { path: location.pathname, role: 'lender' },
                  tourId: LENDER_GUIDED_TOUR_ID,
                  userId: tourUserId
               });
            }
            return;
         }

         navigate('/user/maya-demo?demo=rich&lenderTourPreview=1&tourPreview=1');
      },
      [forceTourPreview, location.pathname, navigate, tourUserId]
   );
   const requestBoardTourSteps = useMemo(() => {
      if (!isAuthenticated) {
         return [
            {
               target: '[data-tour-target="request-first-card"]',
               title: 'Request Board',
               body: 'This list is the marketplace. Once a request is live, lenders can review the amount, repayment, and borrower profile before funding.',
               durationMs: 6000
            },
            {
               target: '[data-tour-target="request-apply-card"]',
               title: 'Apply for a loan',
               body: 'When you are ready to borrow, this card opens the loan request flow.',
               durationMs: 6000
            },
            {
               target: '[data-tour-target="guest-world-id-preview"]',
               title: 'Verify first',
               body: 'Borrowers complete this one-time World ID step before requesting a loan. It helps lenders know they are funding a real person.',
               cardPlacement: 'top',
               durationMs: 6500
            },
            {
               target: '[data-tour-target="loan-borrow-amount"]',
               title: 'Set your terms',
               body: 'After verification, this is where the borrower sets the amount, repayment, date, and reason for the request.',
               durationMs: 6000
            },
            {
               target: '[data-tour-target="request-first-card"]',
               title: 'Browse open requests',
               body: 'You can look through current requests before creating an account. Each card shows the amount, repayment, borrower, and reason.',
               durationMs: 6400
            },
            {
               target: '[data-tour-target="request-common-questions-panel"]',
               title: 'Common questions',
               body: 'The hamburger opens Help and Support questions here. Scroll the list to browse more answers without leaving the board.',
               durationMs: 5600
            },
            {
               target: '[data-tour-target="request-auth-actions"]',
               title: 'Continue when ready',
               body: 'Sign up to request or fund a loan. Sign in if you already have a Moodeng account.',
               durationMs: 5600
            }
         ].map(slowTourStep);
      }

      const baseSteps = showVerify
         ? [
              {
                 target: '[data-tour-target="request-latest-list"]',
                 title: 'Request Board',
                 body: 'This list is the marketplace. Once a request is live, lenders can review the amount, repayment, and borrower profile before funding.',
                 durationMs: 6000
              },
              {
                 target: '[data-tour-target="request-apply-card"]',
                 title: 'Apply for a loan',
                 body: 'When you are ready to borrow, this card opens the loan request form.',
                 durationMs: 6000
              },
              {
                 target: '[data-tour-target="request-verify-world-id-link"]',
                 title: 'Verify first',
                 body: 'Before an unverified borrower can request a loan, Moodeng sends them through the World ID verification screen.',
                 durationMs: 6500
              },
              {
                 target: '[data-tour-target="loan-borrow-amount"]',
                 title: 'Loan terms preview',
                 body: 'After verification, this is where the borrower sets the amount, repayment, date, and reason for the request.',
                 durationMs: 6000
              }
           ].map(slowTourStep)
         : [
              {
                 target: '[data-tour-target="request-latest-list"]',
                 title: 'Request Board',
                 body: 'This list is the marketplace. Once a request is live, lenders can review the amount, repayment, and borrower profile before funding.',
                 durationMs: 6000
              },
              {
                 target: '[data-tour-target="request-apply-card"]',
                 title: 'Apply for a loan',
                 body: 'When you are ready to borrow, this card opens the loan request form.',
                 durationMs: 6000
              },
              {
                 target: '[data-tour-target="loan-borrow-amount"]',
                 title: 'Trust-building vs credit-building',
                 body: 'Borrowing below your limit can build trust history. Borrowing your full limit and repaying on time is what raises your Credit Level.',
                 durationMs: 7800
              },
              {
                 target: '[data-tour-target="loan-repayment-amount"]',
                 title: 'Set a clear repayment',
                 body: 'Your repayment must be at least $1 more than what you borrow. Lenders use this to decide if the request is worth funding.',
                 durationMs: 6400
              },
              {
                 target: '[data-tour-target="loan-reason"]',
                 title: 'Explain the reason',
                 body: 'A short, specific reason helps lenders understand the request and builds trust before they fund it.',
                 durationMs: 6000
              }
           ].map(slowTourStep);

      return baseSteps;
   }, [isAuthenticated, showVerify]);
   const lenderTourSteps = [
      {
         target: '[data-tour-target="request-latest-list"]',
         title: 'Find open requests',
         body: 'As a lender, this board shows people asking for short-term USDC support. Start by comparing the amount, repayment, due date, and reason.',
         durationMs: 6500
      },
      {
         target: '[data-tour-target="lender-request-card"]',
         title: 'Review the request',
         body: 'Each card shows what the borrower needs, what they plan to repay, and whether their account is in good standing.',
         durationMs: 6200
      },
      {
         target: '[data-tour-target="lender-borrower-details-link"]',
         title: 'Check Borrower Insights',
         body: 'Before funding, open Borrower Details to review repayment behavior, credit level, and trust signals. The tour continues there next.',
         durationMs: 6500
      }
   ];
   const handleReferralRedeemed = useCallback(async () => {
      try {
         await dispatch(fetchUser()).unwrap();
      } catch (error) {
         console.error('Error refreshing user after referral redemption:', (error as Error).message || error);
      }
   }, [dispatch]);

   useEffect(() => {
      if (!shouldOpenLoanRequest || !isAuthenticated || !isBorrower || !effectiveUser?.id) return;

      if (!isWorldIdVerified && !hasBorrowerBaseWallet) {
         navigate('/onboarding/welcome', { replace: true, state: { returnTo: 'loan-request' } });
         return;
      }

      if (!hasBorrowerBaseWallet) {
         showBorrowerBaseWalletGate();
         navigate(pathname, { replace: true, state: null });
         return;
      }

      if (!isWorldIdVerified) {
         setShowModal(true);
         navigate(pathname, { replace: true, state: null });
         return;
      }

      if ((effectiveUser.nal || 0) >= (effectiveUser.mal || 0)) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_LIMIT_REACHED));
         navigate(pathname, { replace: true, state: null });
         return;
      }

      setShowModal(true);
      navigate(pathname, { replace: true, state: null });
   }, [
      isAuthenticated,
      isBorrower,
      navigate,
      pathname,
      shouldOpenLoanRequest,
      showToastByConfig,
      hasBorrowerBaseWallet,
      isWorldIdVerified,
      showBorrowerBaseWalletGate,
      effectiveUser?.id,
      effectiveUser?.mal,
      effectiveUser?.nal
   ]);

   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (isSubmitting) return;

      const borrowerWallet = effectiveUser.walletAddress?.trim();
      const trimmedReason = reason.trim();
      const parsedLoanAmount = Number.parseFloat(loanAmount);
      const parsedRepaymentAmount = Number.parseFloat(totalRepaymentAmount);
      const parsedDueDate = days ? new Date(days) : null;

      if (effectiveUser.isWorldId !== 'ACTIVE' && !hasBorrowerBaseWallet) {
         goToBorrowerOnboardingStart('loan-request');
         return;
      }
      if (effectiveUser.isWorldId !== 'ACTIVE') {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.WORLDID_REQUIRED));
         return;
      }
      if (!hasBorrowerBaseWallet) {
         showBorrowerBaseWalletGate();
         return;
      }
      if ((effectiveUser.nal || 0) >= (effectiveUser.mal || 0)) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_LIMIT_REACHED));
         return;
      }
      if (!loanAmount || Number.isNaN(parsedLoanAmount) || parsedLoanAmount <= 0) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_INVALID_AMOUNT));
         return;
      }
      if (parsedLoanAmount > availableCreditLimit) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_AMOUNT_EXCEEDS_LIMIT));
         return;
      }
      if (!totalRepaymentAmount || Number.isNaN(parsedRepaymentAmount) || parsedRepaymentAmount < parsedLoanAmount + 1) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_REPAYMENT_TOO_LOW));
         return;
      }
      if (!parsedDueDate || Number.isNaN(parsedDueDate.getTime())) {
         showToast(
            TOAST_TYPES.ERROR,
            'Repayment date required',
            'Choose a repayment date before making your request.',
            'OK',
            'acknowledge'
         );
         return;
      }
      if (!trimmedReason) {
         showToast(TOAST_TYPES.ERROR, 'Reason required', 'Add a short reason so lenders know what the loan is for.', 'OK', 'acknowledge');
         return;
      }

      const loanData = {
         borrowerUserId: borrowerUserId || '',
         borrowerWallet,
         lenderUserId,
         loanAmount: parsedLoanAmount,
         totalRepaymentAmount: parsedRepaymentAmount,
         reason: trimmedReason,
         dueDate: days,
         referralCodeId: appliedReferral?.id,
         referralCode: appliedReferral?.code,
         referralBoostAmount: appliedReferral?.boostAmount
      };

      if (
         effectiveUser.isWorldId === 'ACTIVE' &&
         hasBorrowerBaseWallet &&
         (effectiveUser.nal || 0) < (effectiveUser.mal || 0) &&
         parsedLoanAmount <= availableCreditLimit &&
         parsedLoanAmount > 0 &&
         parsedRepaymentAmount >= parsedLoanAmount + 1
      ) {
         setIsSubmitting(true);
         try {
            await dispatch(createLoan(loanData)).unwrap();
            clear();
            setShowPurple(true);
            setShowModal(false);
            try {
               await dispatch(fetchUser()).unwrap();
            } catch (error) {
               console.error('Error fetching user:', (error as Error).message || error);
            }
         } catch (error) {
            console.error('Error creating loan:', (error as Error).message || error);
            showToast(
               TOAST_TYPES.ERROR,
               "Request wasn't saved",
               "We couldn't save this loan request. Please try again.",
               'Try Again',
               'retry_loan_request'
            );
         } finally {
            setIsSubmitting(false);
         }
      }
   };

   const handleDays = (e: ChangeEvent<HTMLInputElement>) => {
      if (!e.target.value) {
         setDays('');
         return;
      }
      const date = new Date(e.target.value);
      const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
      setDays(utcDate.toISOString());
   };

   const dismissLenderNote = () => {
      setShowLenderNote(false);
      localStorage.setItem(LENDER_NOTE_STORAGE_KEY, 'true');
   };

   useEffect(() => {
      if (isBorrower || !user?.id) return;
      if (localStorage.getItem(LENDER_NOTE_STORAGE_KEY) === 'true') return;

      dispatch(getLenderRepaidCount(user.id))
         .unwrap()
         .then((count) => {
            if (count >= 2) setShowLenderNote(true);
         })
         .catch(() => undefined);
   }, [isBorrower, user?.id, dispatch]);

   useLayoutEffect(() => {
      if (typeof window === 'undefined' || window.location.hash) return;

      window.scrollTo(0, 0);
   }, [pathname]);

   useEffect(() => {
      if (typeof window !== 'undefined' && window.location.hash) {
         const element = document.getElementById(window.location.hash.replace('#', ''));
         if (element) element.scrollIntoView({ behavior: 'smooth' });
      }
   }, [pathname]);

   useEffect(() => {
      const loadLoans = async () => {
         try {
            const loans = await dispatch(fetchLoans()).unwrap();
            const borrowerUserIds = [...new Set(loans.map((loan: Loan) => loan.borrowerUser).filter(Boolean))] as string[];
            if (borrowerUserIds.length > 0) {
               await dispatch(fetchUserProfiles(borrowerUserIds)).unwrap();
            }
         } catch (error) {
            console.error('Error fetching data:', (error as Error).message || error);
         }
      };
      loadLoans();
   }, [dispatch]);

   const filteredLoans = useMemo(() => {
      const allFilters: LoanFilters = { ...filters, search: searchLoan, sortBy: filters.sortBy };
      return filterLoans(
         floanRequests.filter((loan) => isRequestBoardLoanVisible(loan)),
         allFilters,
         customAmount,
         userProfiles
      );
   }, [filters, searchLoan, floanRequests, customAmount, userProfiles]);

   useEffect(() => {
      setSortedLoans(filteredLoans);
   }, [filteredLoans]);

   const {
      displayedItems: displayedLoans,
      displayedCount,
      totalCount,
      handleLoadMore
   } = usePagination({
      items: sortedLoans,
      resetDependencies: [filters, searchLoan]
   });

   const handleSuccessModalClose = useCallback(() => setShowPurple(false), []);

   const firstName = user?.username?.split(' ')[0] || user?.username || 'there';
   const displayFirstName = effectiveUser?.username?.split(' ')[0] || effectiveUser?.username || firstName;
   const accountEditPath = (edit: 'avatar' | 'name') => {
      const params = new URLSearchParams(location.search);
      params.set('edit', edit);
      return `/account/settings?${params.toString()}`;
   };
   const visibleLoans = shouldShowLenderTour && displayedLoans.length === 0 ? LENDER_TOUR_LOANS : displayedLoans;
   const isListLoading = isLoading && !shouldShowLenderTour;

   return (
      <>
         <div id="top" className="min-h-screen bg-md-neutral-200">
            <div className="max-w-[440px] mx-auto pb-28">
               {/* Header — authenticated vs public */}
               {isAuthenticated ? (
                  <div className="flex items-center justify-between px-md-5 py-md-3">
                     <div className="flex items-center gap-3">
                        <UserAvatar size={48} />
                        <div className="flex flex-col gap-1">
                           <button
                              type="button"
                              onClick={() => navigate(accountEditPath('name'))}
                              className="w-fit rounded-md-sm text-left text-md-h5 font-semibold text-md-primary-2000 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
                              aria-label="Edit display name"
                           >
                              Hello, {displayFirstName}
                           </button>
                           {needsRoleSelection ? (
                              <Link
                                 to="/onboarding/role"
                                 className="inline-flex w-fit items-center gap-1 rounded-md-sm bg-md-primary-100 px-2 py-1 text-md-b3 font-semibold text-md-primary-1200 underline-offset-2 hover:underline"
                              >
                                 Role not selected
                              </Link>
                           ) : isBorrower ? (
                              <div className="flex items-center gap-2">
                                 {showVerify ? (
                                    <WorldIDVerification
                                       showSuccessToast={false}
                                       onSuccess={() => {
                                          setHasWorldIdJustVerified(true);
                                          setShowWorldIdHighlight(true);
                                       }}
                                    >
                                       {({ open }) => (
                                          <button
                                             type="button"
                                             onClick={() => handleWorldIdHeaderClick(open)}
                                             className="inline-flex items-center gap-2 rounded-md-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
                                             data-tour-target="request-verify-world-id-link"
                                             aria-label="Verify World ID"
                                          >
                                             <span className="inline-flex items-center gap-1 px-md-1 py-md-0 bg-md-red-100 rounded-md-sm">
                                                <span className="w-3 h-3 rounded-full bg-md-red-800 flex items-center justify-center">
                                                   <span className="text-white text-[8px] font-bold">!</span>
                                                </span>
                                                <span className="text-md-b3 font-semibold text-md-red-800">Not Verified</span>
                                             </span>
                                             <span className="text-md-b3 font-semibold text-md-primary-900 underline">
                                                {'Verify World ID >'}
                                             </span>
                                          </button>
                                       )}
                                    </WorldIDVerification>
                                 ) : (
                                    <div ref={worldIdHighlightRef} className="relative">
                                       <span
                                          className={`inline-flex items-center gap-1 rounded-md-sm bg-md-green-100 px-md-1 py-md-0 transition-shadow duration-200 ${
                                             showWorldIdHighlight
                                                ? 'ring-2 ring-md-green-900/40 ring-offset-2 ring-offset-md-neutral-200'
                                                : ''
                                          }`}
                                       >
                                          <span className="w-3 h-3 rounded-full bg-md-green-900 flex items-center justify-center">
                                             <span className="text-white text-[8px] font-bold">&#10003;</span>
                                          </span>
                                          <span className="text-md-b3 font-semibold text-md-green-900">Verified</span>
                                       </span>
                                       {showWorldIdHighlight && (
                                          <div
                                             role="status"
                                             className="absolute left-0 top-[calc(100%+8px)] z-[75] w-[268px] rounded-[18px] border border-md-green-100 bg-[#fdfbfd] p-md-3 text-left shadow-[0_16px_42px_rgba(36,14,62,0.16)]"
                                          >
                                             <div className="flex items-start justify-between gap-md-2">
                                                <div className="flex min-w-0 gap-md-2">
                                                   <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-md-green-100 text-md-green-900">
                                                      <CheckCircle2 className="size-4" strokeWidth={2.4} />
                                                   </span>
                                                   <div>
                                                      <p className="text-md-b2 font-semibold text-md-heading">You are now verified.</p>
                                                      <p className="mt-0.5 text-md-b3 font-medium leading-[1.4] text-md-neutral-800">
                                                         Lenders will see this status on your loan requests.
                                                      </p>
                                                   </div>
                                                </div>
                                                <button
                                                   type="button"
                                                   onClick={() => setShowWorldIdHighlight(false)}
                                                   aria-label="Dismiss verification message"
                                                   className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-md-neutral-200 text-md-neutral-1000"
                                                >
                                                   <X className="size-4" strokeWidth={2.25} />
                                                </button>
                                             </div>
                                          </div>
                                       )}
                                    </div>
                                 )}
                              </div>
                           ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-md-primary-900 rounded-md-sm w-fit">
                                 <span className="text-md-b3 font-semibold text-md-neutral-100 capitalize whitespace-nowrap">
                                    IOU {lenderIouPoints}
                                 </span>
                              </span>
                           )}
                        </div>
                     </div>
                     <button
                        type="button"
                        onClick={() => navigate('/support')}
                        aria-label="Open help and support center"
                        className="shrink-0 w-12 h-12 bg-white rounded-full shadow-md-card flex items-center justify-center"
                     >
                        <HelpCircle className="w-6 h-6 text-md-primary-900" strokeWidth={1.5} />
                     </button>
                  </div>
               ) : (
                  <div className="relative flex items-center justify-between px-md-5 py-md-3">
                     <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-md-primary-1200 flex items-center justify-center overflow-hidden">
                           <img src={logoImageSrc} alt="Moodeng" className="w-8 h-8 object-contain" />
                        </div>
                        <span className="text-md-h5 font-semibold text-md-heading">Moodeng</span>
                     </div>
                     <button
                        type="button"
                        onClick={() => setShowPublicQuestions((isOpen) => !isOpen)}
                        data-tour-target="request-common-questions"
                        aria-label={showPublicQuestions ? 'Close common questions' : 'Open common questions'}
                        aria-expanded={showPublicQuestions}
                        className="size-11 rounded-full border border-md-primary-200 bg-white text-md-primary-1200 shadow-md-card inline-flex items-center justify-center active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary-900"
                     >
                        {showPublicQuestions ? <X className="size-5" strokeWidth={2.25} /> : <Menu className="size-5" strokeWidth={2.25} />}
                     </button>
                     <PublicQuestionsMenu
                        isOpen={showPublicQuestions}
                        clickOutsideRef={publicQuestionsRef}
                        onClose={() => setShowPublicQuestions(false)}
                     />
                  </div>
               )}

               {/* Content */}
               <div className="flex flex-col gap-5 px-md-4 py-md-3">
                  {/* Title */}
                  <div className="flex flex-col gap-1" data-tour-target="request-board-title">
                     <h1 className="text-md-h3 font-semibold text-md-heading">Microloan Request Board</h1>
                     <p className="text-md-b2 font-medium text-md-neutral-700">
                        {needsRoleSelection
                           ? 'Browse requests now. Choose a role when you are ready to borrow or lend.'
                           : isAuthenticated
                             ? 'Browse requests posted on Moodeng, or jump right in and get verified to start borrowing in USDC.'
                             : 'Browse requests publicly.'}
                     </p>
                  </div>

                  {needsRoleSelection ? (
                     <div className="relative overflow-hidden rounded-md-lg border border-md-primary-300 bg-md-primary-100 p-4 pr-[120px] shadow-md-card max-[374px]:pr-[104px]">
                        <div className="relative z-10 flex flex-col gap-3">
                           <div className="flex max-w-[286px] flex-col gap-1 max-[374px]:max-w-[220px]">
                              <p className="text-md-h5 font-semibold text-md-heading">Choose how you’ll use Moodeng</p>
                              <p className="text-md-b2 font-medium text-md-neutral-800">
                                 Pick borrower or lender to unlock your dashboard, repayment, and history.
                              </p>
                           </div>
                           <Link
                              to="/onboarding/role"
                              className="inline-flex w-fit items-center justify-center rounded-md-lg bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100"
                           >
                              Choose role
                           </Link>
                        </div>
                        <img
                           src="/hippos/sitting-down-pointing-hippo.png"
                           alt=""
                           className="pointer-events-none absolute bottom-[-6px] right-1 h-[132px] w-[132px] object-contain max-[374px]:bottom-[-4px] max-[374px]:right-0 max-[374px]:h-[116px] max-[374px]:w-[116px]"
                           aria-hidden="true"
                        />
                     </div>
                  ) : null}

                  {/* Apply Loan Card — visible for authenticated borrowers, or as CTA for public */}
                  {isAuthenticated && isBorrower && hasSelectedRole ? (
                     <div
                        className="bg-md-primary-100 border border-[#f0f0f0] rounded-md-lg p-4 relative overflow-hidden max-[374px]:p-3"
                        data-tour-target="request-apply-card"
                     >
                        <div className="flex flex-col gap-4 relative z-10">
                           <div className="flex flex-col gap-1 max-w-[232px] max-[374px]:max-w-[184px]">
                              <p className="text-md-h5 font-semibold text-md-heading max-[374px]:text-[22px]">Need short-term support?</p>
                              <p className="text-md-b2 font-medium text-md-neutral-700">
                                 <span className="max-[374px]:hidden">
                                    Borrow USDC to build trust and
                                    <br />
                                    unlock higher loan levels.
                                 </span>
                                 <span className="hidden max-[374px]:inline">Borrow USDC to build trust. Unlock higher levels.</span>
                              </p>
                           </div>
                           <button
                              onClick={handleApplyLoanClick}
                              data-tour-target="request-apply-button"
                              className="bg-md-primary-1200 text-md-neutral-100 text-md-b1 font-semibold px-md-4 py-md-3 rounded-md-lg w-fit max-[374px]:px-5 max-[374px]:py-3 max-[374px]:text-[15px]"
                           >
                              Apply For A Loan
                           </button>
                        </div>
                        <img
                           src="/hippos/thumb-up-right.png"
                           alt=""
                           className="absolute right-0 top-0 h-full object-contain pointer-events-none max-[374px]:bottom-0 max-[374px]:right-[-42px] max-[374px]:top-auto max-[374px]:h-[76%]"
                        />
                     </div>
                  ) : !isAuthenticated ? (
                     <div
                        className="bg-md-primary-100 border border-[#f0f0f0] rounded-md-lg p-4 relative overflow-hidden max-[374px]:p-3"
                        data-tour-target="request-apply-card"
                     >
                        <div className="flex flex-col gap-4 relative z-10">
                           <div className="flex flex-col gap-1 max-w-[232px] max-[374px]:max-w-[184px]">
                              <p className="text-md-h5 font-semibold text-md-heading max-[374px]:text-[22px]">Need short-term support?</p>
                              <p className="text-md-b2 font-medium text-md-neutral-700">
                                 <span className="max-[374px]:hidden">
                                    Borrow USDC to build trust and
                                    <br />
                                    unlock higher loan levels.
                                 </span>
                                 <span className="hidden max-[374px]:inline">Borrow USDC to build trust. Unlock higher levels.</span>
                              </p>
                           </div>
                           <Link
                              to="/sign-up"
                              className="border border-md-primary-1200 text-md-primary-1200 text-md-b1 font-semibold px-md-4 py-md-3 rounded-md-lg w-fit max-[374px]:px-5 max-[374px]:py-3 max-[374px]:text-[15px]"
                           >
                              Apply For A Loan
                           </Link>
                        </div>
                        <img
                           src="/hippos/thumb-up-right.png"
                           alt=""
                           className="absolute right-0 top-0 h-full object-contain pointer-events-none max-[374px]:bottom-0 max-[374px]:right-[-42px] max-[374px]:top-auto max-[374px]:h-[76%]"
                        />
                     </div>
                  ) : null}

                  {/* Browse Section */}
                  <div className="flex flex-col gap-5" data-tour-target="request-latest-list">
                     <div className="flex flex-col gap-4">
                        <p className="text-md-h5 font-semibold text-md-heading">Browse Latest Requests</p>
                        <div className="flex items-center gap-4">
                           {/* Search Bar */}
                           <div className="flex-1 bg-md-neutral-100 border border-md-neutral-600 rounded-[12px] shadow-md-card flex items-center gap-2.5 p-3">
                              <Search className="w-6 h-6 text-md-neutral-800" strokeWidth={1.5} />
                              <input
                                 value={searchLoan}
                                 onChange={(e) => setSearchLoan(e.target.value)}
                                 className="flex-1 bg-transparent text-md-b2 font-normal text-md-neutral-2000 placeholder:text-md-neutral-800 outline-none"
                                 placeholder="Search requests"
                                 type="search"
                              />
                           </div>
                           {/* Filter Button */}
                           <button
                              onClick={() => setShowFilters(!showFilters)}
                              className="shrink-0 border border-md-primary-1200 rounded-[12px] p-3 flex items-center justify-center"
                           >
                              <img src="/icons/filter.png" alt="Filter" className="w-6 h-6" />
                           </button>
                        </div>
                     </div>

                     {/* Important Note — lender only */}
                     {isAuthenticated && !isBorrower && showLenderNote && (
                        <div className="bg-[rgba(255,237,161,0.2)] rounded-md-lg flex items-start gap-4 px-4 py-[15px]">
                           <AlertTriangle className="w-5 h-5 shrink-0 text-md-yellow-700 mt-0.5" strokeWidth={2} />
                           <div className="flex-1 flex flex-col gap-1">
                              <p className="text-md-b3 font-semibold text-[#ae8c00]">IMPORTANT NOTE</p>
                              <p className="text-md-b3 font-normal text-black leading-[1.3]">
                                 Once lenders have issued three loans, a fee will be charged to their accounts. This fee helps maintain the
                                 platform's operational costs and ensures continued support for all users.
                              </p>
                           </div>
                           <button onClick={dismissLenderNote} className="shrink-0 mt-0.5">
                              <X className="w-6 h-6 text-md-neutral-1400" strokeWidth={2} />
                           </button>
                        </div>
                     )}

                     {/* Filters Sidebar (toggled) */}
                     {showFilters && (
                        <FilterSidebar
                           filters={filters}
                           onFiltersChange={handleFiltersChange}
                           customAmount={customAmount}
                           onCustomAmountChange={setCustomAmount}
                           onClose={() => setShowFilters(false)}
                        />
                     )}

                     {/* Request Cards */}
                     <div className="flex flex-col gap-5">
                        {isListLoading ? (
                           <div className="flex justify-center py-20">
                              <div className="h-12 w-12 animate-spin rounded-full border-2 border-md-primary-100 border-t-md-primary-900" />
                           </div>
                        ) : visibleLoans && visibleLoans.length > 0 ? (
                           visibleLoans.map((loan) => (
                              <div key={loan.id} data-tour-target={visibleLoans[0]?.id === loan.id ? 'request-first-card' : undefined}>
                                 <UserCard
                                    {...loan}
                                    isBorrower={isBorrower}
                                    isAuthenticated={isAuthenticated}
                                    tourBorrowerUsername={loan.id.startsWith('lender-tour') ? 'maya-demo' : undefined}
                                 />
                              </div>
                           ))
                        ) : (
                           <div className="text-center py-20 text-md-neutral-1200 text-md-b2">
                              {needsRoleSelection ? 'Public requests will appear here when available.' : 'No loan requests found.'}
                           </div>
                        )}
                     </div>

                     {!isListLoading && !shouldShowLenderTour && (
                        <LoadMoreButton currentCount={displayedCount} totalCount={totalCount} onLoadMore={handleLoadMore} />
                     )}
                  </div>
               </div>
            </div>
         </div>

         {/* Bottom auth bar for logged-out users */}
         {!isAuthenticated && (
            <div
               className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-md-neutral-400 py-4 px-5"
               data-tour-target="request-auth-actions"
            >
               <div className="max-w-[440px] mx-auto flex items-center gap-3">
                  <Link
                     to="/sign-in"
                     className="flex-1 text-center py-3 rounded-md-lg border border-md-primary-1200 text-md-primary-1200 text-md-b1 font-semibold"
                  >
                     Sign In
                  </Link>
                  <Link
                     to="/sign-up"
                     className="flex-1 text-center py-3 rounded-md-lg bg-md-primary-1200 text-md-neutral-100 text-md-b1 font-semibold"
                  >
                     Sign Up
                  </Link>
               </div>
            </div>
         )}

         {((isAuthenticated && isBorrower) || isGuestBorrowerTour) && (
            <>
               <BaseWalletRequiredModal
                  isOpen={showBaseWalletGate}
                  clickOutsideRef={baseWalletGateRef}
                  onClose={() => setShowBaseWalletGate(false)}
                  onAddBaseWallet={handleAddBaseWallet}
               />
               <LoanRequestModal
                  isOpen={showModal}
                  onClose={handleCloseModal}
                  showVerify={isGuestBorrowerTour ? false : showVerify}
                  user={effectiveUser || REFERRAL_TEST_USER}
                  loanAmount={loanAmount}
                  setLoanAmount={setLoanAmount}
                  totalRepaymentAmount={totalRepaymentAmount}
                  setTotalRepaymentAmount={setTotalRepaymentAmount}
                  reason={reason}
                  setReason={setReason}
                  days={days}
                  today={today}
                  handleDays={handleDays}
                  handleSubmit={handleSubmit}
                  onReferralApplied={setAppliedReferral}
                  onReferralRedeemed={handleReferralRedeemed}
                  isSubmitting={isSubmitting}
                  availableCreditLimit={availableCreditLimit}
                  canUseReferralBoost={canUseReferralBoost}
                  startOnReferralStep={!shouldShowBorrowerTour && canUseReferralBoost}
                  clickOutsideRef={loanRequestModalRef}
               />
               <SuccessModal isOpen={showPurple} onClose={handleSuccessModalClose} clickOutsideRef={successModalRef} />
            </>
         )}
         {isGuestBorrowerTour && showGuestWorldIdPreview && <GuestWorldIdTourPreview />}
         {shouldShowBorrowerTour && (
            <GuidedTourPreview
               key={`borrower-tour-${location.search}`}
               initialStepIndex={initialBorrowerTourStepIndex}
               startImmediately={shouldStartTourImmediately}
               onFinish={handleRequestBoardTourFinish}
               onStepChange={handleRequestBoardTourStepChange}
               onStepNext={handleRequestBoardTourStepNext}
               totalSteps={borrowerTourTotalSteps}
               steps={requestBoardTourSteps}
            />
         )}
         {shouldShowLenderTour && (
            <GuidedTourPreview
               key={`lender-tour-${location.search}`}
               onFinish={handleLenderTourFinish}
               totalSteps={9}
               steps={lenderTourSteps}
            />
         )}
      </>
   );
}

function GuestWorldIdTourPreview() {
   return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#12071f]/40 px-[21px] py-md-4">
         <div data-tour-target="guest-world-id-preview" className="w-full max-w-[398px] overflow-hidden rounded-[20px] bg-white shadow-2xl">
            <VerificationModalHeader onClose={() => undefined} />
            <VerificationModalBody onVerify={() => undefined} onCheckStatus={() => undefined} />
            <ModalNote />
         </div>
      </div>
   );
}

function PublicQuestionsMenu({
   isOpen,
   clickOutsideRef,
   onClose
}: {
   isOpen: boolean;
   clickOutsideRef: RefObject<HTMLDivElement>;
   onClose: () => void;
}) {
   if (!isOpen) return null;

   return (
      <div
         ref={clickOutsideRef}
         className="absolute left-md-4 right-md-4 top-[calc(100%+4px)] z-[70] rounded-[22px] border border-md-primary-100 bg-white p-md-4 shadow-[0_18px_46px_rgba(44,19,82,0.16)]"
      >
         <div className="mb-md-3 flex items-start justify-between gap-md-3">
            <div>
               <p className="text-md-h5 font-semibold text-md-heading">Common questions</p>
               <p className="mt-1 text-md-b3 font-medium text-md-neutral-800">Quick answers before you sign up.</p>
            </div>
            <button
               type="button"
               onClick={onClose}
               aria-label="Close common questions"
               className="size-9 shrink-0 rounded-full bg-md-neutral-200 text-md-neutral-1000 inline-flex items-center justify-center active:bg-md-neutral-300"
            >
               <X className="size-5" strokeWidth={2.25} />
            </button>
         </div>

         <div
            className="max-h-[56vh] overflow-y-auto overscroll-contain flex flex-col divide-y divide-md-neutral-400 rounded-md-lg border border-md-neutral-400 bg-md-neutral-100"
            data-tour-target="request-common-questions-panel"
         >
            {PUBLIC_COMMON_QUESTIONS.map((item) => (
               <div key={item.question} className="px-md-3 py-md-3">
                  <p className="text-md-b2 font-semibold text-md-heading">{item.question}</p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-line text-md-b3 font-medium leading-[1.45] text-md-neutral-800">
                     {item.answer}
                  </p>
               </div>
            ))}
         </div>

         <div className="mt-md-3 grid grid-cols-2 gap-md-2">
            <Link
               to={`/request-board?tour=1&startTour=1&tourRun=${Date.now()}`}
               onClick={onClose}
               className="rounded-md-lg bg-md-primary-1200 px-md-3 py-md-3 text-center text-md-b2 font-semibold text-md-neutral-100"
            >
               Take tour
            </Link>
            <Link
               to="/support/getting-started"
               onClick={onClose}
               className="rounded-md-lg border border-md-primary-200 bg-md-primary-100 px-md-3 py-md-3 text-center text-md-b2 font-semibold text-md-primary-1200"
            >
               See more
            </Link>
         </div>
      </div>
   );
}

function BaseWalletRequiredModal({
   isOpen,
   clickOutsideRef,
   onClose,
   onAddBaseWallet
}: {
   isOpen: boolean;
   clickOutsideRef: RefObject<HTMLDivElement>;
   onClose: () => void;
   onAddBaseWallet: () => void;
}) {
   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-[100] bg-[#12071f]/40 flex items-end sm:items-center justify-center px-md-3 py-md-4">
         <div
            ref={clickOutsideRef}
            className="w-full max-w-[408px] rounded-t-[32px] sm:rounded-[32px] bg-white shadow-md-overlay overflow-hidden"
         >
            <div className="flex items-center justify-between border-b border-md-neutral-400 px-md-4 py-md-3">
               <div className="flex items-center gap-md-2">
                  <img src="/icons/base-account.svg" alt="" className="size-11 rounded-md-lg" />
                  <h2 className="text-md-h4 font-semibold text-md-heading">Connect Base Wallet</h2>
               </div>
               <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close connect Base wallet"
                  className="size-11 rounded-full inline-flex items-center justify-center text-md-heading active:bg-md-neutral-300"
               >
                  <X className="size-7" strokeWidth={2.25} />
               </button>
            </div>

            <div className="flex flex-col gap-md-4 px-md-4 py-md-5">
               <div className="rounded-md-lg border border-md-primary-300 bg-md-primary-100 px-md-4 py-md-4">
                  <div className="flex items-start gap-md-3">
                     <div className="mt-0.5 size-10 rounded-full bg-md-primary-900/10 inline-flex items-center justify-center shrink-0">
                        <Wallet className="size-5 text-md-primary-900" strokeWidth={1.8} />
                     </div>
                     <p className="text-md-b1 font-medium leading-[1.45] text-md-neutral-900">
                        Borrowers need a confirmed Base wallet before requesting a loan. Connect the Base wallet you want tied to funding,
                        repayment, and your public trust record.
                     </p>
                  </div>
               </div>

               <button
                  type="button"
                  onClick={onAddBaseWallet}
                  className="w-full rounded-md-lg bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 active:scale-[0.99]"
               >
                  Connect Base Wallet
               </button>
               <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-md-lg border border-md-neutral-500 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-1200 active:bg-md-neutral-200"
               >
                  Not now
               </button>
            </div>
         </div>
      </div>
   );
}
