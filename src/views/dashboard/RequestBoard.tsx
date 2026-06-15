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
import { AlertTriangle, HelpCircle, LoaderCircle, Menu, Search, X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import FilterSidebar from '@/components/filters/FilterSidebar';
import GuidedTourPreview, { type TourRoleOption } from '@/components/GuidedTourPreview';
import IouPointHistoryModal from '@/components/IouPointHistoryModal';
import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import UserAvatar from '@/components/UserAvatar';
import { useVerifyYourself } from '@/components/verification/VerifyYourselfModal';
import { ModalNote } from '@/components/worldId/modal/ModalNote';
import { VerificationModalBody } from '@/components/worldId/modal/VerificationModalBody';
import { VerificationModalHeader } from '@/components/worldId/modal/VerificationModalHeader';

import { useClickOutside } from '@/hooks/useClickOutside';
import { useIsBorrower } from '@/hooks/useIsBorrower';
import { usePagination } from '@/hooks/usePagination';

import { formatCurrency } from '@/utils/decimalHelpers';
import { filterLoans, type LoanFilters } from '@/utils/loanFilters';

import { STARTING_CREDIT_LIMIT } from '@/config/creditTiers';
import { logoImageSrc } from '@/config/navigationConfig';
import type { BorrowerContextProfileData } from '@/lib/borrowerContextFit';
import { getBorrowerActiveLoanCount, getBorrowerUsedCreditAmount, isRequestBoardLoanVisible } from '@/lib/borrowerCreditUsage';
import { getEffectiveCreditLimit } from '@/lib/creditLeveling';
import { recordGuidedTourEvent } from '@/lib/guidedTourEvents';
import { isUserVerified } from '@/lib/isUserVerified';
import {
   BORROWER_GUIDED_TOUR_ID,
   GENERAL_GUIDED_TOUR_ID,
   LENDER_GUIDED_TOUR_ID,
   markGuidedTourCompleted,
   recordGuidedTourShown,
   shouldShowGuidedTour
} from '@/lib/guidedTourStorage';
import { getLoanRequestCooldownMessage, type LoanRequestRepostStatus } from '@/lib/loanRequestRepostStatus';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { hasWalletAddressOnAccount } from '@/lib/walletProvider';
import { formatPointsMajor } from '@/shared/points';
import { fetchUser, fetchUserProfiles, updateBorrowerContext } from '@/store/slices/authSlice';
import { createLoan, deleteLoan, fetchLoanRequestRepostStatus, fetchLoans, getLenderRepaidCount } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { User } from '@/types/authTypes';
import { ERROR_CODES } from '@/types/errorCodes';
import { getToastKeyFromErrorCode } from '@/types/errorToastMapping';
import { type CreateLoanData, type Loan, LoanStatus, RepaymentStatus } from '@/types/loanTypes';
import LoanRequestModal, { mapBorrowerContextForSave, type AppliedReferralCode } from '@/views/dashboard/components/LoanRequestModal';
import { RequestBoardFilterContextProvider } from '@/views/dashboard/components/RequestBoardFilterContext';
import SuccessModal from '@/views/dashboard/components/SuccessModal';
import UserCard from '@/views/dashboard/components/UserCard';
import LoadMoreButton from '@/views/profile/components/shared/LoadMoreButton';
import { FAQS } from '@/views/support/data/faqs';

// Stable empty-array identity so memos/selectors that fall back to "no loans" don't
// produce a fresh [] every render (which would churn downstream useMemos in a loop
// and crash the page — e.g. a blank screen when navigating Back into the board).
const EMPTY_LOANS: Loan[] = [];

const LENDER_NOTE_STORAGE_KEY = 'moodeng_lender_note_dismissed';
const REQUEST_BOARD_PREVIEW_REQUESTS_STORAGE_KEY = 'moodeng-request-board-preview-requests';
const IS_BORROWER_BASE_WALLET_GATE_ENABLED = true;
const VERIFIED_REQUEST_BOARD_TOUR_STEP_COUNT = 5;
const UNVERIFIED_REQUEST_BOARD_TOUR_STEP_COUNT = 4;
const GUEST_REQUEST_BOARD_TOUR_STEP_COUNT = 7;
const DASHBOARD_TOUR_STEP_COUNT = 3;
const TOUR_STEP_EXTRA_DURATION_MS = 3500;
const REQUEST_BOARD_COMPLETION_HIGHLIGHT_MS = 5000;
const PUBLIC_COMMON_QUESTIONS = FAQS;

const getDefaultRequestFilters = (): LoanFilters => ({
   amount: '',
   rate: '',
   date: null,
   loanTime: '',
   borrowType: [],
   network: [],
   search: '',
   sortBy: undefined
});

const hasAppliedRequestFilters = (filters: LoanFilters, customAmount: string) =>
   Boolean(
      filters.amount ||
      filters.rate ||
      filters.date ||
      filters.loanTime ||
      filters.sortBy ||
      (filters.borrowType?.length ?? 0) > 0 ||
      (filters.network?.length ?? 0) > 0 ||
      customAmount.trim()
   );

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

const getPreviewRequestDate = (dayOffset: number) => {
   const date = new Date();
   date.setUTCDate(date.getUTCDate() + dayOffset);
   date.setUTCHours(0, 0, 0, 0);
   return date.toISOString();
};

const PREVIEW_REQUEST_BOARD_BORROWER_USERNAMES: Record<string, string> = {
   'request-board-preview-borrower-maya': 'maya-demo',
   'request-board-preview-borrower-jordan': 'jordan-demo',
   'request-board-preview-borrower-ana': 'ana-demo'
};

const PREVIEW_REQUEST_BOARD_BORROWER_CONTEXTS: Record<string, BorrowerContextProfileData> = {
   'request-board-preview-borrower-maya': {
      incomeType:      'full-time',
      paydayType:      'end-of-month',
      paydayStart:     25,
      paydayEnd:       30,
      gapReasons:      ['bills_before_payday', 'transport'],
      monthlyIncome:   '200_400',
      monthlyExpenses: '50_150',
      profession:      'teacher',
      otherIncome:     'tutor'
   },
   'request-board-preview-borrower-jordan': {
      incomeType:      'part-time',
      paydayType:      'mid-month',
      paydayStart:     10,
      paydayEnd:       15,
      gapReasons:      ['medical', 'family_needs'],
      monthlyIncome:   'under_200',
      monthlyExpenses: 'under_50',
      profession:      'market vendor',
      otherIncome:     'domestic work'
   },
   'request-board-preview-borrower-ana': {
      incomeType:      'freelance',
      paydayType:      'irregular',
      paydayStart:     null,
      paydayEnd:       null,
      gapReasons:      ['bills_before_payday', 'transport'],
      monthlyIncome:   '400_700',
      monthlyExpenses: '150_300',
      profession:      'graphic designer',
      otherIncome:     'online sales'
   }
};

const LENDER_TOUR_BORROWER_CONTEXT: BorrowerContextProfileData = {
   incomeType:      'full-time',
   paydayType:      'end-of-month',
   paydayStart:     25,
   paydayEnd:       30,
   gapReasons:      ['bills_before_payday', 'transport'],
   monthlyIncome:   '200_400',
   monthlyExpenses: '50_150',
   profession:      'teacher',
   otherIncome:     'tutor'
};

const buildPreviewRequestBoardLoan = ({
   id,
   trackingId,
   borrowerUser,
   borrowerWallet,
   loanAmount,
   totalRepaymentAmount,
   reason,
   dueInDays
}: {
   id: string;
   trackingId: string;
   borrowerUser: string;
   borrowerWallet: string;
   loanAmount: number;
   totalRepaymentAmount: number;
   reason: string;
   dueInDays: number;
}): Loan => {
   const createdAt = getPreviewRequestDate(-1);

   return {
      id,
      trackingId,
      borrowerWallet,
      lenderWallet: '',
      borrowerUser,
      lenderUser: '',
      loanAmount,
      repaidAmount: 0,
      totalRepaymentAmount,
      reason,
      loanStatus: LoanStatus.REQUESTED,
      repaymentStatus: RepaymentStatus.UNPAID,
      dueDate: getPreviewRequestDate(dueInDays),
      coin: 'USDC',
      hash: [],
      createdAt,
      updatedAt: createdAt
   };
};

const buildPreviewRequestBoardLoans = (): Loan[] => [
   buildPreviewRequestBoardLoan({
      id: 'request-board-preview-loan-1',
      trackingId: 'PREVIEW-REQ-001',
      borrowerUser: 'request-board-preview-borrower-maya',
      borrowerWallet: '0x71c4000000000000000000000000000000009d42',
      loanAmount: 20,
      totalRepaymentAmount: 23,
      reason: 'Groceries and transport for the week',
      dueInDays: 14
   }),
   buildPreviewRequestBoardLoan({
      id: 'request-board-preview-loan-2',
      trackingId: 'PREVIEW-REQ-002',
      borrowerUser: 'request-board-preview-borrower-jordan',
      borrowerWallet: '0x71c4000000000000000000000000000000009d43',
      loanAmount: 15,
      totalRepaymentAmount: 17,
      reason: 'Medicine and school fees this week',
      dueInDays: 10
   }),
   buildPreviewRequestBoardLoan({
      id: 'request-board-preview-loan-3',
      trackingId: 'PREVIEW-REQ-003',
      borrowerUser: 'request-board-preview-borrower-ana',
      borrowerWallet: '0x71c4000000000000000000000000000000009d44',
      loanAmount: 30,
      totalRepaymentAmount: 34,
      reason: 'Bills and transport while waiting on a client payment',
      dueInDays: 21
   })
];

const isPreviewRequestBoardLoan = (loan: Pick<Loan, 'id'>) => loan.id.startsWith('request-board-preview-');

const isRequestBoardPreviewHost = () => {
   if (typeof window === 'undefined') return false;

   return (
      import.meta.env.DEV ||
      ['127.0.0.1', 'localhost'].includes(window.location.hostname) ||
      window.location.hostname.endsWith('.vercel.app')
   );
};

export const shouldShowPreviewRequestBoardLoans = (search: string, loans: Loan[]) => {
   if (!isRequestBoardPreviewHost()) return false;
   if (loans.some((loan) => isRequestBoardLoanVisible(loan))) return false;

   const params = new URLSearchParams(search);
   if (params.get('previewRequests') === '0') {
      window.sessionStorage.removeItem(REQUEST_BOARD_PREVIEW_REQUESTS_STORAGE_KEY);
      return false;
   }

   if (params.has('tour') || params.has('tourPreview') || params.has('lenderTourPreview') || params.has('referralTest')) return true;

   if (params.get('previewRequests') === '1') {
      return true;
   }

   return false;
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
const TOUR_SAMPLE_LOANS: Loan[] = [
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
      loanStatus: LoanStatus.REQUESTED,
      repaymentStatus: RepaymentStatus.UNPAID,
      dueDate: getPreviewRequestDate(7),
      coin: 'USDC',
      hash: [],
      createdAt: getPreviewRequestDate(-1),
      updatedAt: getPreviewRequestDate(-1)
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

   const { showToast, showToastByConfig } = useToast();

   const [showModal, setShowModal] = useState(false);
   const [showPurple, setShowPurple] = useState(false);
   const [showBioStep, setShowBioStep] = useState(false);
   const [isSubmitting, setIsSubmitting] = useState(false);
   // Synchronous guard — prevents a second click from slipping through before
   // setIsSubmitting(true) has a chance to re-render and disable the button.
   const isSubmittingRef = useRef(false);
   const [showFilters, setShowFilters] = useState(false);
   const [showLenderNote, setShowLenderNote] = useState(false);
   const [showPublicQuestions, setShowPublicQuestions] = useState(false);
   const [showGuestWorldIdPreview, setShowGuestWorldIdPreview] = useState(false);
   const [hasWorldIdJustVerified, setHasWorldIdJustVerified] = useState(false);
   const [showWorldIdHighlight, setShowWorldIdHighlight] = useState(false);
   const [pendingSubmittedRequestId, setPendingSubmittedRequestId] = useState<string | null>(null);
   const [highlightedRequestId, setHighlightedRequestId] = useState<string | null>(null);
   const [requestToDelete, setRequestToDelete] = useState<Loan | null>(null);
   const [isDeletingRequest, setIsDeletingRequest] = useState(false);
   const [showIouHistory, setShowIouHistory] = useState(false);
   const [isOpeningLoanRequest, setIsOpeningLoanRequest] = useState(false);

   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const isLoading = useSelector((state: RootState) => state.loans.isLoading);
   const requestBoardSearchParams = new URLSearchParams(location.search);
   const isReferralTestMode = import.meta.env.DEV && requestBoardSearchParams.has('referralTest');
   const forceTourPreview = import.meta.env.DEV && requestBoardSearchParams.has('tourPreview');
   const showWorldIdSuccessPreview = import.meta.env.DEV && requestBoardSearchParams.has('worldIdSuccessPreview');
   const showSubmittedRequestSuccessPreview = import.meta.env.DEV && requestBoardSearchParams.has('submittedRequestSuccessPreview');
   const showTourPreview = forceTourPreview || requestBoardSearchParams.has('tour');
   const shouldStartTourImmediately = requestBoardSearchParams.get('startTour') === '1';
   // When ?tour=1 is present but no tourRole was chosen yet, we show a role chooser inside
   // the "Want a quick tour?" intro card so the guest can pick borrow / lend / not sure.
   const tourRole = requestBoardSearchParams.get('tourRole');
   const needsTourRoleChoice = showTourPreview && !isReferralTestMode && !forceTourPreview && !tourRole;
   // A guest who isn't signed in can pick "I want to lend" from the role chooser inside the
   // tour intro card (?tour=1&tourRole=lender). That should run the same mocked-lender preview
   // the DEV-only `lenderTourPreview` flag drives — minus the DEV gate — so real production
   // visitors can actually see it. Real, signed-in lenders never match this: it requires
   // the *real* auth state to be empty, not just `isAuthenticated` (which this very flag feeds).
   const isRealUserAuthenticated = Boolean(user?.id && username);
   const wantsGuestLenderTour = showTourPreview && !isRealUserAuthenticated && tourRole === 'lender';
   const isLenderTourPreview = (import.meta.env.DEV && requestBoardSearchParams.has('lenderTourPreview')) || wantsGuestLenderTour;
   const shouldForceReferralTestUser = isReferralTestMode && showTourPreview;
   const effectiveUser = isLenderTourPreview
      ? LENDER_TOUR_USER
      : isReferralTestMode && (shouldForceReferralTestUser || !(user?.id && username))
        ? REFERRAL_TEST_USER
        : user;
   const isAuthenticated = !!(effectiveUser?.id && (username || isReferralTestMode || isLenderTourPreview));
   const hasSelectedRole = Boolean(effectiveUser?.userRole);
   const needsRoleSelection = isAuthenticated && !hasSelectedRole;
   const isWorldIdVerified = isUserVerified(effectiveUser) || hasWorldIdJustVerified;
   const showVerify = !isWorldIdVerified;
   const { open: openVerify, modal: verifyModal } = useVerifyYourself();
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
   const isGeneralTour = showTourPreview && !isRealUserAuthenticated && tourRole === 'general';
   const shouldShowGeneralTour =
      isGeneralTour &&
      (shouldStartTourImmediately || shouldShowGuidedTour(GENERAL_GUIDED_TOUR_ID, tourUserId, forceTourPreview));
   const shouldShowBorrowerTour =
      showTourPreview &&
      !isGeneralTour &&
      (!isAuthenticated || isBorrower) &&
      // needsTourRoleChoice means the user explicitly clicked "Take tour" — always show
      // the chooser regardless of whether they've done a tour before.
      (needsTourRoleChoice || shouldStartTourImmediately || shouldShowGuidedTour(BORROWER_GUIDED_TOUR_ID, tourUserId, forceTourPreview));
   const shouldShowLenderTour =
      showTourPreview &&
      isLenderTourPreview &&
      isAuthenticated &&
      !isBorrower &&
      shouldShowGuidedTour(LENDER_GUIDED_TOUR_ID, tourUserId, forceTourPreview);
   const isGuestBorrowerTour = shouldShowBorrowerTour && !isAuthenticated;
   // Drives the "continue the tour onto the borrower's profile" link in UserCard — a guest
   // has no real session, so the link must carry the preview query params itself rather than
   // relying on a DEV-only check.
   const isGuestLenderTour = shouldShowLenderTour && wantsGuestLenderTour;
   const recordedTourViewsRef = useRef<Set<string>>(new Set());
   const pendingLoanDataRef = useRef<CreateLoanData | null>(null);
   const rawFloanRequests = useSelector((state: RootState) => state.loans?.loans?.floans);
   const floanRequests = useMemo(() => rawFloanRequests || [], [rawFloanRequests]);
   const [hasLoadedRequestBoardLoans, setHasLoadedRequestBoardLoans] = useState(false);
   const liveRequestBoardLoans = hasLoadedRequestBoardLoans ? floanRequests : EMPTY_LOANS;
   const previewRequestBoardLoans = useMemo(buildPreviewRequestBoardLoans, []);
   const shouldUsePreviewRequestBoardLoans = hasLoadedRequestBoardLoans && shouldShowPreviewRequestBoardLoans(location.search, liveRequestBoardLoans);
   const requestBoardLoans = shouldUsePreviewRequestBoardLoans ? previewRequestBoardLoans : liveRequestBoardLoans;

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
   const effectiveCreditLimit = isAuthenticated ? getEffectiveCreditLimit(effectiveUser.cs, isUserVerified(effectiveUser)) : 0;
   const borrowerCreditLoans = useMemo(() => {
      if (!borrowerUserId) return [];

      return floanRequests.filter((loan) => loan.borrowerUser === borrowerUserId);
   }, [borrowerUserId, floanRequests]);
   const usedCreditAmount = useMemo(() => {
      return getBorrowerUsedCreditAmount(borrowerCreditLoans);
   }, [borrowerCreditLoans]);
   const activeBorrowerLoanCount = useMemo(() => getBorrowerActiveLoanCount(borrowerCreditLoans), [borrowerCreditLoans]);
   const hasReachedActiveLoanLimit = (effectiveUser.mal ?? 0) > 0 && activeBorrowerLoanCount >= (effectiveUser.mal ?? 0);
   const availableCreditLimit = Math.max(effectiveCreditLimit - usedCreditAmount, 0);
   const canUseReferralBoost =
      isReferralTestMode ||
      (isAuthenticated &&
         isBorrower &&
         isUserVerified(effectiveUser) &&
         effectiveCreditLimit <= STARTING_CREDIT_LIMIT &&
         borrowerCreditLoans.length === 0);
   const hasBorrowerBaseWallet = !IS_BORROWER_BASE_WALLET_GATE_ENABLED || hasWalletAddressOnAccount(effectiveUser);
   const shouldOpenLoanRequest =
      (location.state as { openLoanRequest?: boolean } | null)?.openLoanRequest === true ||
      new URLSearchParams(location.search).get('applyLoan') === '1';

   const loanRequestModalRef = useClickOutside<HTMLDivElement>(() => setShowModal(false), showModal) as RefObject<HTMLDivElement>;
   const successModalRef = useClickOutside<HTMLDivElement>(() => setShowPurple(false), showPurple) as RefObject<HTMLDivElement>;
   const publicQuestionsRef = useClickOutside<HTMLDivElement>(
      () => setShowPublicQuestions(false),
      showPublicQuestions
   ) as RefObject<HTMLDivElement>;
   const highlightedRequestRef = useRef<HTMLDivElement | null>(null);
   const lastScrolledHighlightedRequestIdRef = useRef<string | null>(null);
   const submittedRequestPreviewRunRef = useRef<string | null>(null);
   const deleteRequestModalRef = useClickOutside<HTMLDivElement>(() => {
      if (!isDeletingRequest) setRequestToDelete(null);
   }, Boolean(requestToDelete)) as RefObject<HTMLDivElement>;

   const [filters, setFilters] = useState<LoanFilters>(() => getDefaultRequestFilters());
   const hasActiveRequestFilters = useMemo(() => hasAppliedRequestFilters(filters, customAmount), [filters, customAmount]);

   useEffect(() => {
      if (showWorldIdSuccessPreview) {
         setHasWorldIdJustVerified(true);
         setShowWorldIdHighlight(true);
      }
   }, [showWorldIdSuccessPreview]);

   useEffect(() => {
      if (!showWorldIdHighlight) return;

      const timeoutId = window.setTimeout(() => setShowWorldIdHighlight(false), REQUEST_BOARD_COMPLETION_HIGHLIGHT_MS);
      return () => window.clearTimeout(timeoutId);
   }, [showWorldIdHighlight]);

   useEffect(() => {
      if (!highlightedRequestId) {
         lastScrolledHighlightedRequestIdRef.current = null;
         return;
      }

      const timeoutId = window.setTimeout(() => setHighlightedRequestId(null), REQUEST_BOARD_COMPLETION_HIGHLIGHT_MS);
      return () => window.clearTimeout(timeoutId);
   }, [highlightedRequestId]);

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
         navigate('/onboarding/welcome', returnTo ? { state: { returnTo } } : undefined);
      },
      [navigate]
   );

   const goToBorrowerWalletSetup = useCallback(
      (returnTo?: string, replace = false) => {
         setShowModal(false);
         navigate('/onboarding/wallet', { replace, state: returnTo ? { returnTo } : undefined });
      },
      [navigate]
   );

   const handleMissingBorrowerWallet = useCallback(() => {
      setShowModal(false);
      goToBorrowerWalletSetup('loan-request');
   }, [goToBorrowerWalletSetup]);

   const handleFiltersChange = (newFilters: Partial<LoanFilters>) => {
      setFilters((prev) => {
         const updated = { ...prev, ...newFilters };
         if ('date' in newFilters && newFilters.date !== null) updated.loanTime = '';
         if ('loanTime' in newFilters && newFilters.loanTime !== '') updated.date = null;
         return updated;
      });
   };

   const resetRequestFilters = useCallback(() => {
      setFilters(getDefaultRequestFilters());
      setCustomAmount('');
      setShowFilters(false);
   }, []);

   const handleFilterButtonClick = useCallback(() => {
      if (hasActiveRequestFilters) {
         resetRequestFilters();
         return;
      }

      setShowFilters((current) => !current);
   }, [hasActiveRequestFilters, resetRequestFilters]);

   const showLoanRequestCooldown = useCallback(
      (status: LoanRequestRepostStatus) => {
         showToast(TOAST_TYPES.WARNING, 'New request paused', getLoanRequestCooldownMessage(status), 'OK', 'acknowledge');
      },
      [showToast]
   );

   const ensureCanCreateLoanRequest = useCallback(async () => {
      if (!isAuthenticated || !isBorrower || isReferralTestMode || isLenderTourPreview) return true;

      try {
         const repostStatus = await dispatch(fetchLoanRequestRepostStatus()).unwrap();

         if (!repostStatus.canCreate) {
            showLoanRequestCooldown(repostStatus);
            return false;
         }

         return true;
      } catch (error) {
         console.error('Error checking loan request repost status:', (error as Error).message || error);
         showToast(
            TOAST_TYPES.ERROR,
            'Request limit unavailable',
            'We could not check your request limit. Please try again.',
            'OK',
            'acknowledge'
         );
         return false;
      }
   }, [dispatch, isAuthenticated, isBorrower, isLenderTourPreview, isReferralTestMode, showLoanRequestCooldown, showToast]);

   const handleApplyLoanClick = async (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (isOpeningLoanRequest) return;
      setIsOpeningLoanRequest(true);

      try {
         if (!isWorldIdVerified && !hasBorrowerBaseWallet) {
            goToBorrowerOnboardingStart('loan-request');
            return;
         }

         if (!hasBorrowerBaseWallet) {
            handleMissingBorrowerWallet();
            return;
         }

         if (!isWorldIdVerified) {
            setShowModal(true);
            return;
         }

         if (hasReachedActiveLoanLimit) {
            showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_LIMIT_REACHED));
            return;
         }

         if (availableCreditLimit <= 0) {
            showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_AMOUNT_EXCEEDS_LIMIT));
            return;
         }
         if (!(await ensureCanCreateLoanRequest())) {
            return;
         }
         setShowModal(true);
      } finally {
         window.setTimeout(() => setIsOpeningLoanRequest(false), 180);
      }
   };

   const handleCloseModal = useCallback(() => {
      setShowModal(false);
      setShowBioStep(false);
      pendingLoanDataRef.current = null;
   }, []);
   const handleVerifyHeaderClick = useCallback(() => {
      if (!hasBorrowerBaseWallet) {
         goToBorrowerOnboardingStart();
         return;
      }

      openVerify();
   }, [goToBorrowerOnboardingStart, hasBorrowerBaseWallet, openVerify]);
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

   useEffect(() => {
      if (!shouldShowGeneralTour || forceTourPreview) return;

      const viewKey = `${GENERAL_GUIDED_TOUR_ID}:${tourUserId || 'guest'}`;
      if (recordedTourViewsRef.current.has(viewKey)) return;

      recordedTourViewsRef.current.add(viewKey);
      const shownCount = recordGuidedTourShown(GENERAL_GUIDED_TOUR_ID, tourUserId);
      void recordGuidedTourEvent({
         eventType: 'shown',
         metadata: { path: location.pathname, role: 'general' },
         shownCount,
         tourId: GENERAL_GUIDED_TOUR_ID,
         userId: tourUserId
      });
   }, [forceTourPreview, location.pathname, shouldShowGeneralTour, tourUserId]);

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

   const GUEST_TOUR_ROLE_OPTIONS: TourRoleOption[] = [
      {
         id: 'borrower',
         title: 'I want to borrow',
         body: 'See how to request a short-term USDC loan and build trust through on-time repayment.'
      },
      {
         id: 'lender',
         title: 'I want to lend',
         body: 'See how to fund loan requests, review borrower trust signals, and earn by supporting people you believe in.'
      },
      {
         id: 'unsure',
         title: 'Not sure yet — just show me around',
         body: 'Get a quick overview of how Moodeng works before deciding which side to explore.'
      }
   ];

   const handleTourRoleSelect = useCallback(
      (roleId: string) => {
         if (roleId === 'unsure') {
            const params = new URLSearchParams(location.search);
            params.set('tourRole', 'general');
            params.set('startTour', '1');
            navigate(`${location.pathname}?${params.toString()}`, { replace: true });
            return;
         }
         const params = new URLSearchParams(location.search);
         params.set('tourRole', roleId);
         // startTour=1 makes the tour begin immediately without re-showing the intro card
         params.set('startTour', '1');
         navigate(`${location.pathname}?${params.toString()}`, { replace: true });
      },
      [location.pathname, location.search, navigate]
   );

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
            // A guest's lender tour runs in a simulated "lender-tour" session; leaving them on
            // this URL would look like they're really signed in as that demo user. Drop the
            // preview params and return them to the public board.
            if (isGuestLenderTour) navigate('/request-board');
            return;
         }

         navigate('/user/maya-demo?demo=rich&lenderTourPreview=1&tourPreview=1');
      },
      [forceTourPreview, isGuestLenderTour, location.pathname, navigate, tourUserId]
   );
   const handleGeneralTourFinish = useCallback(
      (reason: 'complete' | 'skip') => {
         if (!forceTourPreview) {
            markGuidedTourCompleted(GENERAL_GUIDED_TOUR_ID, tourUserId);
            void recordGuidedTourEvent({
               eventType: reason === 'skip' ? 'skipped' : 'completed',
               metadata: { path: location.pathname, role: 'general' },
               tourId: GENERAL_GUIDED_TOUR_ID,
               userId: tourUserId
            });
         }
      },
      [forceTourPreview, location.pathname, tourUserId]
   );
   const generalTourSteps = useMemo(() => [
      {
         target: '[data-tour-target="request-first-card"]',
         title: 'The request board',
         body: 'This is where borrowers post short-term USDC loan requests and lenders browse them. Both sides of Moodeng meet here.',
         durationMs: 6000
      },
      {
         target: '[data-tour-target="request-apply-card"]',
         title: 'Borrowers apply here',
         body: 'A borrower sets their loan amount, repayment date, and reason. Once verified with World ID, their request goes live on this board.',
         durationMs: 6000
      },
      {
         target: '[data-tour-target="request-latest-list"]',
         title: 'Lenders browse & fund',
         body: 'Lenders scroll through open requests, check each borrower\'s repayment history and trust signals, then fund the ones they believe in.',
         cardPlacement: 'bottom',
         durationMs: 6000
      },
      {
         target: '[data-tour-target="request-auth-actions"]',
         title: 'Ready to get started?',
         body: 'Create a free account to borrow or lend. Pick your role after signing up and we\'ll walk you through the rest.',
         durationMs: 6000
      }
   ], []);
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
                 cardPlacement: 'bottom',
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
                 cardPlacement: 'bottom',
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
         cardPlacement: 'bottom',
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
      let isActive = true;

      if (!isWorldIdVerified && !hasBorrowerBaseWallet) {
         navigate('/onboarding/welcome', { replace: true, state: { returnTo: 'loan-request' } });
         return;
      }

      if (!hasBorrowerBaseWallet) {
         goToBorrowerWalletSetup('loan-request', true);
         return;
      }

      if (!isWorldIdVerified) {
         setShowModal(true);
         navigate(pathname, { replace: true, state: null });
         return;
      }

      const openLoanRequestFromRoute = async () => {
         if (hasReachedActiveLoanLimit) {
            showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_LIMIT_REACHED));
            navigate(pathname, { replace: true, state: null });
            return;
         }

         const canCreateRequest = await ensureCanCreateLoanRequest();
         if (!isActive) return;

         if (canCreateRequest) setShowModal(true);
         navigate(pathname, { replace: true, state: null });
      };

      void openLoanRequestFromRoute();

      return () => {
         isActive = false;
      };
   }, [
      ensureCanCreateLoanRequest,
      hasReachedActiveLoanLimit,
      isAuthenticated,
      isBorrower,
      navigate,
      pathname,
      shouldOpenLoanRequest,
      showToastByConfig,
      hasBorrowerBaseWallet,
      isWorldIdVerified,
      goToBorrowerWalletSetup,
      effectiveUser?.id
   ]);

   const handleSubmit = async (e: FormEvent<HTMLFormElement>, borrowerContext?: import('@/lib/borrowerContextFit').BorrowerContextState) => {
      e.preventDefault();
      // Check the ref first — it updates synchronously, unlike state which waits for a re-render.
      // This closes the window where a second click can slip through while the first is in-flight.
      if (isSubmittingRef.current || isSubmitting) return;
      isSubmittingRef.current = true;

      try {
      const borrowerWallet = effectiveUser.walletAddress?.trim();
      const trimmedReason = reason.trim();
      const parsedLoanAmount = Number.parseFloat(loanAmount);
      const parsedRepaymentAmount = Number.parseFloat(totalRepaymentAmount);
      const parsedDueDate = days ? new Date(days) : null;

      if (!isWorldIdVerified && !hasBorrowerBaseWallet) {
         goToBorrowerOnboardingStart('loan-request');
         return;
      }
      if (!isWorldIdVerified) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.WORLDID_REQUIRED));
         return;
      }
      if (!hasBorrowerBaseWallet) {
         handleMissingBorrowerWallet();
         return;
      }
      if (hasReachedActiveLoanLimit) {
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
         isUserVerified(effectiveUser) &&
         hasBorrowerBaseWallet &&
         !hasReachedActiveLoanLimit &&
         parsedLoanAmount <= availableCreditLimit &&
         parsedLoanAmount > 0 &&
         parsedRepaymentAmount >= parsedLoanAmount + 1
      ) {
         // If borrower hasn't filled in bio yet, save from modal context or show bio step
         if (!effectiveUser.incomeType) {
            if (borrowerContext?.incomeSetup && borrowerContext?.paydayWindow && borrowerContext?.cashGaps.length > 0) {
               const mapped = mapBorrowerContextForSave(borrowerContext);
               pendingLoanDataRef.current = loanData;
               await handleBioSave({
                  incomeType:      mapped.incomeType,
                  paydayType:      mapped.paydayType,
                  paydayStart:     mapped.paydayStart,
                  paydayEnd:       mapped.paydayEnd,
                  gapReasons:      mapped.gapReasons,
                  monthlyIncome:   mapped.monthlyIncome,
                  monthlyExpenses: mapped.monthlyExpenses,
                  otherIncome:     mapped.otherIncome,
                  profession:      mapped.profession,
                  incomeDescription: mapped.incomeDescription
               });
               return;
            }
            pendingLoanDataRef.current = loanData;
            setShowBioStep(true);
            return;
         }

         await doCreateLoan(loanData);
      }
      } finally {
         // Always release the synchronous guard when handleSubmit finishes.
         // doCreateLoan manages isSubmitting state separately for the loading UI.
         isSubmittingRef.current = false;
      }
   };

   const doCreateLoan = async (loanData: CreateLoanData) => {
      setIsSubmitting(true);
      try {
         if (!(await ensureCanCreateLoanRequest())) {
            return;
         }
         const createdLoan = await dispatch(createLoan(loanData)).unwrap();
         clear();
         setSearchLoan('');
         setCustomAmount('');
         setFilters(getDefaultRequestFilters());
         setPendingSubmittedRequestId(createdLoan.id);
         setShowPurple(true);
         setShowModal(false);
         try {
            const loans = await dispatch(fetchLoans()).unwrap();
            const borrowerUserIds = [...new Set(loans.map((loan: Loan) => loan.borrowerUser).filter(Boolean))] as string[];
            if (borrowerUserIds.length > 0) {
               await dispatch(fetchUserProfiles(borrowerUserIds)).unwrap();
            }
         } catch (error) {
            console.error('Error refreshing loans after request creation:', (error as Error).message || error);
         }
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
         isSubmittingRef.current = false;
      }
   };

   const handleBioSave = async (data: { incomeType: string; paydayType: string; paydayStart?: number | null; paydayEnd?: number | null; gapReasons: string[]; monthlyIncome?: string; monthlyExpenses?: string; otherIncome?: string; profession?: string; incomeDescription?: string }) => {
      try {
         await dispatch(updateBorrowerContext({ incomeType: data.incomeType, paydayType: data.paydayType, paydayStart: data.paydayStart, paydayEnd: data.paydayEnd, gapReasons: data.gapReasons, monthlyIncome: data.monthlyIncome, monthlyExpenses: data.monthlyExpenses, otherIncome: data.otherIncome, profession: data.profession, incomeDescription: data.incomeDescription })).unwrap();
      } catch (error) {
         console.error('Failed to save borrower context:', error);
      }
      setShowBioStep(false);
      const pending = pendingLoanDataRef.current;
      pendingLoanDataRef.current = null;
      if (pending) {
         await doCreateLoan(pending);
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
         setHasLoadedRequestBoardLoans(false);
         try {
            const loans = await dispatch(fetchLoans()).unwrap();
            const borrowerUserIds = [...new Set(loans.map((loan: Loan) => loan.borrowerUser).filter(Boolean))] as string[];
            if (borrowerUserIds.length > 0) {
               await dispatch(fetchUserProfiles(borrowerUserIds)).unwrap();
            }
         } catch (error) {
            console.error('Error fetching data:', (error as Error).message || error);
         } finally {
            setHasLoadedRequestBoardLoans(true);
         }
      };
      loadLoans();
   }, [dispatch]);

   const filteredLoans = useMemo(() => {
      const allFilters: LoanFilters = { ...filters, search: searchLoan, sortBy: filters.sortBy };
      return filterLoans(
         requestBoardLoans.filter((loan) => isRequestBoardLoanVisible(loan)),
         allFilters,
         customAmount,
         userProfiles
      );
   }, [filters, searchLoan, requestBoardLoans, customAmount, userProfiles]);

   const {
      displayedItems: displayedLoans,
      displayedCount,
      totalCount,
      handleLoadMore
   } = usePagination({
      items: filteredLoans,
      resetDependencies: [filters, searchLoan]
   });

   const handleDeleteOwnRequestClick = useCallback(
      (loan: Loan) => {
         if (!effectiveUser?.id || loan.borrowerUser !== effectiveUser.id || loan.loanStatus !== 'Requested') return;

         setRequestToDelete(loan);
      },
      [effectiveUser?.id]
   );

   const handleCloseDeleteRequest = useCallback(() => {
      if (!isDeletingRequest) setRequestToDelete(null);
   }, [isDeletingRequest]);

   const handleConfirmDeleteRequest = useCallback(async () => {
      if (!requestToDelete || isDeletingRequest) return;

      if (!effectiveUser?.id || requestToDelete.borrowerUser !== effectiveUser.id || requestToDelete.loanStatus !== 'Requested') {
         setRequestToDelete(null);
         showToast(
            TOAST_TYPES.ERROR,
            "Request wasn't deleted",
            'Only the borrower who made a pending request can delete it.',
            'OK',
            'acknowledge'
         );
         return;
      }

      setIsDeletingRequest(true);
      try {
         await dispatch(deleteLoan(requestToDelete.id)).unwrap();
         setRequestToDelete(null);

         const repostStatus = await dispatch(fetchLoanRequestRepostStatus())
            .unwrap()
            .catch(() => null);

         showToast(
            TOAST_TYPES.SUCCESS,
            'Request deleted',
            repostStatus && !repostStatus.canCreate
               ? getLoanRequestCooldownMessage(repostStatus)
               : 'Lenders will no longer see this request on the board.'
         );

         await Promise.all([
            dispatch(fetchLoans()).unwrap().catch((error: Error) => {
               console.error('Error refreshing loans after delete:', error.message || error);
            }),
            dispatch(fetchUser()).unwrap().catch((error: Error) => {
               console.error('Error refreshing user after loan request delete:', error.message || error);
            })
         ]);
      } catch (error) {
         console.error('Error deleting loan request:', (error as Error).message || error);
         showToast(
            TOAST_TYPES.ERROR,
            "Request wasn't deleted",
            'It may already be funded or unavailable. Refreshing the board now.',
            'OK',
            'acknowledge'
         );
         await dispatch(fetchLoans())
            .unwrap()
            .catch((fetchError: Error) => {
               console.error('Error refreshing loans after delete failure:', fetchError.message || fetchError);
            });
      } finally {
         setIsDeletingRequest(false);
      }
   }, [dispatch, effectiveUser?.id, isDeletingRequest, requestToDelete, showToast]);

   const handleSuccessModalClose = useCallback(() => {
      setShowPurple(false);
      if (!pendingSubmittedRequestId) return;

      setHighlightedRequestId(pendingSubmittedRequestId);
      setPendingSubmittedRequestId(null);
   }, [pendingSubmittedRequestId]);

   const firstName = user?.displayName?.split(' ')[0] || user?.username?.split(' ')[0] || user?.username || 'there';
   const displayFirstName =
      effectiveUser?.displayName?.split(' ')[0] || effectiveUser?.username?.split(' ')[0] || effectiveUser?.username || firstName;
   const accountEditPath = (edit: 'avatar' | 'name') => {
      const params = new URLSearchParams(location.search);
      params.set('edit', edit);
      return `/account/settings?${params.toString()}`;
   };
   // Every guided tour describes this list as "the marketplace where requests appear", so an
   // empty "No loan requests found" box undercuts the explanation. When the real board is empty
   // during any tour, show a sample request to point at instead of an empty state.
   const visibleLoans =
      (shouldShowGeneralTour || shouldShowBorrowerTour || shouldShowLenderTour) && displayedLoans.length === 0
         ? TOUR_SAMPLE_LOANS
         : displayedLoans;
   const isListLoading = (!hasLoadedRequestBoardLoans || isLoading) && !shouldShowLenderTour;

   useEffect(() => {
      if (!highlightedRequestId || lastScrolledHighlightedRequestIdRef.current === highlightedRequestId) return;
      if (!visibleLoans.some((loan) => loan.id === highlightedRequestId)) return;

      const frameId = window.requestAnimationFrame(() => {
         highlightedRequestRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
         lastScrolledHighlightedRequestIdRef.current = highlightedRequestId;
      });

      return () => window.cancelAnimationFrame(frameId);
   }, [highlightedRequestId, visibleLoans]);

   useEffect(() => {
      if (!showSubmittedRequestSuccessPreview || visibleLoans.length === 0) return;
      if (submittedRequestPreviewRunRef.current === location.search) return;

      submittedRequestPreviewRunRef.current = location.search;
      setHighlightedRequestId(visibleLoans[0].id);
   }, [location.search, showSubmittedRequestSuccessPreview, visibleLoans]);

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
                                    <button
                                       type="button"
                                       onClick={handleVerifyHeaderClick}
                                       className="inline-flex items-center gap-2 rounded-md-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
                                       data-tour-target="request-verify-world-id-link"
                                       aria-label="Verify Yourself"
                                    >
                                       <span className="inline-flex items-center gap-1 px-md-1 py-md-0 bg-md-red-100 rounded-md-sm">
                                          <span className="w-3 h-3 rounded-full bg-md-red-800 flex items-center justify-center">
                                             <span className="text-white text-[8px] font-bold">!</span>
                                          </span>
                                          <span className="text-md-b3 font-semibold text-md-red-800">Not Verified</span>
                                       </span>
                                       <span className="text-md-b3 font-semibold text-md-primary-900 underline">
                                          {'Verify Yourself >'}
                                       </span>
                                    </button>
                                 ) : (
                                    <div className="relative">
                                       <span
                                          className={`inline-flex items-center gap-1 rounded-md-sm bg-md-green-100 px-md-1 py-md-0 transition-shadow duration-200 ${
                                             showWorldIdHighlight
                                                ? 'request-board-focus-highlight-badge ring-[3px] ring-md-primary-900/70 ring-offset-4 ring-offset-md-neutral-200'
                                                : ''
                                          }`}
                                       >
                                          <span className="w-3 h-3 rounded-full bg-md-green-900 flex items-center justify-center">
                                             <span className="text-white text-[8px] font-bold">&#10003;</span>
                                          </span>
                                          <span className="text-md-b3 font-semibold text-md-green-900">Verified</span>
                                       </span>
                                    </div>
                                 )}
                              </div>
                           ) : (
                              <button
                                 type="button"
                                 onClick={() => setShowIouHistory(true)}
                                 className="inline-flex items-center gap-1 px-2.5 py-1 bg-md-primary-900 rounded-md-sm w-fit hover:opacity-90 transition-opacity"
                                 title="View IOU point history"
                              >
                                 <span className="text-md-b3 font-semibold text-md-neutral-100 capitalize whitespace-nowrap">
                                    IOU {lenderIouPoints}
                                 </span>
                              </button>
                           )}
                        </div>
                     </div>
                     <button
                        type="button"
                        onClick={() => navigate('/support')}
                        aria-label="Open help and support center"
                        className="shrink-0 w-12 h-12 bg-white rounded-full shadow-md-card flex items-center justify-center transition-all duration-150 hover:brightness-105 active:scale-[0.96] active:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary-900"
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
                              disabled={isOpeningLoanRequest}
                              aria-busy={isOpeningLoanRequest}
                              data-tour-target="request-apply-button"
                              className="inline-flex min-h-[56px] w-fit items-center justify-center gap-md-1 rounded-md-lg bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 shadow-md-card transition-all duration-150 hover:brightness-110 active:scale-[0.97] active:brightness-90 disabled:pointer-events-none disabled:opacity-75 max-[374px]:min-h-12 max-[374px]:px-5 max-[374px]:py-3 max-[374px]:text-[15px]"
                           >
                              {isOpeningLoanRequest ? (
                                 <>
                                    <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                                    Opening...
                                 </>
                              ) : (
                                 'Apply For A Loan'
                              )}
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
                              className="inline-flex min-h-[56px] w-fit items-center justify-center rounded-md-lg border border-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-primary-1200 transition-all duration-150 hover:bg-md-primary-100 active:scale-[0.97] active:brightness-95 max-[374px]:min-h-12 max-[374px]:px-5 max-[374px]:py-3 max-[374px]:text-[15px]"
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
                              type="button"
                              onClick={handleFilterButtonClick}
                              aria-label={hasActiveRequestFilters ? 'Clear filters' : 'Open filters'}
                              aria-expanded={showFilters}
                              aria-pressed={hasActiveRequestFilters}
                              className={`shrink-0 rounded-[12px] border p-3 flex items-center justify-center transition-all duration-150 active:scale-[0.96] ${
                                 hasActiveRequestFilters
                                    ? 'border-md-primary-900 bg-md-primary-900 shadow-none'
                                    : showFilters
                                      ? 'border-md-primary-1200 bg-white shadow-[0_0_0_5px_rgba(96,16,210,0.16),0_5px_14px_rgba(96,16,210,0.16)]'
                                      : 'border-md-primary-1200 bg-white hover:shadow-[0_0_0_4px_rgba(96,16,210,0.1),0_4px_12px_rgba(96,16,210,0.12)]'
                              }`}
                           >
                              <img
                                 src="/icons/filter.png"
                                 alt=""
                                 className={`w-6 h-6 ${hasActiveRequestFilters ? 'brightness-0 invert' : ''}`}
                              />
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
                              <div
                                 key={loan.id}
                                 ref={loan.id === highlightedRequestId ? highlightedRequestRef : undefined}
                                 data-tour-target={visibleLoans[0]?.id === loan.id ? 'request-first-card' : undefined}
                              >
                                 <UserCard
                                    {...loan}
                                    currentUserId={effectiveUser?.id}
                                    isBorrower={isBorrower}
                                    isAuthenticated={isAuthenticated}
                                    isHighlighted={loan.id === highlightedRequestId}
                                    isPreviewRequest={isPreviewRequestBoardLoan(loan)}
                                    isDeletingOwnRequest={Boolean(isDeletingRequest && requestToDelete?.id === loan.id)}
                                    onDeleteOwnRequest={handleDeleteOwnRequestClick}
                                    forceTourBorrowerLink={isGuestLenderTour}
                                    tourBorrowerUsername={
                                       loan.id.startsWith('lender-tour')
                                          ? 'maya-demo'
                                          : loan.borrowerUser
                                            ? PREVIEW_REQUEST_BOARD_BORROWER_USERNAMES[loan.borrowerUser]
                                            : undefined
                                    }
                                    borrowerContextProfile={
                                       loan.id.startsWith('lender-tour')
                                          ? LENDER_TOUR_BORROWER_CONTEXT
                                          : loan.borrowerUser
                                            ? PREVIEW_REQUEST_BOARD_BORROWER_CONTEXTS[loan.borrowerUser]
                                            : undefined
                                    }
                                 />
                              </div>
                           ))
                        ) : needsRoleSelection ? (
                           <div className="text-center py-20 text-md-neutral-1200 text-md-b2">Public requests will appear here when available.</div>
                        ) : hasActiveRequestFilters || searchLoan.trim() ? (
                           <div className="flex flex-col items-center gap-2 py-20 text-center">
                              <p className="text-md-neutral-1200 text-md-b2">No requests match your filters.</p>
                              <p className="text-md-neutral-1000 text-md-b3">Try widening your search or clearing your filters.</p>
                              <button
                                 type="button"
                                 onClick={() => {
                                    resetRequestFilters();
                                    setSearchLoan('');
                                 }}
                                 className="mt-1 text-md-primary-1200 text-md-b3 font-semibold underline underline-offset-2"
                              >
                                 Clear filters
                              </button>
                           </div>
                        ) : (
                           <div className="text-center py-20 text-md-neutral-1200 text-md-b2">No loan requests found.</div>
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
                  showBioStep={showBioStep}
                  onBioSave={handleBioSave}
                  clickOutsideRef={loanRequestModalRef}
               />
               <SuccessModal isOpen={showPurple} onClose={handleSuccessModalClose} clickOutsideRef={successModalRef} />
               <DeleteLoanRequestModal
                  loan={requestToDelete}
                  clickOutsideRef={deleteRequestModalRef}
                  isDeleting={isDeletingRequest}
                  onClose={handleCloseDeleteRequest}
                  onConfirm={handleConfirmDeleteRequest}
               />
            </>
         )}
         {isGuestBorrowerTour && showGuestWorldIdPreview && <GuestWorldIdTourPreview />}
         {shouldShowBorrowerTour && (
            <GuidedTourPreview
               key={`borrower-tour-${location.search}`}
               initialStepIndex={initialBorrowerTourStepIndex}
               startImmediately={shouldStartTourImmediately}
               onFinish={handleRequestBoardTourFinish}
               onRoleSelect={needsTourRoleChoice ? handleTourRoleSelect : undefined}
               onStepChange={handleRequestBoardTourStepChange}
               onStepNext={handleRequestBoardTourStepNext}
               roleOptions={needsTourRoleChoice ? GUEST_TOUR_ROLE_OPTIONS : undefined}
               totalSteps={borrowerTourTotalSteps}
               steps={requestBoardTourSteps}
            />
         )}
         {shouldShowLenderTour && (
            <GuidedTourPreview
               key={`lender-tour-${location.search}`}
               startImmediately={shouldStartTourImmediately}
               // When returning from the Borrower Insights step via Back, resume at the
               // requested step (?tourStep=) instead of restarting from step 1.
               initialStepIndex={
                  Number.isInteger(requestedTourStepIndex) && requestedTourStepIndex >= 0
                     ? Math.min(requestedTourStepIndex, lenderTourSteps.length - 1)
                     : 0
               }
               onFinish={handleLenderTourFinish}
               totalSteps={9}
               steps={lenderTourSteps}
            />
         )}
         {shouldShowGeneralTour && (
            <GuidedTourPreview
               key={`general-tour-${location.search}`}
               startImmediately
               onFinish={handleGeneralTourFinish}
               steps={generalTourSteps}
            />
         )}
         <IouPointHistoryModal
            userId={isLenderTourPreview ? null : effectiveUser?.id}
            isOpen={showIouHistory}
            onClose={() => setShowIouHistory(false)}
         />
         {verifyModal}
      </>
   );
}

function DeleteLoanRequestModal({
   loan,
   clickOutsideRef,
   isDeleting,
   onClose,
   onConfirm
}: {
   loan: Loan | null;
   clickOutsideRef: RefObject<HTMLDivElement>;
   isDeleting: boolean;
   onClose: () => void;
   onConfirm: () => void;
}) {
   if (!loan) return null;

   const dueDate = new Date(loan.dueDate);
   const dueDateLabel = Number.isNaN(dueDate.getTime())
      ? 'the selected date'
      : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(dueDate);

   return (
      <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#12071f]/45 px-md-3 py-md-4 sm:items-center">
         <div
            ref={clickOutsideRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-loan-request-title"
            className="w-full max-w-[408px] overflow-hidden rounded-t-[32px] bg-white shadow-md-overlay sm:rounded-[32px]"
         >
            <div className="flex items-center justify-between border-b border-md-neutral-400 px-md-4 py-md-3">
               <div>
                  <h2 id="delete-loan-request-title" className="text-md-h4 font-semibold text-md-heading">
                     Delete this request?
                  </h2>
                  <p className="mt-1 text-md-b3 font-medium text-md-neutral-800">This cannot be undone.</p>
               </div>
               <button
                  type="button"
                  onClick={onClose}
                  disabled={isDeleting}
                  aria-label="Close delete request confirmation"
                  className="size-11 shrink-0 rounded-full text-md-heading inline-flex items-center justify-center active:bg-md-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
               >
                  <X className="size-7" strokeWidth={2.25} />
               </button>
            </div>

            <div className="flex flex-col gap-md-4 px-md-4 py-md-5">
               <div className="rounded-md-lg border border-red-100 bg-red-50 px-md-4 py-md-4">
                  <p className="text-md-b1 font-semibold text-red-700">{loan.reason || 'Loan request'}</p>
                  <p className="mt-2 text-md-b2 font-medium leading-[1.45] text-md-neutral-900">
                     Borrowing ${formatCurrency(loan.loanAmount)} and repaying ${formatCurrency(loan.totalRepaymentAmount)} by{' '}
                     {dueDateLabel}.
                  </p>
               </div>
               <p className="text-md-b2 font-medium leading-[1.45] text-md-neutral-900">
                  Lenders will no longer see it. You can make a new request from the board, but repeated deletes pause new requests for a
                  short time.
               </p>

               <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isDeleting}
                  className="w-full rounded-md-lg bg-red-600 px-md-4 py-md-3 text-md-b1 font-semibold text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
               >
                  {isDeleting ? 'Deleting...' : 'Delete request'}
               </button>
               <button
                  type="button"
                  onClick={onClose}
                  disabled={isDeleting}
                  className="w-full rounded-md-lg border border-md-neutral-500 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-1200 active:bg-md-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
               >
                  Keep request
               </button>
            </div>
         </div>
      </div>
   );
}

function GuestWorldIdTourPreview() {
   return (
      <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#12071f]/40 px-[21px] pb-[48px]">
         <div data-tour-target="guest-world-id-preview" className="w-full max-w-[398px] overflow-hidden rounded-[20px] bg-white shadow-2xl max-h-[45vh]">
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
               to={`/request-board?tour=1&tourRun=${Date.now()}`}
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
